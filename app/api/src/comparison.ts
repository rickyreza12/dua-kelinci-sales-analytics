import { analyze, filtersFrom, type parseSales } from "./sales.js";

export function compareSales(
  data: ReturnType<typeof parseSales>,
  datasetVersion: string,
  query: Record<string, unknown>,
) {
  const { mode, a, b, scope, ...dates } = query;
  if (
    (mode !== "region" && mode !== "brand") ||
    typeof a !== "string" ||
    typeof b !== "string" ||
    !a.trim() ||
    !b.trim() ||
    Object.keys(dates).some((key) => key !== "dateFrom" && key !== "dateTo")
  )
    throw new Error("Invalid comparison selection");
  const scopeKey = mode === "region" ? "brand" : "region";
  const filter = (value: string) =>
    filtersFrom({
      ...dates,
      [mode]: value,
      ...(scope === undefined ? {} : { [scopeKey]: scope }),
    });
  const filtersA = filter(a),
    filtersB = filter(b);
  if (filtersA[mode] === filtersB[mode])
    throw new Error("Select two different values");
  const side = (filters: ReturnType<typeof filter>) => {
    const { overview, brands, regions } = analyze(
      data,
      filters,
      datasetVersion,
    );
    return {
      name: filters[mode],
      netSales: overview.uniqueInvoiceCount ? overview.totalNetSales : null,
      invoices: overview.uniqueInvoiceCount,
      outlets: overview.activeOutletCount,
      cartons: overview.totalCartons,
      breakdown:
        mode === "brand"
          ? regions.map((r) => ({ name: r.region, netSales: r.netSales }))
          : brands.map((b) => ({ name: b.brand, netSales: b.netSales })),
    };
  };
  const left = side(filtersA),
    right = side(filtersB);
  const difference =
    left.netSales === null || right.netSales === null
      ? null
      : right.netSales - left.netSales;
  return {
    a: left,
    b: right,
    difference,
    percentChange:
      difference !== null && left.netSales !== null && left.netSales > 0
        ? (difference / left.netSales) * 100
        : null,
    datasetVersion,
  };
}
