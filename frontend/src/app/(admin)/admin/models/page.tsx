
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  getAdminActiveMLModel,
  getAdminMLModelComparison,
  getAdminMLModels,
  type AdminMLModel,
} from "@/lib/api";

type Score = {
  precision: number;
  recall: number;
  f1: number;
  alertRate: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
};

type Comparison = {
  success: boolean;
  available: boolean;
  version?: string;
  message?: string;
  predictionsChecked?: number;
  actualShortageRate?: number;
  mlHigh?: Score;
  mlMediumPlus?: Score;
  thresholdBaseline?: Score;
  byRiskLevel?: Record<
    string,
    { count: number; shortageRate: number }
  >;
  model?: AdminMLModel | null;
};

const panel =
  "rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

function percentage(value?: number) {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(1)}%`;
}

function dateLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString();
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function AdminModelsPage() {
  const router = useRouter();
  const { user, token, ready } = useAuth();

  const [models, setModels] = useState<AdminMLModel[]>([]);
  const [activeModel, setActiveModel] = useState<AdminMLModel | null>(null);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);

  const [loading, setLoading] = useState(true);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [error, setError] = useState("");
  const [comparisonError, setComparisonError] = useState("");

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

  const loadModels = useCallback(async () => {
    if (!token || user?.role !== "ADMIN") return;

    setLoading(true);
    setError("");

    try {
      const [modelResult, activeResult] = await Promise.all([
        getAdminMLModels(token),
        getAdminActiveMLModel(token),
      ]);

      setModels(modelResult.data ?? []);
      setActiveModel(activeResult.data ?? null);

      const activeVersion = activeResult.data?.version;
      const initialVersion =
        selectedVersion ||
        activeVersion ||
        modelResult.data?.[0]?.version ||
        "";

      setSelectedVersion(initialVersion);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load model information."
      );
    } finally {
      setLoading(false);
    }
  }, [token, user, selectedVersion]);

  useEffect(() => {
    if (ready && token && user?.role === "ADMIN") {
      void loadModels();
    }
  }, [ready, token, user, loadModels]);

  const loadComparison = useCallback(async () => {
    if (!token || user?.role !== "ADMIN" || !selectedVersion) {
      setComparison(null);
      return;
    }

    setComparisonLoading(true);
    setComparisonError("");

    try {
      const result = await getAdminMLModelComparison(
        token,
        selectedVersion
      );
      setComparison(result);
    } catch (err) {
      setComparison(null);
      setComparisonError(
        err instanceof Error
          ? err.message
          : "Failed to load model comparison."
      );
    } finally {
      setComparisonLoading(false);
    }
  }, [token, user, selectedVersion]);

  useEffect(() => {
    if (ready && token && user?.role === "ADMIN" && selectedVersion) {
      void loadComparison();
    }
  }, [ready, token, user, selectedVersion, loadComparison]);

  if (!ready || !user || user.role !== "ADMIN") {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">
          Checking admin access...
        </p>
      </main>
    );
  }

  const activeMetrics = activeModel?.metrics;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Admin Portal
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              ML Model Management
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Review model versions, training information and evaluated
              prediction performance.
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

        <section className={panel}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Active Model</h2>
              <p className="mt-1 text-sm text-slate-500">
                Currently selected model reported by the backend.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadModels()}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <p className="py-8 text-sm text-slate-500">
              Loading model information...
            </p>
          ) : activeModel ? (
            <>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-bold">
                  {activeModel.modelName}
                </h3>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Active
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {activeModel.version}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label="Precision"
                  value={percentage(activeMetrics?.precision)}
                />
                <Metric
                  label="Recall"
                  value={percentage(activeMetrics?.recall)}
                />
                <Metric
                  label="F1 score"
                  value={percentage(activeMetrics?.f1)}
                />
                <Metric
                  label="PR AUC"
                  value={percentage(activeMetrics?.prAuc)}
                />
              </div>

              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <p>
                  <span className="text-slate-500">Trained until: </span>
                  <strong>{dateLabel(activeModel.trainedUntil)}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Forecast horizon: </span>
                  <strong>
                    {activeModel.horizonDays !== undefined
                      ? `${activeModel.horizonDays} days`
                      : "—"}
                  </strong>
                </p>
                <p>
                  <span className="text-slate-500">Activated at: </span>
                  <strong>{dateLabel(activeModel.activatedAt)}</strong>
                </p>
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              No active model was returned by the backend.
            </p>
          )}
        </section>

        <section className={panel}>
          <h2 className="text-lg font-bold">Available Model Versions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select a version to inspect its evaluation results.
          </p>

          {loading ? (
            <p className="py-6 text-sm text-slate-500">Loading versions...</p>
          ) : models.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">
              No model versions found.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Version / Model</th>
                    <th className="px-4 py-3">Trained until</th>
                    <th className="px-4 py-3">F1 score</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {models.map((model) => (
                    <tr key={model._id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <p className="font-semibold">{model.version}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {model.modelName}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        {dateLabel(model.trainedUntil)}
                      </td>
                      <td className="px-4 py-4">
                        {percentage(model.metrics?.f1)}
                      </td>
                      <td className="px-4 py-4">
                        {model.isActive ? (
                          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedVersion(model.version)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                        >
                          Compare
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={panel}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Model Performance Comparison</h2>
              <p className="mt-1 text-sm text-slate-500">
                Evaluated predictions for the selected model version.
              </p>
            </div>

            <label className="space-y-1.5 text-sm font-medium">
              Model version
              <select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
                disabled={models.length === 0}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 sm:min-w-52"
              >
                {models.map((model) => (
                  <option key={model._id} value={model.version}>
                    {model.version}
                    {model.isActive ? " (Active)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {comparisonError && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {comparisonError}
            </p>
          )}

          {comparisonLoading ? (
            <p className="py-8 text-sm text-slate-500">
              Loading comparison...
            </p>
          ) : comparison && !comparison.available ? (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">
                Evaluation data not available
              </p>
              <p className="mt-1 text-sm text-amber-800">
                {comparison.message ||
                  "There are no evaluated predictions for this version yet."}
              </p>
            </div>
          ) : comparison?.available ? (
            <>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Metric
                  label="Predictions evaluated"
                  value={String(comparison.predictionsChecked ?? 0)}
                />
                <Metric
                  label="Actual shortage rate"
                  value={percentage(comparison.actualShortageRate)}
                />
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Evaluation method</th>
                      <th className="px-4 py-3">Precision</th>
                      <th className="px-4 py-3">Recall</th>
                      <th className="px-4 py-3">F1</th>
                      <th className="px-4 py-3">Alert rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ["ML — High risk", comparison.mlHigh],
                      ["ML — Medium or High", comparison.mlMediumPlus],
                      ["Threshold baseline", comparison.thresholdBaseline],
                    ].map(([label, score]) => {
                      const item = score as Score | undefined;
                      return (
                        <tr key={label as string}>
                          <td className="px-4 py-4 font-semibold">
                            {label as string}
                          </td>
                          <td className="px-4 py-4">
                            {percentage(item?.precision)}
                          </td>
                          <td className="px-4 py-4">
                            {percentage(item?.recall)}
                          </td>
                          <td className="px-4 py-4 font-semibold">
                            {percentage(item?.f1)}
                          </td>
                          <td className="px-4 py-4">
                            {percentage(item?.alertRate)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {comparison.byRiskLevel &&
                Object.keys(comparison.byRiskLevel).length > 0 && (
                  <div className="mt-6">
                    <h3 className="mb-3 font-semibold">
                      Actual shortage rate by risk level
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {Object.entries(comparison.byRiskLevel).map(
                        ([level, value]) => (
                          <div
                            key={level}
                            className="rounded-lg border border-slate-200 p-4"
                          >
                            <p className="font-semibold">{level}</p>
                            <p className="mt-2 text-sm text-slate-500">
                              Records: {value.count}
                            </p>
                            <p className="mt-1 text-lg font-bold">
                              {percentage(value.shortageRate)}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
            </>
          ) : (
            <p className="py-8 text-sm text-slate-500">
              Select a model version to view its comparison.
            </p>
          )}

          <p className="mt-5 text-xs leading-5 text-slate-500">
            Precision, recall and F1 are calculated from evaluated historical
            predictions. They describe past model performance, not a guarantee
            of future medicine availability.
          </p>
        </section>
      </div>
    </main>
  );
}
