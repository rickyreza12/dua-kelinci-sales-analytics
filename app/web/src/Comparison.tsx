import { useEffect, useState } from "react";
import type { compareSales } from "../../api/src/comparison.js";

type Result = ReturnType<typeof compareSales>;
const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const metrics = [
  ["netSales", "Penjualan Bersih"],
  ["invoices", "Invoice"],
  ["outlets", "Outlet"],
  ["cartons", "Karton"],
] as const;
const format = (key: string, value: number | null) =>
  value === null
    ? "Tidak ada transaksi"
    : key === "netSales"
      ? money(value)
      : value.toLocaleString("id-ID");

export function Comparison({
  regions,
  brands,
  dateFrom,
  dateTo,
  revision,
  invalid,
}: {
  regions: string[];
  brands: string[];
  dateFrom?: string;
  dateTo?: string;
  revision: number;
  invalid: boolean;
}) {
  const [mode, setMode] = useState<"region" | "brand">("region");
  const [a, setA] = useState(regions[0] ?? "");
  const [b, setB] = useState(regions[1] ?? "");
  const [scope, setScope] = useState("");
  const [response, setResponse] = useState<{
    query: string;
    revision: number;
    result: Result | null;
  }>();
  const options = mode === "region" ? regions : brands;
  const scopeOptions = mode === "region" ? brands : regions;
  const query =
    !invalid && a && b && a !== b
      ? new URLSearchParams({
          mode,
          a,
          b,
          ...(scope ? { scope } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
        }).toString()
      : "";
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    fetch(`/api/v1/sales/comparison?${query}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Comparison unavailable");
        const result: Result = await res.json();
        if (!controller.signal.aborted)
          setResponse({ query, revision, result });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResponse({ query, revision, result: null });
      });
    return () => controller.abort();
  }, [query, revision]);
  const current =
    response?.query === query && response.revision === revision
      ? response
      : undefined;
  const result = current?.result;
  const select = (
    label: string,
    value: string,
    change: (value: string) => void,
    values: string[],
    empty: string,
  ) => (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(e) => change(e.target.value)}>
        <option value="">{empty}</option>
        {value && !values.includes(value) && <option>{value}</option>}
        {values.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="comparison">
      <div className="panel comparison-grid comparison-filters">
        <fieldset>
          <legend>Bandingkan berdasarkan</legend>
          <div className="comparison-modes">
            {(["region", "brand"] as const).map((next) => (
              <button
                key={next}
                type="button"
                aria-pressed={mode === next}
                onClick={() => {
                  if (next === mode) return;
                  const choices = next === "region" ? regions : brands;
                  setMode(next);
                  setA(choices[0] ?? "");
                  setB(choices[1] ?? "");
                  setScope("");
                }}
              >
                <span
                  className="icon"
                  aria-hidden="true"
                  style={{
                    maskImage: `url(/assets/icons/${next === "region" ? "map" : "tag"}.svg)`,
                  }}
                />
                {next === "region" ? "Wilayah" : "Merek"}
              </button>
            ))}
          </div>
        </fieldset>
        {select(
          mode === "region" ? "Brand scope" : "Region scope",
          scope,
          setScope,
          scopeOptions,
          mode === "region" ? "All brands" : "All regions",
        )}
        {select(
          `${mode === "region" ? "Wilayah" : "Merek"} A`,
          a,
          setA,
          options,
          "Choose A",
        )}
        <button
          className="comparison-swap"
          aria-label="Tukar A dan B"
          title="Tukar A dan B"
          type="button"
          disabled={!a || !b || a === b}
          onClick={() => {
            setA(b);
            setB(a);
          }}
        >
          <span
            className="icon"
            aria-hidden="true"
            style={{ maskImage: "url(/assets/icons/compare.svg)" }}
          />
        </button>
        {select(
          `${mode === "region" ? "Wilayah" : "Merek"} B`,
          b,
          setB,
          options,
          "Choose B",
        )}
      </div>
      <div role="status">
        {!query ? (
          <p>
            {invalid
              ? "Correct the reporting period to compare sales."
              : "Choose two different values to compare."}
          </p>
        ) : !current ? (
          <p>Comparing sales…</p>
        ) : !result ? (
          <p>Could not compare sales. Use Refresh to retry.</p>
        ) : (
          <>
            <div className="panel comparison-results">
              <div className="comparison-grid comparison-totals">
                {(["a", "b"] as const).map((side) => (
                  <div key={side}>
                    <h2>
                      {result[side].name} <small>{side.toUpperCase()}</small>
                    </h2>
                    <dl>
                      {metrics.map(([key, label]) => (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>{format(key, result[side][key])}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
              {result.difference !== null && (
                <p
                  className="comparison-delta"
                  data-direction={
                    result.difference > 0
                      ? "up"
                      : result.difference < 0
                        ? "down"
                        : "even"
                  }
                >
                  <strong>Selisih penjualan (B − A):</strong>{" "}
                  {money(result.difference)}
                  {result.percentChange !== null &&
                    ` (${result.percentChange.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% dibanding A)`}
                </p>
              )}
            </div>
            <div className="pair comparison-details">
              <section className="panel">
                <h2>Perbandingan Metrik Utama</h2>
                {metrics.map(([key, label]) => {
                  const max = Math.max(
                    1,
                    Math.abs(result.a[key] ?? 0),
                    Math.abs(result.b[key] ?? 0),
                  );
                  return (
                    <div className="comparison-metric" key={key}>
                      <strong>{label}</strong>
                      {(["a", "b"] as const).map((side) => (
                        <div key={side}>
                          <span>{side.toUpperCase()}</span>
                          <div className="track" aria-hidden="true">
                            <i
                              style={{
                                width: `${(100 * Math.abs(result[side][key] ?? 0)) / max}%`,
                              }}
                            />
                          </div>
                          <span>{format(key, result[side][key])}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </section>
              <section className="panel">
                <h2>Penjualan per {mode === "region" ? "Merek" : "Wilayah"}</h2>
                <div
                  className="table-wrap"
                  tabIndex={0}
                  aria-label="Rincian penjualan"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>{mode === "region" ? "Merek" : "Wilayah"}</th>
                        <th>A</th>
                        <th>B</th>
                        <th>B − A</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...new Set(
                          [...result.a.breakdown, ...result.b.breakdown].map(
                            (row) => row.name,
                          ),
                        ),
                      ].map((name) => {
                        const a = result.a.breakdown.find(
                          (row) => row.name === name,
                        )?.netSales;
                        const b = result.b.breakdown.find(
                          (row) => row.name === name,
                        )?.netSales;
                        return (
                          <tr key={name}>
                            <th scope="row">{name}</th>
                            <td>{a === undefined ? "N/A" : money(a)}</td>
                            <td>{b === undefined ? "N/A" : money(b)}</td>
                            <td>
                              {a === undefined || b === undefined
                                ? "N/A"
                                : money(b - a)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
            {result.difference !== null && (
              <section className="panel comparison-insight">
                <h2>Insight</h2>
                <p>
                  {result.difference === 0
                    ? "Kedua pilihan mencatat penjualan bersih yang sama."
                    : `${result.difference > 0 ? result.b.name : result.a.name} mencatat penjualan bersih ${money(Math.abs(result.difference))} lebih tinggi pada periode ini.`}
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </section>
  );
}
