import express, { type ErrorRequestHandler } from "express";
import { openDataset } from "./dataset.js";
import { analyze, filtersFrom } from "./sales.js";
import { report } from "./report.js";
import { telegram } from "./telegram.js";
import { compareSales } from "./comparison.js";

const prefix = "/api/v1";
const localOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
]);
export function createApp(
  dataset: ReturnType<typeof openDataset>,
  bot: ReturnType<typeof telegram>,
  web?: string,
) {
  const app = express();
  app.disable("x-powered-by");
  const api = express.Router();
  app.use(prefix, api);
  api.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  api.get("/health", (_req, res) => {
    res.json({ status: "ok", datasetVersion: dataset.get().datasetVersion });
  });
  api.get("/events", (_req, res) => {
    res
      .set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
      })
      .flushHeaders();
    res.write("retry: 1500\n\n");
    const notify = (event: string) => {
      const { datasetVersion, warning } = dataset.get();
      res.write(
        `event: ${event}\ndata: ${JSON.stringify({ datasetVersion, warning })}\n\n`,
      );
    };
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15000);
    dataset.events.on("change", notify);
    res.on("close", () => {
      clearInterval(heartbeat);
      dataset.events.off("change", notify);
    });
  });
  api.get("/sales/comparison", (req, res) => {
    const { data, datasetVersion } = dataset.get();
    try {
      res.json(compareSales(data, datasetVersion, req.query));
    } catch {
      res.status(400).json({ error: "Invalid comparison filters" });
    }
  });
  const endpoints = {
    "/sales/overview": "overview",
    "/sales/regions": "regions",
    "/sales/brands": "brands",
    "/outlets/weakest": "weakest",
    "/reports/summary": "summary",
    "/dashboard": "dashboard",
  } as const;
  for (const [path, key] of Object.entries(endpoints))
    api.get(path, (req, res) => {
      const { data, datasetVersion, updatedAt, warning, source } =
        dataset.get();
      let filters;
      try {
        filters = filtersFrom(req.query);
      } catch {
        res.status(400).json({ error: "Invalid sales filters" });
        return;
      }
      const result = analyze(data, filters, datasetVersion);
      if (key === "dashboard")
        res.json({
          ...result,
          summary: report(result),
          metadata: {
            updatedAt,
            warning,
            source,
            quality: data.quality,
            regionOptions: data.regionOptions,
            brandOptions: data.brandOptions,
          },
          telegram: bot.status,
        });
      else res.json(key === "summary" ? report(result) : result[key]);
    });
  api.get("/telegram/status", (_req, res) => {
    res.json(bot.status);
  });
  api.post(
    "/telegram/send",
    express.json({ limit: "4kb" }),
    async (req, res) => {
      if (
        !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
          req.socket.remoteAddress ?? "",
        ) ||
        (req.headers.origin && !localOrigins.has(req.headers.origin))
      ) {
        res.status(403).json({ error: "Local requests only" });
        return;
      }
      if (
        ((req.headers["content-length"] !== undefined &&
          Number(req.headers["content-length"]) > 0) ||
          req.headers["transfer-encoding"]) &&
        !req.is("application/json")
      ) {
        res.status(415).json({ error: "Expected application/json" });
        return;
      }
      let filters;
      try {
        filters = filtersFrom(req.body === undefined ? {} : req.body);
      } catch {
        res.status(400).json({ error: "Invalid sales filters" });
        return;
      }
      if (!bot.status.enabled || !bot.status.configured) {
        res.status(503).json({ error: "Telegram unavailable" });
        return;
      }
      const { data, datasetVersion } = dataset.get();
      const { text } = report(analyze(data, filters, datasetVersion));
      try {
        await bot.send(text);
        res.json({ sent: true });
      } catch {
        res.status(502).json({ error: "Telegram delivery failed" });
      }
    },
  );
  api.use((_req, res) => {
    res.status(404).json({ error: "Unknown API endpoint" });
  });
  const fail: ErrorRequestHandler = (error, _req, res, _next) => {
    void _next;
    const status = [400, 413, 415].includes(error.status) ? error.status : 500;
    res.status(status).json({
      error:
        status === 500 ? "Unexpected server error" : "Invalid request body",
    });
  };
  app.use(fail);
  if (web) app.use(express.static(web));
  return app;
}
