import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { openDataset } from "./dataset.js";
import { telegram } from "./telegram.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const dataset = openDataset(
  resolve(root, process.env.SALES_CSV || "data/sales_sep_oct_2026.csv"),
);
createApp(
  dataset,
  telegram(process.env),
  resolve(root, "app/web/dist"),
).listen(3001, "127.0.0.1", () =>
  console.log("Sales API: http://127.0.0.1:3001"),
);
