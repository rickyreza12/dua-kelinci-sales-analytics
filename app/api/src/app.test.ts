import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { expect, test, vi } from "vitest";
import { analyze, parseSales } from "./sales.js";
import { createApp } from "./app.js";
import { openDataset } from "./dataset.js";
import { telegram } from "./telegram.js";

const source = new URL("../../../data/sales_sep_oct_2026.csv", import.meta.url);
const csv = readFileSync(source, "utf8");
const api = "/api/v1";
test("reconciles the original CSV independently of the app parser", () => {
  const [header, ...lines] = csv.trimEnd().split(/\r?\n/);
  const rows = lines.map((line) => line.split(","));
  expect(header.split(",")).toHaveLength(15);
  expect(rows.every((row) => row.length === 15)).toBe(true);
  expect(rows).toHaveLength(1891);
  expect(lines.length - new Set(lines).size).toBe(3);
  expect(rows.filter((row) => !row[7].trim())).toHaveLength(5);
  expect(
    rows
      .filter((row) => Number(row[14]) < 0)
      .map((row) => [row[1], Number(row[14])]),
  ).toEqual([["RTR900001", -528000]]);
  expect(rows.reduce((sum, row) => sum + Number(row[14]), 0)).toBe(1728036900);
  for (const [index, count] of [
    [1, 824],
    [4, 52],
    [8, 8],
  ])
    expect(new Set(rows.map((row) => row[index].trim())).size).toBe(count);
  const dataset = parseSales(csv);
  const result = analyze(dataset, {}, "1");
  expect(dataset.quality).toEqual({
    rows: 1891,
    duplicates: 3,
    missingSalesman: 5,
    returns: 1,
  });
  expect(result.overview).toMatchObject({
    totalNetSales: 1728036900,
    uniqueInvoiceCount: 824,
    activeOutletCount: 52,
  });
  expect(result.brands[0]).toMatchObject({
    brand: "Kacang Dua Kelinci",
    netSales: 740084500,
  });
  expect(result.weakest.map((o) => [o.outletId, o.netSales])).toEqual([
    ["OUT1003", 564000],
    ["OUT1026", 834000],
    ["OUT1035", 1122000],
    ["OUT1045", 1158000],
    ["OUT1042", 1230000],
  ]);
  expect(result.regions.find((r) => r.region === "Jawa Barat")?.netSales).toBe(
    rows
      .filter((r) =>
        ["jabar", "jawa barat"].includes(r[2].trim().toLowerCase()),
      )
      .reduce((sum, r) => sum + Number(r[14]), 0),
  );
  const [first, second] = dataset.rows;
  const tied = analyze(
    {
      ...dataset,
      rows: [
        { ...first, outletId: "B", netSales: 1 },
        { ...second, outletId: "A", netSales: 1 },
      ],
    },
    {},
    "1",
  );
  expect(tied.weakest.map((o) => o.outletId)).toEqual(["A", "B"]);
});
test("validates filters, keeps endpoints consistent, and only sends on explicit POST", async () => {
  const dataset = openDataset(fileURLToPath(source));
  try {
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ok: true }));
    const env = {
      TELEGRAM_ENABLED: "true",
      TELEGRAM_BOT_TOKEN: "123:test-secret",
      TELEGRAM_CHAT_ID: "-456",
    };
    const client = request(createApp(dataset, telegram(env, upstream)));
    await client.get(`${api}/health`).expect(200);
    const filters = {
      brand: "Sukro",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-01",
    };
    const { body } = await client
      .get(`${api}/dashboard`)
      .query(filters)
      .expect(200);
    expect(body.overview.totalNetSales).toBe(9242300);
    expect(body.brands).toHaveLength(1);
    for (const [route, key] of [
      ["sales/overview", "overview"],
      ["sales/regions", "regions"],
      ["sales/brands", "brands"],
      ["outlets/weakest", "weakest"],
      ["reports/summary", "summary"],
    ])
      await client.get(`${api}/${route}`).query(filters).expect(200, body[key]);
    expect(body.summary.text).toContain("Rp9.242.300");
    expect(body.summary.text).not.toMatch(/[\r\n]/);
    expect(JSON.stringify(body)).not.toContain(env.TELEGRAM_BOT_TOKEN);
    await client
      .get(`${api}/sales/overview`)
      .query({ dateFrom: "2026-02-30" })
      .expect(400);
    await client
      .post(`${api}/telegram/send`)
      .send({ text: "untrusted" })
      .expect(400);
    await client
      .post(`${api}/telegram/send`)
      .set("Origin", "https://example.com")
      .send(filters)
      .expect(403);
    expect(upstream).not.toHaveBeenCalled();
    await client
      .post(`${api}/telegram/send`)
      .send(filters)
      .expect(200, { sent: true });
    expect(JSON.parse(String(upstream.mock.calls[0][1]?.body))).toEqual({
      chat_id: "-456",
      text: body.summary.text,
    });
    upstream.mockRejectedValue(new Error(env.TELEGRAM_BOT_TOKEN));
    await client
      .post(`${api}/telegram/send`)
      .send(filters)
      .expect(502, { error: "Telegram delivery failed" });
    await request(createApp(dataset, telegram({})))
      .post(`${api}/telegram/send`)
      .send({})
      .expect(503);
  } finally {
    dataset.close();
  }
});

test("streams replacement and invalid CSV events without dropping the last valid snapshot", async () => {
  const folder = mkdtempSync(join(tmpdir(), "dk-sales-"));
  const path = join(folder, "sales.csv");
  writeFileSync(path, csv);
  const dataset = openDataset(path);
  const server = createApp(dataset, telegram({})).listen(0, "127.0.0.1");
  const ctrl = new AbortController();
  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Expected TCP address");
    const response = await fetch(
      `http://127.0.0.1:${address.port}${api}/events`,
      { signal: ctrl.signal },
    );
    const reader = response
      .body!.pipeThrough(new TextDecoderStream())
      .getReader();
    await reader.read();
    writeFileSync(path, csv.replace(",940500", ",940501"));
    expect((await reader.read()).value).toContain("sales.updated");
    expect(analyze(dataset.get().data, {}, "2").overview.totalNetSales).toBe(
      1728036901,
    );
    writeFileSync(path, "invalid");
    expect((await reader.read()).value).toContain("sales.load_failed");
    expect(dataset.get()).toMatchObject({
      datasetVersion: "2",
      warning: expect.any(String),
    });
    expect(analyze(dataset.get().data, {}, "2").overview.totalNetSales).toBe(
      1728036901,
    );
  } finally {
    ctrl.abort();
    server.close();
    dataset.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
