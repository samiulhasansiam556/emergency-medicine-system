
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  activateAdminPharmacy,
  deactivateAdminPharmacy,
  getAdminPharmacies,
  type AdminPharmacy,
} from "@/lib/api";

const PAGE_SIZE = 10;

export default function AdminPharmaciesPage() {
  const router = useRouter();
  const { user, token, ready } = useAuth();

  const [pharmacies, setPharmacies] = useState<AdminPharmacy[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!ready) return;

    if (!user || user.role !== "ADMIN") {
      router.replace(
        user?.role === "PHARMACY_OWNER"
          ? "/dashboard"
          : user?.role === "USER"
            ? "/search"
            : "/login"
      );
    }
  }, [ready, user, router]);

  const loadPharmacies = useCallback(async () => {
    if (!ready || user?.role !== "ADMIN" || !token) return;

    setLoading(true);
    setError("");

    try {
      const result = await getAdminPharmacies(token, {
        page,
        limit: PAGE_SIZE,
        search,
        isActive: status,
      });

      setPharmacies(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load pharmacies."
      );
    } finally {
      setLoading(false);
    }
  }, [ready, user, token, page, search, status]);

  useEffect(() => {
    void loadPharmacies();
  }, [loadPharmacies]);

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function handleActivate(pharmacy: AdminPharmacy) {
    if (!token) {
      setError("Authentication required. Please log in again.");
      return;
    }

    const confirmed = window.confirm(
      `Activate "${pharmacy.name}"?`
    );

    if (!confirmed) return;

    setBusyId(pharmacy._id);
    setError("");
    setNotice("");

    try {
      await activateAdminPharmacy(token, pharmacy._id);

      setNotice(`${pharmacy.name} activated successfully.`);
      await loadPharmacies();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not activate pharmacy."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeactivate(pharmacy: AdminPharmacy) {
    if (!token) {
      setError("Authentication required. Please log in again.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${pharmacy.name}"?`
    );

    if (!confirmed) return;

    setBusyId(pharmacy._id);
    setError("");
    setNotice("");

    try {
      await deactivateAdminPharmacy(token, pharmacy._id);

      setNotice(`${pharmacy.name} deactivated successfully.`);
      await loadPharmacies();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to deactivate pharmacy."
      );
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!ready || !user || user.role !== "ADMIN") {
    return (
      <main className="p-8 text-sm text-slate-500">
        Checking admin access...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="mb-3 text-sm font-medium text-blue-700 hover:underline"
            >
              ← Back to Admin Dashboard
            </button>

            <h1 className="text-3xl font-bold text-slate-900">
              Pharmacy Management
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Review pharmacies and manage their active status.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-5 py-3">
            <p className="text-xs text-slate-500">
              Matching pharmacies
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {total}
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              applySearch();
            }}
          >
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by pharmacy, city, or address..."
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
              aria-label="Filter pharmacy status"
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Search
            </button>
          </form>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {notice && (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              {notice}
            </p>
          )}

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Pharmacy</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Inventory</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      Loading pharmacies...
                    </td>
                  </tr>
                ) : pharmacies.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      No pharmacies found.
                    </td>
                  </tr>
                ) : (
                  pharmacies.map((pharmacy) => (
                    <tr
                      key={pharmacy._id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">
                          {pharmacy.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {pharmacy.address}, {pharmacy.city}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-800">
                          {pharmacy.ownerId?.name ?? "Unknown owner"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {pharmacy.ownerId?.email ?? "—"}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {pharmacy.phone || "—"}
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        {pharmacy.inventoryCount}
                      </td>

                      {/* Current status only */}
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            pharmacy.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {pharmacy.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Action is always the opposite of current status */}
                      <td className="px-4 py-4">
                        {pharmacy.isActive ? (
                          <button
                            type="button"
                            disabled={busyId === pharmacy._id}
                            onClick={() => void handleDeactivate(pharmacy)}
                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyId === pharmacy._id
                              ? "Deactivating..."
                              : "Deactivate"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === pharmacy._id}
                            onClick={() => void handleActivate(pharmacy)}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyId === pharmacy._id
                              ? "Activating..."
                              : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages} · {total} total
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
