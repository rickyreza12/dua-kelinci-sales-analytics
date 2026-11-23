# Dua Kelinci Sales Analytics

Requires Node.js 22.13+ and npm. From this directory:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The Express API listens on http://127.0.0.1:3001. For the production build, run `npm run build`, then `npm start` and open http://127.0.0.1:3001.

Date bounds are inclusive. Blank dates use the dataset bounds. The same filters apply to every panel and the Indonesian summary. Ranking uses net sales by outlet ID, not visits or store potential. The dataset retains exact duplicates and negative returns; blank salesman values are counted, not filled in. See [business rules](docs/business-rules.md) for the reconciliation baseline.

## Reload and Telegram

Open [Sales Comparison](docs/sales-comparison.md) in the sidebar for side-by-side region and brand comparisons.

The sidebar opens Dashboard, Region, Brand, Outlets, and Settings views. Filters stay selected as you navigate. Settings shows Telegram and live CSV refresh status without exposing secrets.

To try a reload without editing the original, copy `data/sales_sep_oct_2026.csv` to `data/working-copy.csv`. Copy `.env.example` to `.env`, set `SALES_CSV=data/working-copy.csv`, then start the app. Save a change to the working copy: the dashboard updates automatically and retains its filters. A malformed save shows a warning and keeps the last valid snapshot. The initial file must be valid for startup.

Copy Paragraph works without Telegram. To enable manual sending, follow the [Telegram setup guide](docs/telegram-setup.md). Filters and CSV saves never send reports. Keep this app on loopback; public exposure requires authentication and abuse protection.

The sidebar logo is supplied concept artwork, not an official corporate logo. Replace it in `app/web/public/assets/brand`, or set `VITE_BRAND_LOGO` to a local public asset path for Vite.

## Assessment coverage

| Requirement | Implementation |
| --- | --- |
| Real CSV, validation and data-quality notes | `app/api/src/sales.ts`, original `data/` |
| Sales by region | Analytics and region chart |
| Sales by brand | Analytics and brand bars |
| Five weakest outlets | Stable outlet-ID ranking and table |
| Indonesian Telegram paragraph | `app/api/src/report.ts` and Copy Paragraph |
| Filtered, responsive dashboard | `app/web/src/` and supplied assets |
| Automatic reload with last-good fallback | `dataset.ts`, SSE, browser refetch |
| Optional manual Telegram delivery | `telegram.ts` and local send route |
| Local run, tests, production build | Root npm scripts and source archive |

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Tests reconcile the original data and exercise API filters, SSE on a working copy, and mocked Telegram delivery. `GET /api/v1/dashboard` combines the specified read endpoints into one snapshot with filter options and quality metadata. The [API contract](docs/api/openapi.yaml) lists the individual endpoints.

The dashboard uses the supplied red for hierarchy and actions, pale rose for selection and summary, and neutral panels for comparison. The sidebar, KPI strip, chart pair, and action pair follow the reporting workflow. Inter and tabular figures support scanning; spacing separates groups without heavy borders or motion. Bundled icons identify navigation, metrics, and actions without external requests.
