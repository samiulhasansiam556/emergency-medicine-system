
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  getAdminRiskByMedicine,
  type AdminMedicineRisk,
} from "@/lib/api";

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString();
}

export default function AdminRiskPage() {
  const router = useRouter();
  const { user, token, ready } = useAuth();

  const [rows, setRows] = useState<AdminMedicineRisk[]>([]);
  const [asOfDate, setAsOfDate] = useState<string | undefined>();
  const [predictedForDate, setPredictedForDate] = useState<
    string | undefined
  >();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState("20");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!ready) return;

    if (!token || !user) {
      router.replace("/login");
    } else if (user.role !== "ADMIN") {
      router.replace(
        user.role === "PHARMACY_OWNER" ? "/dashboard" : "/search"
      );
    }
  }, [ready, token, user, router]);

  const loadRisk = useCallback(async () => {
    if (!token || user?.role !== "ADMIN") return;

    setLoading(true);
    setError("");

    try {
      const result = await getAdminRiskByMedicine(token, Number(limit));

      setAvailable(result.available);
      setRows(result.data ?? []);
      setAsOfDate(result.asOfDate);
      setPredictedForDate(result.predictedForDate);
      setMessage(result.message ?? "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load medicine risk data."
      );
    } finally {
      setLoading(false);
    }
  }, [token, user, limit]);

  useEffect(() => {
    if (ready && token && user?.role === "ADMIN") {
      void loadRisk();
    }
  }, [ready, token, user, loadRisk]);

  const filteredRows = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;

    return [
      row.medicine.name,
      row.medicine.genericName,
      row.medicine.strength,
      row.medicine.category,
    ].some((value) => value?.toLowerCase().includes(q));
  });

  const totals = rows.reduce(
    (sum, row) => ({
      high: sum.high + row.high,
      medium: sum.medium + row.medium,
      low: sum.low + row.low,
      insufficient: sum.insufficient + row.insufficientData,
    }),
    { high: 0, medium: 0, low: 0, insufficient: 0 }
  );

  if (!ready || !user || user.role !== "ADMIN") {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">
          Checking admin access...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Admin Portal
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Risk Monitoring
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Review medicine-level shortage risk across pharmacies.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
          >
            ← Admin Dashboard
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">High-risk predictions</p>
            <p className="mt-2 text-3xl font-bold text-red-600">
              {totals.high}
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Medium-risk predictions</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">
              {totals.medium}
            </p>
          </div>

          <div className="rounded-xl border border-green-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Low-risk predictions</p>
            <p className="mt-2 text-3xl font-bold text-green-600">
              {totals.low}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Insufficient data</p>
            <p className="mt-2 text-3xl font-bold text-slate-700">
              {totals.insufficient}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">
                Medicine Risk Overview
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Data date: {formatDate(asOfDate)}
                {predictedForDate
                  ? ` · Forecast date: ${formatDate(predictedForDate)}`
                  : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadRisk()}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="my-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicine, generic name or category..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:flex-1"
            />

            <select
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              aria-label="Number of risk records"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
              <option value="50">Top 50</option>
              <option value="100">Top 100</option>
            </select>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Loading risk data...
            </div>
          ) : available === false ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <h3 className="font-semibold text-amber-900">
                Risk data is not available
              </h3>
              <p className="mt-2 text-sm text-amber-800">
                {message ||
                  "No current prediction dataset is available for this report."}
              </p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No matching medicine risk records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Medicine</th>
                    <th className="px-4 py-3">Pharmacy records</th>
                    <th className="px-4 py-3">High</th>
                    <th className="px-4 py-3">Medium</th>
                    <th className="px-4 py-3">Low</th>
                    <th className="px-4 py-3">Insufficient</th>
                    <th className="px-4 py-3">Avg. probability</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.medicine.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-4">
                        <p className="font-semibold">
                          {row.medicine.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.medicine.genericName}
                          {row.medicine.strength
                            ? ` · ${row.medicine.strength}`
                            : ""}
                        </p>
                        {row.medicine.category && (
                          <p className="mt-1 text-xs text-slate-400">
                            {row.medicine.category}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4">{row.pharmacies}</td>

                      <td className="px-4 py-4 font-semibold text-red-600">
                        {row.high}
                      </td>

                      <td className="px-4 py-4 font-semibold text-amber-600">
                        {row.medium}
                      </td>

                      <td className="px-4 py-4 font-semibold text-green-600">
                        {row.low}
                      </td>

                      <td className="px-4 py-4">
                        {row.insufficientData}
                      </td>

                      <td className="px-4 py-4 font-semibold">
                        {percent(row.avgProbability)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs leading-5 text-slate-500">
            These values reflect the available prediction records, not a
            guarantee of actual stock availability. Insufficient-data
            records should not be interpreted as low risk.
          </p>
        </section>
      </div>
    </main>
  );
}
