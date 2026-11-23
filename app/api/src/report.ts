import { analyze, rupiah } from "./sales.js";

export function report({
  dateFrom,
  dateTo,
  overview,
  regions,
  brands,
  weakest,
}: ReturnType<typeof analyze>) {
  const date = (day: string) =>
    new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(day));
  const period = `Periode ${date(dateFrom)} hingga ${date(dateTo)}`;
  const text = regions.length
    ? `${period} mencatat penjualan bersih ${rupiah(overview.totalNetSales)}. Wilayah dengan penjualan tertinggi adalah ${regions[0].region} (${rupiah(regions[0].netSales)}) dan merek tertinggi adalah ${brands[0].brand} (${rupiah(brands[0].netSales)}). Outlet dengan penjualan terendah: ${weakest.map((o) => `${o.outletName} (${o.outletId}, ${rupiah(o.netSales)})`).join("; ")}. Tinjau ketersediaan stok dan riwayat kunjungan outlet sebelum menentukan tindak lanjut.`
    : `${period}: tidak ada transaksi yang sesuai dengan filter, sehingga wilayah, merek, dan outlet tidak dapat diperingkat. Periksa kembali pilihan filter sebelum menarik kesimpulan.`;
  return { text, language: "id-ID" as const };
}
