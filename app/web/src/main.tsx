import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Pie, PieChart } from "recharts";
import type { analyze, Filters, parseSales } from "../../api/src/sales.js";
import type { report } from "../../api/src/report.js";
import type { telegram } from "../../api/src/telegram.js";
import "./style.css";

gsap.registerPlugin(useGSAP);

type Dashboard = ReturnType<typeof analyze> & {
  summary: ReturnType<typeof report>;
  telegram: ReturnType<typeof telegram>["status"];
  metadata: Pick<
    ReturnType<typeof parseSales>,
    "quality" | "regionOptions" | "brandOptions"
  > & { source: string; updatedAt: string; warning: string | null };
};
const api = "/api/v1";
const number = new Intl.NumberFormat("id-ID");
const percent = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const money = (n: number) => `Rp${number.format(n)}`;
const date = (d: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(d));
const colors = [
  "#C51F2D",
  "#DD4A56",
  "#ED8790",
  "#F3C2C6",
  "#D5D8DD",
  "#AE2434",
  "#B8777E",
  "#88646E",
];
const logo =
  import.meta.env.VITE_BRAND_LOGO ||
  "/assets/brand/dua-kelinci-concept-transparent.svg";
const links = [
  ["dashboard", "Dashboard", "house"],
  ["regions", "Sales by Region", "map"],
  ["brands", "Sales by Brand", "tag"],
  ["outlets", "Outlets", "store"],
  ["settings", "Settings", "info"],
] as const;
type View = (typeof links)[number][0];
const viewFromHash = () =>
  links.find(([id]) => `#${id}` === location.hash)?.[0] ?? "dashboard";
