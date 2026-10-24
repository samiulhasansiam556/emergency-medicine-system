"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getMyPharmacies, createPharmacyRequest } from "@/lib/api";
import type { OwnedPharmacy } from "@/lib/types";

export default function PharmaciesPage() {
  const router = useRouter();
  const { user, token, ready } = useAuth();

  const [pharmacies, setPharmacies] = useState<OwnedPharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    phone: "",
  });

  const loadPharmacies = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const response = await getMyPharmacies(token);
      setPharmacies(response.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load pharmacies."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "PHARMACY_OWNER") {
      router.replace(user.role === "ADMIN" ? "/admin" : "/search");
      return;
    }

    void loadPharmacies();
  }, [ready, user, router, loadPharmacies]);

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("Please log in again.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createPharmacyRequest(token, {
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        phone: form.phone.trim(),
      });

      setForm({
        name: "",
        address: "",
        city: "",
        phone: "",
      });

      setShowForm(false);
      setSuccess("Pharmacy added successfully.");
      await loadPharmacies();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not add pharmacy."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !user || user.role !== "PHARMACY_OWNER") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading pharmacies...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Owner Portal
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              My Pharmacies
            </h1>
            <p className="mt-2 text-slate-600">
              Manage and review your registered pharmacies.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowForm((current) => !current);
              setError("");
              setSuccess("");
            }}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "+ Add Pharmacy"}
          </button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Pharmacies
            </p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {pharmacies.length}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Account
            </p>
            <p className="mt-3 truncate text-lg font-semibold text-slate-900">
              {user.name}
            </p>
            <p className="mt-1 text-sm text-slate-500">{user.email}</p>
          </section>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            {success}
          </div>
        )}

        {showForm && (
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold text-slate-900">
              Register a Pharmacy
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter the pharmacy details below.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="pharmacy-name"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Pharmacy Name
                  </label>
                  <input
                    id="pharmacy-name"
                    required
                    value={form.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    placeholder="e.g. City Pharmacy"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pharmacy-city"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    City
                  </label>
                  <input
                    id="pharmacy-city"
                    required
                    value={form.city}
                    onChange={(event) =>
                      updateField("city", event.target.value)
                    }
                    placeholder="e.g. Tangail"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="pharmacy-address"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Full Address
                  </label>
                  <textarea
                    id="pharmacy-address"
                    required
                    rows={3}
                    value={form.address}
                    onChange={(event) =>
                      updateField("address", event.target.value)
                    }
                    placeholder="House, road, area, or landmark"
                    className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pharmacy-phone"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Phone Number
                  </label>
                  <input
                    id="pharmacy-phone"
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
                    placeholder="Pharmacy contact number"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Register Pharmacy"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Pharmacy List
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Pharmacies associated with your account.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadPharmacies()}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              Loading pharmacy list...
            </div>
          ) : pharmacies.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className="h-7 w-7"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01M15 14v.01M15 17v.01"
                  />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">
                No pharmacies found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Add your first pharmacy to get started.
              </p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                + Add Your First Pharmacy
              </button>
            </div>
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {pharmacies.map((pharmacy) => (
                <article
                  key={pharmacy._id}
                  className="rounded-xl border border-slate-200 p-5 transition hover:border-blue-300 hover:shadow-sm"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      className="h-6 w-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01"
                      />
                    </svg>
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-slate-900">
                    {pharmacy.name}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {pharmacy.address}
                  </p>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
                    <p>
                      <span className="font-medium text-slate-800">City:</span>{" "}
                      {pharmacy.city}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">Phone:</span>{" "}
                      {pharmacy.phone}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}