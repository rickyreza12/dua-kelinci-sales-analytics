# Agent Instructions — Dua Kelinci Sales Analytics

## Project goal
Build a small, local-first sales analysis web app with a **TypeScript-only monorepo**. The four business outcomes are (1) net sales by region, (2) net sales by brand, (3) five lowest-revenue outlets, and (4) one concise Indonesian paragraph suitable for Telegram. Deliver runnable code and a short README. **This handoff contains specifications and assets, not the finished app.**

## First read
1. `docs/business-rules.md` (source of truth for calculation semantics)
2. `docs/api/openapi.yaml` (the intended interface contract)
3. `frontend-design.json` (layout, responsive behavior, interactions)
4. `frontend-design-tokens.json` (colors, typography, spacing)
5. `ASSETS.md` (icon and branding provenance)

## Architecture
- Workspace root: `app/web` (React + Vite + TypeScript), `app/api` (Node.js + Express + TypeScript), `packages/contracts` (shared schemas/types), `data` (CSV), `docs`.
- Use npm workspaces. Backend is the only owner of CSV reading, parsing, normalization, aggregations, summary generation, and Telegram sending.
- Organize backend by cohesive modules (`sales`, `outlets`, `reports`, `telegram`) with clear adapters for the CSV reader and Telegram client. Keep business calculations as pure, testable functions.
- All frontend data comes from the backend API. Never independently recompute business totals in React.
- Only implement features the assessment requires plus the agreed CSV hot reload, basic filters, and optional manual Telegram send.

## Engineering principles
- **KISS — Keep It Simple, Stupid:** choose the smallest design that is easy to understand and test.
- **YAGNI — You Aren't Gonna Need It:** no authentication, database, queue, microservices, background jobs, or deployment system without a demonstrated need.
- **DRY — Don't Repeat Yourself:** one canonical rule for normalization, ranking, and summaries; do not invent generic abstractions just to deduplicate two obvious lines.
- **SOLID:** Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion. Use selectively; prefer functions and small explicit boundaries over needless classes.
- **Separation of Concerns:** CSV I/O, parsing, computation, API transport, presentation, and Telegram integration belong in separate modules.
- Favor explicit names and simple control flow. Avoid `any`, broad try/catch without context, silent fallback values, hidden globals, duplicate code, deeply nested conditionals, and speculative interfaces.
- Define concrete error payloads and safe errors; never log credentials or confidential report payloads.
- Use strict TypeScript, ESLint, Prettier, Vitest, and Supertest for endpoint tests.
- A change is done only when `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass from workspace root.

## Source data guarantees
- Never modify `data/sales_sep_oct_2026.csv` in-place. Loaded data is immutable to the app.
- Original CSV: 1,891 data lines, 15 columns, 824 distinct invoice numbers, 52 distinct outlet IDs, 8 brands, 3 exactly duplicate rows, 5 missing salesman cells, 1 negative net-sales return; raw net sales total Rp1,728,036,900. Verify independently.
- Normalize region aliases (`Jabar`, `JAWA BARAT` to `Jawa Barat`; `JABODETABEK` to `Jabodetabek`; `JAWA TIMUR` to `Jawa Timur`) in computed views without editing the file.
- Default analytical totals include exact duplicate rows, and preserve negative return values; report duplicates separately and make that policy explicit.
- Count invoices by unique `invoice_no`. Rank outlets by `outlet_id` and sum net sales; deterministic tie-breaker by outlet ID.

## Operational behavior
- Watch the CSV file on disk with debounced file notifications. Validate an entire replacement before atomically swapping the in-memory snapshot. On an invalid edit, keep the last good snapshot and display a visible warning.
- Use Server-Sent Events (SSE) at `/api/v1/events` for browser refresh notification; preserve active filters. Recalculate the Telegram preview on refresh, but never auto-send.
- Telegram token and chat identifier must be read from backend environment variables only. Sending requires explicit user click and correctly configured permissions; never expose tokens via API, browser bundle, commits, or logs. Keep Copy Summary functional without configuration.
- Treat report text sent by clients as untrusted; server should generate the report for validated filter parameters rather than accept arbitrary text for sending.

## Design and delivery
- Use `docs/frontend-design.json` for the Dashboard overview and the detail-view requirements in `GPEV_IMPLEMENTATION_PROMPT.md` for Region, Brand, Outlets, and read-only Settings. No fake figures or additional screens.
- All charts, labels, and summaries use actual loaded data and Indonesian rupiah formatting.
- Local run must be simple (`npm install`, `npm run dev`); the browser and backend should start together.
- Include `.env.example`, short README, data-quality notes, and tests. No deployed URL is needed.
