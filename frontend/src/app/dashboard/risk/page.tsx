"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getMyPharmacies, getRiskList, getRiskSummary } from "@/lib/api";
import type { OwnedPharmacy, RiskLevel, RiskList, RiskSummary } from "@/lib/types";

const PAGE_SIZE = 25;

const LEVELS: { level: RiskLevel; label: string; card: string; ring: string; badge: string; bar: string }[] = [
  { level: "HIGH", label: "High risk", card: "border-red-200 bg-red-50", ring: "ring-red-400", badge: "bg-red-100 text-red-800", bar: "bg-red-500" },
  { level: "MEDIUM", label: "Medium risk", card: "border-amber-200 bg-amber-50", ring: "ring-amber-400", badge: "bg-amber-100 text-amber-800", bar: "bg-amber-500" },
  { level: "LOW", label: "Low risk", card: "border-green-200 bg-green-50", ring: "ring-green-400", badge: "bg-green-100 text-green-800", bar: "bg-green-500" },
  { level: "INSUFFICIENT_DATA", label: "Not enough data", card: "border-gray-200 bg-gray-50", ring: "ring-gray-400", badge: "bg-gray-100 text-gray-700", bar: "bg-gray-400" },
];

const STYLE = Object.fromEntries(LEVELS.map((l) => [l.level, l])) as Record<RiskLevel, (typeof LEVELS)[number]>;

const inputClass =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500";