const viewHeaders: Record<View, [string, string]> = {
  dashboard: ["Sales Dashboard", "Dua Kelinci"],
  regions: ["Sales by Region", "Regional contribution and performance"],
  brands: ["Sales by Brand", "Product brand contribution"],
  outlets: ["Outlet Performance", "Find low-volume outlets and plan follow-up"],
  settings: ["Settings", "Local application and Telegram configuration"],
};
function Icon({ name }: { name: string }) {
  return (
    <span
      className="icon"
      aria-hidden="true"
      style={{ maskImage: `url(/assets/icons/${name}.svg)` }}
    />
  );
}
function Charts({ data }: { data: Dashboard }) {
  const { regions, brands, overview } = data;
  const pie = regions.map((r, i) => ({
    ...r,
    fill: colors[i % colors.length],
  }));
  const donut =
    overview.totalNetSales > 0 && regions.every((r) => r.netSales >= 0);
  const max = Math.max(1, ...brands.map((b) => Math.abs(b.netSales)));
  return (
    <div className="pair">
      <section className="panel" id="regions">
        <h2>Sales by Region</h2>
        {!regions.length ? (
          <p>No regions match the selected filters.</p>
        ) : (
          <div className="region-layout">
            {donut ? (
              <div className="donut" aria-hidden="true">
                <PieChart width={168} height={168}>
                  <Pie
                    data={pie}
                    dataKey="netSales"
                    innerRadius={46}
                    outerRadius={83}
                    startAngle={90}
                    endAngle={-270}
                    isAnimationActive={false}
                  />
                </PieChart>
                <div>
                  <small>Total Net Sales</small>
                  <strong>{money(overview.totalNetSales)}</strong>
                </div>
              </div>
            ) : (
              <p>
                Net values shown in the legend. A donut cannot represent
                negative sales or a zero total.
              </p>
            )}
            <ul className="legend">
              {pie.map((r) => (
                <li key={r.region}>
                  <span>
                    <i style={{ background: r.fill }} />
                    {r.region}
                  </span>
                  <span>
                    {overview.totalNetSales
                      ? `${percent.format(r.sharePercent)}%`
                      : "N/A"}
                  </span>
                  <strong>{money(r.netSales)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <section className="panel" id="brands">
        <h2>Sales by Brand</h2>
        {!brands.length ? (
          <p>No brands match the selected filters.</p>
        ) : (
          <ul className="bars">
            {brands.map((b, i) => (
              <li key={b.brand} title={money(b.netSales)}>
                <span>{b.brand}</span>
                <div className="track" aria-hidden="true">
                  <i
                    style={{
                      width: `${(Math.abs(b.netSales) / max) * 100}%`,
                      background: colors[i % colors.length],
                    }}
                  />
                </div>
                <strong>
                  {overview.totalNetSales
                    ? `${percent.format(b.sharePercent)}%`
                    : "N/A"}
                </strong>
                <small>{money(b.netSales)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
function OutletTable({
  outlets,
  detailed = false,
}: {
  outlets: Dashboard["weakest"];
  detailed?: boolean;
}) {
  return (
    <section className="panel" id="outlets">
      <h2>{detailed ? "Five Weakest Outlets" : "5 Weakest Outlets"}</h2>
      <p className="muted">Ranked by lowest net sales value.</p>
      {outlets.length ? (
        <div
          className="table-wrap"
          tabIndex={0}
          aria-label="Lowest net sales by outlet"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Outlet</th>
                {detailed && <th scope="col">Branch</th>}
                <th scope="col">Region</th>
                <th scope="col">Net Sales</th>
              </tr>
            </thead>
            <tbody>
              {outlets.map((o) => (
                <tr key={o.outletId}>
                  <td>
                    <span className="rank">{o.rank}</span>
                  </td>
                  <th scope="row">
                    {o.outletName}
                    <small>{o.outletId}</small>
                  </th>
                  {detailed && <td>{o.branch}</td>}
                  <td>{o.region}</td>
                  <td>{money(o.netSales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No outlets match the selected filters.</p>
      )}
    </section>
  );
}
function DetailView({
  view,
  data,
  connected,
}: {
  view: Exclude<View, "dashboard">;
  data: Dashboard;
  connected: boolean;
}) {
  if (view === "settings")
    return (
      <>
        <section className="panel settings-panel settings-telegram">
          <h2>Telegram integration</h2>
          <p>
            <strong
              className={`settings-badge${data.telegram.configured && data.telegram.enabled ? " settings-badge-ready" : ""}`}
            >
              {!data.telegram.configured
                ? "Not configured"
                : data.telegram.enabled
                  ? "Enabled"
                  : "Disabled"}
            </strong>
          </p>
          <p className="settings-intro">
            Send reports manually once the backend environment variables are
            set.
          </p>
          <dl className="settings-list">
            <div>
              <dt>Bot token</dt>
              <dd>Configured in backend environment only</dd>
            </div>
            <div>
              <dt>Destination chat</dt>
              <dd>Configured in backend environment only</dd>
            </div>
          </dl>
        </section>
        <section className="panel settings-panel settings-refresh">
          <h2>Automatic data refresh</h2>
          <div className="settings-refresh-row">
            <strong
              className={`settings-badge${connected ? " settings-badge-ready" : ""}`}
            >
              {connected ? "Enabled" : "Reconnecting"}
            </strong>
            <p>
              Changes saved to the local CSV trigger backend revalidation and
              dashboard refresh.
            </p>
          </div>
          <p className="muted">
            If the file is temporarily invalid, the backend retains the last
            successfully loaded dataset.
          </p>
        </section>
        <section className="panel settings-panel settings-privacy">
          <h2>Data and privacy</h2>
          <p>
            The CSV is processed locally by the TypeScript backend. No cloud
            database is required.
          </p>
          <p>
            Bot credentials stay on the backend. Never embed tokens in the
            browser or committed source code.
          </p>
          <p>
            Telegram sends only after a deliberate user action. CSV changes
            never trigger automatic messages.
          </p>
        </section>
      </>
    );
  const region = view === "regions";
  const brand = view === "brands";
  const cells = region
    ? [
        ["Total net sales", money(data.overview.totalNetSales)],
        ["Regions", number.format(data.regions.length)],
        ["Top region", data.regions[0]?.region ?? "Not available"],
      ]
    : brand
      ? [
          ["Brand portfolio", number.format(data.brands.length)],
          ["Leading brand", data.brands[0]?.brand ?? "Not available"],
          [
            "Share of sales",
            data.brands.length && data.overview.totalNetSales
              ? `${percent.format(data.brands[0].sharePercent)}%`
              : "Not available",
          ],
        ]
      : [
          ["Active outlets", number.format(data.overview.activeOutletCount)],
          ["Ranking method", "Lowest net sales"],
          ["Current selection", `${data.weakest.length} weakest`],
        ];
  const rows = region
    ? data.regions.map((r) => ({ ...r, name: r.region }))
    : data.brands.map((b) => ({ ...b, name: b.brand }));
  const scale = Math.max(1, ...rows.map((r) => Math.abs(r.netSales)));
  return (
    <>
      <dl className="panel detail-kpis">
        {cells.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {view === "outlets" ? (
        <OutletTable outlets={data.weakest} detailed />
      ) : (
        <section className="panel">
          <h2>{region ? "Regional Performance" : "Net Sales by Brand"}</h2>
          {rows.length ? (
            <ol className="detail-ranking">
              {rows.map((r, i) => (
                <li key={r.name}>
                  <span>
                    {brand && (
                      <span className="rank">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    )}{" "}
                    {r.name}
                  </span>
                  <div className="track" aria-hidden="true">
                    <i
                      style={{
                        width: `${(Math.abs(r.netSales) / scale) * 100}%`,
                        background: i === 0 ? "#C51F2D" : "#D8747C",
                      }}
                    />
                  </div>
                  <strong>{money(r.netSales)}</strong>
                  <span>
                    {data.overview.totalNetSales
                      ? `${percent.format(r.sharePercent)}%`
                      : "N/A"}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p>No results match the selected filters.</p>
          )}
        </section>
      )}
      {region && (
        <section className="panel">
          <h2>Regional notes</h2>
          <ul className="detail-notes">
            <li>
              Region aliases are grouped under one name, such as Jabar and Jawa
              Barat.
            </li>
            <li>Net sales include returns and exact duplicate rows.</li>
            <li>Figures refresh after a valid CSV save.</li>
          </ul>
        </section>
      )}
      {view === "outlets" && (
        <section className="panel">
          <h2>Interpretation</h2>
          <p>
            “Weakest” means lowest net sales for the current filters. It does
            not measure store potential or salesperson performance.
          </p>
        </section>
      )}
    </>
  );
}

function App() {
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<Dashboard>();
  const [revision, refresh] = useState(0);
  const [busy, setBusy] = useState(true);
  const filterLoadingUntil = useRef(0);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [active, setActive] = useState(viewFromHash);
  const [summaryTab, setSummaryTab] = useState(0);
  useEffect(() => {
    const navigate = () => {
      setActive(viewFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  const [logoFailed, setLogoFailed] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const query = new URLSearchParams(filters).toString();
  const invalid = Boolean(
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo,
  );
  const reload = () => refresh((v) => v + 1);
  useEffect(() => {
    const stream = new EventSource(`${api}/events`);
    stream.onopen = () => {
      setConnection(true);
      refresh((v) => v + 1);
    };
    stream.onerror = () => setConnection(false);
    for (const event of ["sales.updated", "sales.load_failed"])
      stream.addEventListener(event, () => refresh((v) => v + 1));
    return () => stream.close();
  }, []);
  useEffect(() => {
    if (invalid) return;
    const controller = new AbortController();
    let loadingTimer: ReturnType<typeof setTimeout> | undefined;
    setBusy(true);
    setError("");
    setFeedback("");
    fetch(`${api}/dashboard?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Dashboard request failed");
        const next: Dashboard = await response.json();
        if (!controller.signal.aborted) setData(next);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Could not load sales data. Use Refresh to retry.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          const remaining = filterLoadingUntil.current - performance.now();
          if (remaining > 0)
            loadingTimer = setTimeout(() => setBusy(false), remaining);
          else setBusy(false);
        }
      });
    return () => {
      controller.abort();
      clearTimeout(loadingTimer);
    };
  }, [query, revision, invalid]);
  function setFilter(key: keyof Filters, value: string) {
    if ((filters[key] ?? "") === value) return;
    filterLoadingUntil.current = performance.now() + 1000;
    setBusy(true);
    setFilters((old) => {
      const next = { ...old };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Summary copied.");
    } catch {
      setFeedback(
        "Clipboard unavailable. Select and copy the paragraph manually.",
      );
    }
  }
  async function send() {
    setSending(true);
    setFeedback("Sending to Telegram…");
    try {
      const response = await fetch(`${api}/telegram/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      if (!response.ok) throw new Error();
      setFeedback("Summary sent to Telegram.");
    } catch {
      setFeedback(
        "Telegram send failed. Check backend configuration and chat permissions.",
      );
    } finally {
      setSending(false);
    }
  }
  const navigation = (
    <nav aria-label="Dashboard sections">
      {links.map(([id, label, icon]) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? "page" : undefined}
          onClick={() => {
            drawer.current?.close();
          }}
        >
          <Icon name={icon} />
          {label}
        </a>
      ))}
    </nav>
  );
  const brand = (
    <div className="logo">
      {logoFailed ? (
        "Dua Kelinci"
      ) : (
        <img src={logo} alt="Dua Kelinci" onError={() => setLogoFailed(true)} />
      )}
    </div>
  );
  const status = (
    <div className="data-status">
      <strong>
        <span
          className={
            data && !data.metadata.warning && connection ? "dot good" : "dot"
          }
        />
        {data?.metadata.warning
          ? "Last valid data"
          : data
            ? "Data ready"
            : "Not loaded"}
      </strong>
      {data && (
        <>
          <small>Source: {data.metadata.source}</small>
          <small>
            Last updated:{" "}
            {new Date(data.metadata.updatedAt).toLocaleString("id-ID")}
          </small>
        </>
      )}
    </div>
  );
  const loading = busy && !invalid;
  const resultsFrame = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const motion = gsap.matchMedia();
      motion.add("(prefers-reduced-motion: no-preference)", () => {
        if (loading) {
          gsap.from(".loading-card", { opacity: 0, y: 6, duration: 0.18 });
          gsap.fromTo(
            ".loading-progress span",
            { xPercent: -100 },
            {
              xPercent: 294,
              duration: 1,
              ease: "none",
              repeat: -1,
            },
          );
        } else if (data && !error && !invalid) {
          gsap.from(".dashboard-results", { opacity: 0, duration: 0.22 });
          gsap.from(".track i", {
            scaleX: 0,
            transformOrigin: "left center",
            duration: 0.35,
            ease: "power2.out",
          });
        }
      });
      return () => motion.revert();
    },
    {
      scope: resultsFrame,
      dependencies: [loading, error, invalid, active],
      revertOnUpdate: true,
    },
  );
  const ready = data && !busy && !invalid && !error;
  return (
    <>
      <aside>
        {brand}
        {navigation}
        {status}
      </aside>
      <dialog ref={drawer} aria-label="Navigation">
        <button onClick={() => drawer.current?.close()} aria-label="Close menu">
          <Icon name="x" />
        </button>
        {brand}
        {navigation}
      </dialog>
      <main id="dashboard">
        <header>
          <div>
            <button
              className="menu"
              onClick={() => drawer.current?.showModal()}
              aria-label="Open menu"
            >
              <Icon name="menu" />
              Menu
            </button>
            <h1>{viewHeaders[active][0]}</h1>
            <p>
              {data && active === "dashboard"
                ? `Penjualan ${date(data.dateFrom)} sampai ${date(data.dateTo)}`
                : viewHeaders[active][1]}
            </p>
          </div>
          <div className="filters">
            <fieldset>
              <legend>
                Reporting period <small>(blank uses dataset dates)</small>
              </legend>
              <input
                aria-label="Start date"
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) => setFilter("dateFrom", e.target.value)}
              />
              <input
                aria-label="End date"
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(e) => setFilter("dateTo", e.target.value)}
              />
            </fieldset>
            {(["region", "brand"] as const).map((key) => {
              const options = data?.metadata[`${key}Options`] ?? [];
              const value = filters[key] ?? "";
              return (
                <select
                  key={key}
                  aria-label={key === "region" ? "Region" : "Brand"}
                  title={
                    value || (key === "region" ? "All Regions" : "All Brands")
                  }
                  value={value}
                  onChange={(e) => setFilter(key, e.target.value)}
                >
                  <option value="">
                    {key === "region" ? "All Regions" : "All Brands"}
                  </option>
                  {value && !options.includes(value) && (
                    <option>{value}</option>
                  )}
                  {options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              );
            })}
            <button
              onClick={reload}
              aria-label="Refresh"
              title="Data refreshes automatically when the CSV file changes"
            >
              <Icon name="refresh-cw" />
            </button>
          </div>
        </header>
        <div role="status">
          {data && !connection && (
            <p className="notice">
              Live updates disconnected. Reconnecting automatically.
            </p>
          )}
        </div>
        {(invalid || error || data?.metadata.warning) && (
          <p role="alert" className="notice warning">
            <Icon name="alert-triangle" />
            {invalid
              ? "Start date must not be after end date."
              : error ||
                `CSV reload failed. Showing last valid data. ${data?.metadata.warning}`}
          </p>
        )}
        <div className="results-frame" ref={resultsFrame}>
          <div role="status" className={loading ? "loading-screen" : undefined}>
            {loading && (
              <div className="loading-card">
                {brand}
                <p>
                  {data
                    ? "Updating sales results…"
                    : "Loading sales dashboard…"}
                </p>
                <div
                  className="loading-progress"
                  role="progressbar"
                  aria-label="Loading sales data"
                >
                  <span />
                </div>
              </div>
            )}
          </div>
          <div
            className="dashboard-results"
            aria-busy={loading}
            inert={loading}
          >
            {data && (
              <>
                {active === "dashboard" ? (
                  <>
                    <div className="metrics">
                      {[
                        [
                          "Total Net Sales",
                          "wallet",
                          money(data.overview.totalNetSales),
                        ],
                        [
                          "Total Invoices",
                          "file-text",
                          number.format(data.overview.uniqueInvoiceCount),
                        ],
                        [
                          "Total Outlets",
                          "store",
                          number.format(data.overview.activeOutletCount),
                        ],
                        [
                          "Total Cartons",
                          "package",
                          number.format(data.overview.totalCartons),
                        ],
                      ].map(([label, icon, value]) => (
                        <div className="panel metric" key={label}>
                          <span className="tile">
                            <Icon name={icon} />
                          </span>
                          <div>
                            <small>{label}</small>
                            <strong>{value}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Charts data={data} />
                    <div className="pair">
                      <OutletTable outlets={data.weakest} />
                      <section className="panel">
                        <h2>
                          <Icon name="send" /> Telegram Summary
                        </h2>
                        <div
                          className="summary-tabs"
                          role="tablist"
                          aria-label="Summary format"
                        >
                          {["Paragraph summary", "Sales brief"].map(
                            (label, index) => (
                              <button
                                key={label}
                                type="button"
                                role="tab"
                                id={`summary-tab-${index}`}
                                aria-controls={`summary-panel-${index}`}
                                aria-selected={summaryTab === index}
                                tabIndex={summaryTab === index ? 0 : -1}
                                onClick={() => setSummaryTab(index)}
                                onKeyDown={(event) => {
                                  const next =
                                    event.key === "Home"
                                      ? 0
                                      : event.key === "End"
                                        ? 1
                                        : ["ArrowLeft", "ArrowRight"].includes(
                                              event.key,
                                            )
                                          ? 1 - index
                                          : null;
                                  if (next === null) return;
                                  event.preventDefault();
                                  setSummaryTab(next);
                                  event.currentTarget.parentElement
                                    ?.querySelectorAll("button")
                                    [next]?.focus();
                                }}
                              >
                                {label}
                              </button>
                            ),
                          )}
                        </div>
                        <div
                          className="summary"
                          lang="id"
                          role="tabpanel"
                          id="summary-panel-0"
                          aria-labelledby="summary-tab-0"
                          hidden={summaryTab !== 0}
                          tabIndex={0}
                        >
                          <p>{data.summary.text}</p>
                        </div>
                        <div
                          className="summary"
                          lang="id"
                          role="tabpanel"
                          id="summary-panel-1"
                          aria-labelledby="summary-tab-1"
                          hidden={summaryTab !== 1}
                          tabIndex={0}
                        >
                          <p>
                            <strong>Periode:</strong> {date(data.dateFrom)}{" "}
                            sampai {date(data.dateTo)}
                          </p>
                          {data.overview.uniqueInvoiceCount ? (
                            <>
                              <ul>
                                <li>
                                  <strong>Penjualan bersih:</strong>{" "}
                                  {money(data.overview.totalNetSales)}
                                </li>
                                <li>
                                  <strong>Wilayah teratas:</strong>{" "}
                                  {data.regions[0].region} (
                                  {money(data.regions[0].netSales)})
                                </li>
                                <li>
                                  <strong>Merek teratas:</strong>{" "}
                                  {data.brands[0].brand} (
                                  {money(data.brands[0].netSales)})
                                </li>
                              </ul>
                              <p>
                                <strong>
                                  Outlet dengan penjualan terendah:
                                </strong>
                              </p>
                              <ol>
                                {data.weakest.map((outlet) => (
                                  <li key={outlet.outletId}>
                                    {outlet.outletName} ({outlet.outletId}):{" "}
                                    {money(outlet.netSales)}
                                  </li>
                                ))}
                              </ol>
                              <p>
                                <strong>Tindak lanjut:</strong> Cek stok dan
                                riwayat kunjungan outlet sebelum menentukan
                                tindakan.
                              </p>
                            </>
                          ) : (
                            <p>
                              Tidak ada transaksi yang sesuai. Coba ubah
                              periode, wilayah, atau merek.
                            </p>
                          )}
                        </div>
                        <div className="actions">
                          <button
                            disabled={!ready}
                            onClick={() => void copy(data.summary.text)}
                          >
                            <Icon name="copy" />
                            Copy Paragraph
                          </button>
                          <button
                            className="primary"
                            disabled={
                              !ready ||
                              !data.telegram.configured ||
                              !data.telegram.enabled ||
                              sending
                            }
                            onClick={() => void send()}
                          >
                            <Icon name="send" />
                            Send to Telegram
                          </button>
                        </div>
                        {data.telegram.reason && (
                          <p className="muted" lang="id">
                            {data.telegram.reason}
                          </p>
                        )}
                        <div role="status">{feedback}</div>
                      </section>
                    </div>
                  </>
                ) : (
                  <DetailView
                    view={active}
                    data={data}
                    connected={connection}
                  />
                )}
                <footer>
                  {status}
                  <span>
                    {number.format(data.metadata.quality.rows)} rows ·{" "}
                    {data.metadata.quality.duplicates} duplicate rows included ·{" "}
                    {data.metadata.quality.missingSalesman} blank salespeople ·{" "}
                    {data.metadata.quality.returns} negative sales rows retained
                  </span>
                </footer>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
