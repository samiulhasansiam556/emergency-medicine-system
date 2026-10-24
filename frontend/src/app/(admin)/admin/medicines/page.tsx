
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  activateAdminMedicine,
  deactivateAdminMedicine,
  getAdminMedicines,
  updateAdminMedicine,
  type AdminMedicine,
} from "@/lib/api";

const PAGE_SIZE = 10;

type MedicineForm = {
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  category: string;
};

const emptyForm: MedicineForm = {
  name: "",
  genericName: "",
  strength: "",
  dosageForm: "",
  manufacturer: "",
  category: "",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function AdminMedicinesPage() {
  const router = useRouter();
  const { user, token, ready } = useAuth();

  const [medicines, setMedicines] = useState<AdminMedicine[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editing, setEditing] = useState<AdminMedicine | null>(null);
  const [form, setForm] = useState<MedicineForm>(emptyForm);
  const [saving, setSaving] = useState(false);

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

  const loadMedicines = useCallback(async () => {
    if (!token || user?.role !== "ADMIN") return;

    setLoading(true);
    setError("");

    try {
      const result = await getAdminMedicines(token, {
        page,
        limit: PAGE_SIZE,
        search,
        isActive: status,
      });

      setMedicines(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load medicines."
      );
    } finally {
      setLoading(false);
    }
  }, [token, user, page, search, status]);

  useEffect(() => {
    if (ready && token && user?.role === "ADMIN") {
      void loadMedicines();
    }
  }, [ready, token, user, loadMedicines]);

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  function startEditing(medicine: AdminMedicine) {
    setEditing(medicine);
    setForm({
      name: medicine.name ?? "",
      genericName: medicine.genericName ?? "",
      strength: medicine.strength ?? "",
      dosageForm: medicine.dosageForm ?? "",
      manufacturer: medicine.manufacturer ?? "",
      category: medicine.category ?? "",
    });
    setError("");
    setNotice("");
  }

  async function saveMedicine(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !editing) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await updateAdminMedicine(token, editing._id, {
        name: form.name.trim(),
        genericName: form.genericName.trim(),
        strength: form.strength.trim(),
        dosageForm: form.dosageForm.trim(),
        manufacturer: form.manufacturer.trim(),
        category: form.category.trim(),
      });

      setEditing(null);
      setNotice("Medicine updated successfully.");
      await loadMedicines();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update medicine."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(medicine: AdminMedicine) {
    if (!token) return;

    const action = medicine.isActive ? "deactivate" : "activate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} "${medicine.name}"?`
    );

    if (!confirmed) return;

    setBusyId(medicine._id);
    setError("");
    setNotice("");

    try {
      if (medicine.isActive) {
        await deactivateAdminMedicine(token, medicine._id);
      } else {
        await activateAdminMedicine(token, medicine._id);
      }

      setNotice(
        `Medicine "${medicine.name}" ${action}d successfully.`
      );
      await loadMedicines();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} medicine.`
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!ready || !user || user.role !== "ADMIN") {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <p className="text-sm text-slate-500">Checking admin access...</p>
      </main>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Admin Portal
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Medicine Management
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Search, edit and manage medicines in the catalog.
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

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Matching medicines</p>
            <p className="mt-2 text-3xl font-bold">{total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Current page</p>
            <p className="mt-2 text-3xl font-bold">{page} / {totalPages}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Page size</p>
            <p className="mt-2 text-3xl font-bold">{PAGE_SIZE}</p>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            {notice}
          </div>
        )}

        {editing && (
          <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Edit Medicine</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update the catalog details below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={saveMedicine} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1.5 text-sm font-medium">
                  Medicine name
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    required
                  />
                </label>

                <label className="space-y-1.5 text-sm font-medium">
                  Generic name
                  <input
                    className={inputClass}
                    value={form.genericName}
                    onChange={(e) =>
                      setForm({ ...form, genericName: e.target.value })
                    }
                    required
                  />
                </label>

                <label className="space-y-1.5 text-sm font-medium">
                  Strength
                  <input
                    className={inputClass}
                    value={form.strength}
                    onChange={(e) =>
                      setForm({ ...form, strength: e.target.value })
                    }
                    required
                  />
                </label>

                <label className="space-y-1.5 text-sm font-medium">
                  Dosage form
                  <input
                    className={inputClass}
                    value={form.dosageForm}
                    onChange={(e) =>
                      setForm({ ...form, dosageForm: e.target.value })
                    }
                    required
                  />
                </label>

                <label className="space-y-1.5 text-sm font-medium">
                  Manufacturer
                  <input
                    className={inputClass}
                    value={form.manufacturer}
                    onChange={(e) =>
                      setForm({ ...form, manufacturer: e.target.value })
                    }
                    required
                  />
                </label>

                <label className="space-y-1.5 text-sm font-medium">
                  Category
                  <input
                    className={inputClass}
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    required
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </section>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row">
            <form
              className="flex flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                applySearch();
              }}
            >
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search medicine or generic name..."
                className={inputClass}
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Search
              </button>
            </form>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className={`${inputClass} lg:max-w-48`}
              aria-label="Filter by medicine status"
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Medicine</th>
                  <th className="px-4 py-3">Strength / Form</th>
                  <th className="px-4 py-3">Manufacturer</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      Loading medicines...
                    </td>
                  </tr>
                ) : medicines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      No medicines found.
                    </td>
                  </tr>
                ) : (
                  medicines.map((medicine) => (
                    <tr key={medicine._id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <p className="font-semibold">{medicine.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {medicine.genericName}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p>{medicine.strength || "—"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {medicine.dosageForm || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-4">{medicine.manufacturer || "—"}</td>
                      <td className="px-4 py-4">{medicine.category || "—"}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            medicine.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {medicine.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(medicine)}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busyId === medicine._id}
                            onClick={() => void toggleStatus(medicine)}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
                              medicine.isActive
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-green-600 hover:bg-green-700"
                            }`}
                          >
                            {busyId === medicine._id
                              ? "Please wait..."
                              : medicine.isActive
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {total === 0
                ? "No results"
                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                    page * PAGE_SIZE,
                    total
                  )} of ${total}`}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
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
