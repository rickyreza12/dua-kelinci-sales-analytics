# Sales comparison

Open **Sales Comparison** in the sidebar. Set the reporting period, then choose a comparison mode, scope, and two selections. The page shows four metrics, a breakdown, and a sales insight. Swap A and B to reverse the comparison.

## What to compare

- Compare two regions for the same brand, or across all brands. For example, compare Sukro sales in Jabodetabek and Jawa Barat.
- Compare two brands in the same region, or across all regions. For example, compare Sukro and Tos Tos in Jabodetabek.

## Expected behavior

Use one shared, inclusive date range for both selections. Show the two net sales totals side by side in rupiah, with the difference labeled as **B minus A**. Show a percentage change relative to A only when A is positive and both selections have matching transactions. Show **No matching transactions** separately from a valid zero total.

Use one backend snapshot for both totals. Apply the same [business rules](business-rules.md) as the dashboard, including region alias normalization, duplicate rows, and negative returns. Keep the selections when the CSV refreshes. Comparison does not change or send the Telegram report.

## Acceptance checks

- Reconcile both comparison modes against the source CSV for the same date range and scope.
- Verify the difference when A leads, B leads, or the totals tie. Check empty results and zero or negative baselines.
- Confirm both selections refresh together after a valid CSV save and retain the last valid results after a malformed save.
