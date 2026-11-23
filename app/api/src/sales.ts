import { parse } from "csv-parse/sync";

export const header =
  "date,invoice_no,region,branch,outlet_id,outlet_name,outlet_type,salesman,brand,sku,qty_carton,price_per_carton_idr,gross_sales_idr,discount_idr,net_sales_idr";
export type Filters = Partial<
  Record<"dateFrom" | "dateTo" | "region" | "brand", string>
>;
export const rupiah = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const singleLine = (value: string) => value.trim().replace(/\s+/g, " ");
const regionName = (name: string) =>
  ({
    jabar: "Jawa Barat",
    "jawa barat": "Jawa Barat",
    jabodetabek: "Jabodetabek",
    "jawa timur": "Jawa Timur",
  })[name.toLowerCase()] ?? name;
function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date;
}
export function filtersFrom(input: unknown): Filters {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected filter object");
  const filters: Filters = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      !["dateFrom", "dateTo", "region", "brand"].includes(key) ||
      typeof value !== "string" ||
      !value.trim() ||
      value.length > 200 ||
      (key.startsWith("date") && !validDate(value))
    )
      throw new Error("Invalid filter");
    filters[key as keyof Filters] =
      key === "region" ? regionName(singleLine(value)) : singleLine(value);
  }
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo)
    throw new Error("Start date must not exceed end date");
  return filters;
}
export function parseSales(csv: string) {
  const [columns, ...records] = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    raw: true,
    info: true,
  }) as unknown as { record: string[]; raw: string; info: { lines: number } }[];
  if (columns?.record.join(",") !== header || !records.length)
    throw new Error(
      "Expected the original 15-column header and at least one data row",
    );
  const seen = new Set<string>();
  const quality = {
    rows: records.length,
    duplicates: 0,
    missingSalesman: 0,
    returns: 0,
  };
  let absoluteSales = 0,
    absoluteCartons = 0;
  const rows = records.map(({ record, raw, info }) => {
    const key = raw.replace(/\r?\n$/, "");
    if (seen.has(key)) quality.duplicates++;
    seen.add(key);
    const [
      date,
      invoice,
      region,
      branch,
      outletId,
      outletName,
      outletType,
      salesman,
      brand,
      sku,
      ...numbers
    ] = record.map(singleLine);
    if (
      !validDate(date) ||
      ![
        invoice,
        region,
        branch,
        outletId,
        outletName,
        outletType,
        brand,
        sku,
      ].every(Boolean) ||
      !numbers.every(
        (n) => /^-?\d+$/.test(n) && Number.isSafeInteger(Number(n)),
      )
    )
      throw new Error(`Invalid required value at CSV line ${info.lines}`);
    const cartons = Number(numbers[0]),
      netSales = Number(numbers[4]);
    absoluteSales += Math.abs(netSales);
    absoluteCartons += Math.abs(cartons);
    if (
      !Number.isSafeInteger(absoluteSales) ||
      !Number.isSafeInteger(absoluteCartons)
    )
      throw new Error(
        `Aggregate exceeds safe integer range at CSV line ${info.lines}`,
      );
    if (!salesman) quality.missingSalesman++;
    if (netSales < 0) quality.returns++;
    return {
      date,
      invoice,
      region: regionName(region),
      branch,
      outletId,
      outletName,
      outletType,
      brand,
      cartons,
      netSales,
    };
  });
  const dates = rows.map((row) => row.date).sort();
  return {
    rows,
    quality,
    dateFrom: dates[0],
    dateTo: dates[dates.length - 1],
    regionOptions: [...new Set(rows.map((r) => r.region))].sort(),
    brandOptions: [...new Set(rows.map((r) => r.brand))].sort(),
  };
}

function totals<T extends { netSales: number }>(
  rows: readonly T[],
  key: (row: T) => string,
) {
  const groups = new Map<string, T>();
  for (const row of rows) {
    const id = key(row);
    groups.set(id, {
      ...(groups.get(id) ?? row),
      netSales: (groups.get(id)?.netSales ?? 0) + row.netSales,
    });
  }
  return [...groups.values()];
}
export function analyze(
  data: ReturnType<typeof parseSales>,
  filters: Filters,
  datasetVersion: string,
) {
  const dateFrom =
    filters.dateFrom ??
    (filters.dateTo && filters.dateTo < data.dateFrom
      ? filters.dateTo
      : data.dateFrom);
  const dateTo =
    filters.dateTo ??
    (filters.dateFrom && filters.dateFrom > data.dateTo
      ? filters.dateFrom
      : data.dateTo);
  const rows = data.rows.filter(
    (r) =>
      r.date >= dateFrom &&
      r.date <= dateTo &&
      (!filters.region || r.region === filters.region) &&
      (!filters.brand || r.brand === filters.brand),
  );
  const totalNetSales = rows.reduce((sum, row) => sum + row.netSales, 0);
  const share = (n: number) => (totalNetSales ? (n / totalNetSales) * 100 : 0);
  const regions = totals(rows, (r) => r.region)
    .map(({ region, netSales }) => ({
      region,
      netSales,
      sharePercent: share(netSales),
    }))
    .sort(
      (a, b) => b.netSales - a.netSales || a.region.localeCompare(b.region),
    );
  const brands = totals(rows, (r) => r.brand)
    .map(({ brand, netSales }) => ({
      brand,
      netSales,
      sharePercent: share(netSales),
    }))
    .sort((a, b) => b.netSales - a.netSales || a.brand.localeCompare(b.brand));
  const outlets = totals(rows, (r) => r.outletId)
    .map(({ outletId, outletName, outletType, branch, region, netSales }) => ({
      outletId,
      outletName,
      outletType,
      branch,
      region,
      netSales,
    }))
    .sort(
      (a, b) => a.netSales - b.netSales || a.outletId.localeCompare(b.outletId),
    );
  return {
    dateFrom,
    dateTo,
    overview: {
      totalNetSales,
      uniqueInvoiceCount: new Set(rows.map((r) => r.invoice)).size,
      activeOutletCount: outlets.length,
      totalCartons: rows.reduce((sum, r) => sum + r.cartons, 0),
      datasetVersion,
    },
    regions,
    brands,
    weakest: outlets.slice(0, 5).map((row, i) => ({ ...row, rank: i + 1 })),
  };
}
