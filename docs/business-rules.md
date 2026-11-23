# Business Rules and Validation Baseline

Data source: `data/sales_sep_oct_2026.csv`, 1 Sep–31 Oct 2026. Its 15-column header is preserved unchanged.

## Metric definitions
- **Net sales:** Sum integer `net_sales_idr`; always display Indonesian rupiah. Negative return rows reduce sales.
- **Gross sales:** Sum `gross_sales_idr`, if displayed.
- **Discount:** Sum `discount_idr`, if displayed.
- **Invoice count:** Cardinality of distinct `invoice_no` values. One invoice may contain multiple SKU rows.
- **Active outlets:** Distinct `outlet_id` in filtered rows; do not group by ambiguous outlet names.
- **Total cartons:** Sum `qty_carton`, including negatives if returned cartons exist.
- **Region/brand totals:** Aggregate net sales by normalized region and original brand, respectively.
- **Weakest five outlets:** Bottom five active `outlet_id` by total net sales in the current filtered dataset, sorted ascending with `outlet_id` ascending as tie-breaker. Clearly label this as *lowest sales volume by value*, not adjusted for visit frequency or store potential.
- **Date range filtering:** Inclusive start and end dates in local calendar terms; report the selected range.
- **Filters:** Region, brand, and date range affect all headline data, charts, weakest outlet ranking, and summary consistently.

## Data quality
- Trim categorical whitespace for grouping. Region aliases: `Jabar`, `JAWA BARAT` => `Jawa Barat`; `JABODETABEK` => `Jabodetabek`; `JAWA TIMUR` => `Jawa Timur`. Preserve source CSV unchanged.
- Detect exact duplicate rows based on all original columns; count/report three known duplicate records. For default totals **include the raw duplicates** for reproducibility; do not silently deduplicate.
- Preserve negative transaction `RTR900001` on 2026-10-10 (net sales -528,000). This is a return, not a malformed positive sale.
- Five rows have blank `salesman` values. Don't erase or invent salespeople.
- Reject malformed required numeric fields and report clear source row diagnostics. On hot reload failure retain the last valid data snapshot.

## Actual reference values (unfiltered raw dataset)
| Metric | Value |
|---|---:|
| CSV data lines | 1,891 |
| Unique invoice numbers | 824 |
| Distinct outlet IDs | 52 |
| Distinct brands | 8 |
| Exact duplicate lines | 3 |
| Blank salesman cells | 5 |
| Negative net sales rows | 1 |
| Raw net sales sum | Rp1,728,036,900 |

Top brand by unfiltered net sales: Kacang Dua Kelinci (Rp740,084,500). Five lowest-ranked outlets by raw net sales: `OUT1003` Rp564,000; `OUT1026` Rp834,000; `OUT1035` Rp1,122,000; `OUT1045` Rp1,158,000; `OUT1042` Rp1,230,000. These are validation references; never hardcode dashboard outputs.

## Telegram report
One human-readable Bahasa Indonesia paragraph; accurate selected period, total net sales, top region and brand, weakest five, and a *cautious* follow-up recommendation. No fabricated causes or trend comparisons unless computed from comparable periods. Copy action always usable, send only after manual click and valid bot configuration.