function formatDay(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDaysLeft(days: number | null): string {
  if (days === null) return "-";
  if (days < 1) return "Under 1 day";
  if (days >= 30) return "30+ days";
  return `${days.toFixed(1)} days`;
}

export default function RiskPage() {
  const { user, token, ready } = useAuth();
  const router = useRouter();

  const [pharmacies, setPharmacies] = useState<OwnedPharmacy[]>([]);
  const [pharmacyId, setPharmacyId] = useState("");
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [list, setList] = useState<RiskList | null>(null);

  const [level, setLevel] = useState<RiskLevel | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"risk" | "days">("risk");
  const [page, setPage] = useState(1);

  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");

  const isOwner = user?.role === "PHARMACY_OWNER" || user?.role === "ADMIN";

  // Send visitors who are not logged in to the login page.
  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  // Wait until the owner stops typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // The owner's pharmacies.
  useEffect(() => {
    if (!token || !isOwner) return;
    let cancelled = false;

    getMyPharmacies(token)
      .then((res) => {
        if (cancelled) return;
        setPharmacies(res.data);
        setPharmacyId((prev) => prev || res.data[0]?._id || "");
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load pharmacies."));

    return () => {
      cancelled = true;
    };
  }, [token, isOwner]);

  // Summary cards.
  useEffect(() => {
    if (!token || !pharmacyId) return;
    let cancelled = false;

    getRiskSummary(token, pharmacyId)
      .then((res) => !cancelled && setSummary(res))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load summary."));

    return () => {
      cancelled = true;
    };
  }, [token, pharmacyId]);

  // The table.
  useEffect(() => {
    if (!token || !pharmacyId) return;
    let cancelled = false;
    setLoadingList(true);

    getRiskList(token, {
      pharmacyId,
      level: level || undefined,
      search: search || undefined,
      sort,
      page,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return;
        setList(res);
        setError("");
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load predictions."))
      .finally(() => !cancelled && setLoadingList(false));

    return () => {
      cancelled = true;
    };
  }, [token, pharmacyId, level, search, sort, page]);

  function chooseLevel(next: RiskLevel) {
    setLevel((current) => (current === next ? "" : next));
    setPage(1);
  }

  if (!ready || !user) {
    return <main className="p-6 text-sm text-gray-500">Loading...</main>;
  }

  if (!isOwner) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Shortage risk is only available to pharmacy owners.
        </p>
      </main>
    );
  }

  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.limit)) : 1;
  const noPredictions = summary !== null && !summary.available;
  const metrics = summary?.model?.metrics;

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Shortage Risk</h1>
          <p className="text-sm text-gray-600">
            Which medicines may run out in the next 3 days.
          </p>
        </div>

        {pharmacies.length > 0 && (
          <select
            value={pharmacyId}
            onChange={(e) => {
              setPharmacyId(e.target.value);
              setPage(1);
              setLevel("");
            }}
            className={inputClass}
          >
            {pharmacies.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {pharmacies.length === 0 && !error && (
        <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
          Create a pharmacy and add medicines on the Inventory page first.
        </p>
      )}

      {noPredictions && (
        <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
          No predictions yet for this pharmacy. Predictions are generated once a day from your
          stock history.
        </p>
      )}

      {summary?.available && (
        <>
          <p className="text-sm text-gray-600">
            Based on stock data up to <strong>{formatDay(summary.asOfDate)}</strong>, predicting
            until <strong>{formatDay(summary.predictedForDate)}</strong>
            {summary.model?.name && (
              <>
                {" "}
                · {summary.model.name}
                {summary.model.trainedUntil && `, trained on data up to ${formatDay(summary.model.trainedUntil)}`}
              </>
            )}
          </p>

          {/* Summary cards: click one to filter the table */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {LEVELS.map((l) => (
              <button
                key={l.level}
                onClick={() => chooseLevel(l.level)}
                className={`rounded-xl border p-4 text-left transition ${l.card} ${
                  level === l.level ? `ring-2 ${l.ring}` : "hover:brightness-95"
                }`}
              >
                <div className="text-3xl font-bold">{summary.counts[l.level]}</div>
                <div className="mt-1 text-sm text-gray-700">{l.label}</div>
              </button>
            ))}
          </section>

          {/* AI vs the usual reorder-level rule */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
            A simple reorder-level rule would raise <strong>{summary.baselineAlerts}</strong> alerts
            for this pharmacy. The AI marks <strong>{summary.counts.HIGH}</strong> as high risk
            and <strong>{summary.counts.MEDIUM}</strong> as medium, so you can focus on the
            medicines most likely to run out.
            {metrics && (
              <span className="mt-1 block text-xs text-gray-500">
                On days the model had not seen: {Math.round(metrics.precision * 100)}% of high-risk
                alerts were real shortages, and {Math.round(metrics.recall * 100)}% of real shortages
                were caught.
              </span>
            )}
          </section>
        </>
      )}

      {summary?.available && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search medicine name"
              className={`${inputClass} w-64`}
            />
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as "risk" | "days");
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="risk">Sort: highest risk first</option>
              <option value="days">Sort: running out soonest</option>
            </select>
            {level && (
              <button onClick={() => setLevel("")} className="text-sm text-blue-600 hover:underline">
                Clear filter: {STYLE[level].label}
              </button>
            )}
            <span className="ml-auto text-sm text-gray-500">
              {list ? `${list.total} medicines` : ""}
            </span>
          </div>

          <div className={`overflow-x-auto rounded-xl border border-gray-200 ${loadingList ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Medicine</th>
                  <th className="px-3 py-2">Risk</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2">Demand / day</th>
                  <th className="px-3 py-2">Stock lasts</th>
                  <th className="px-3 py-2">Why</th>
                </tr>
              </thead>
              <tbody>
                {list?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                      No medicines match.
                    </td>
                  </tr>
                )}

                {list?.data.map((item) => {
                  const style = STYLE[item.riskLevel];
                  const trendUp = item.demandTrend !== null && item.demandTrend >= 1.15;
                  const trendDown = item.demandTrend !== null && item.demandTrend <= 0.85;

                  return (
                    <tr key={item.id} className="border-t border-gray-100 align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium">{item.medicine?.name ?? "Unknown medicine"}</div>
                        <div className="text-xs text-gray-500">
                          {item.medicine?.genericName} · {item.medicine?.strength}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${style.badge}`}>
                          {style.label}
                        </span>
                        {item.probability !== null && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-gray-200">
                              <div
                                className={`h-1.5 rounded-full ${style.bar}`}
                                style={{ width: `${Math.round(item.probability * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {Math.round(item.probability * 100)}%
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {item.stockEnd ?? "-"}
                        {item.reorderLevel !== null && (
                          <div className="text-xs text-gray-500">reorder at {item.reorderLevel}</div>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {item.avgDemand7d !== null ? item.avgDemand7d.toFixed(1) : "-"}
                        {trendUp && item.demandTrend !== null && (
                          <div className="text-xs text-red-600">
                            up {Math.round((item.demandTrend - 1) * 100)}%
                          </div>
                        )}
                        {trendDown && item.demandTrend !== null && (
                          <div className="text-xs text-green-600">
                            down {Math.round((1 - item.demandTrend) * 100)}%
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3">{formatDaysLeft(item.daysOfStockLeft)}</td>

                      <td className="px-3 py-3 text-xs text-gray-600">
                        {item.riskLevel === "INSUFFICIENT_DATA" ? (
                          "Not enough stock history yet"
                        ) : item.reasons.length > 0 ? (
                          <ul className="list-disc space-y-0.5 pl-4">
                            {item.reasons.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      <p className="text-xs text-gray-500">
        Risk is the estimated chance that a medicine runs out within the next 3 days, based on
        your recent sales and stock. It is an estimate to help you plan orders, not a certainty.
        The reasons listed are the main signals behind each estimate.
      </p>
    </main>
  );
}