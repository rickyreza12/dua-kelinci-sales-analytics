import { watch } from "node:fs";
import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { EventEmitter } from "node:events";
import { parseSales } from "./sales.js";

export function openDataset(path: string) {
  let raw = readFileSync(path, "utf8");
  let data = parseSales(raw),
    version = 1,
    updatedAt = new Date().toISOString();
  let warning: string | null = null;
  const events = new EventEmitter().setMaxListeners(0);
  let timer: ReturnType<typeof setTimeout>;
  function failed(error: unknown) {
    warning = error instanceof Error ? error.message : "CSV tidak dapat dimuat";
    events.emit("change", "sales.load_failed");
  }
  const watcher = watch(dirname(path), (_event, name) => {
    if (name && name !== basename(path)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const next = readFileSync(path, "utf8");
        if (next === raw && !warning) return;
        const validated = parseSales(next);
        data = validated;
        raw = next;
        version++;
        updatedAt = new Date().toISOString();
        warning = null;
        events.emit("change", "sales.updated");
      } catch (error) {
        failed(error);
      }
    }, 200);
  });
  watcher.on("error", failed);
  return {
    get: () => ({
      data,
      datasetVersion: String(version),
      updatedAt,
      warning,
      source: basename(path),
    }),
    events,
    close: () => {
      clearTimeout(timer);
      watcher.close();
    },
  };
}
