"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getMyPharmacies, listInventory } from "@/lib/api";
import type { InventoryItem, OwnedPharmacy } from "@/lib/types";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusStyles = {
  AVAILABLE: "bg-emerald-50 text-emerald-700",
  LOW: "bg-amber-50 text-amber-800",
  OUT_OF_STOCK: "bg-rose-50 text-rose-700",
} as const;

export default function OwnerDashboard() {
  const { user, token, ready } = useAuth();
  const router = useRouter();

  const [pharmacies, setPharmacies] = useState<OwnedPharmacy[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [error, setError] = useState("");

  const isOwner = user?.role === "PHARMACY_OWNER";

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role === "ADMIN") {
      router.replace("/admin");
      return;
    }

    if (user.role !== "PHARMACY_OWNER") {
      router.replace("/search");
    }
  }, [ready, user, router]);

  const loadPharmacies = useCallback(async () => {
    if (!token || !isOwner) return;

    setLoadingPharmacies(true);
    setError("");

    try {
      const response = await getMyPharmacies(token);
      setPharmacies(response.data);
      setSelectedId((current) => {
        if (current && response.data.some((p) => p._id === current)) {
          return current;
        }
        return response.data[0]?._id ?? "";
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load your pharmacies."
      );
    } finally {
      setLoadingPharmacies(false);
    }
  }, [token, isOwner]);

  useEffect(() => {
    if (ready && isOwner && token) {
      void loadPharmacies();
    }
  }, [ready, isOwner, token, loadPharmacies]);

  useEffect(() => {
    if (!selectedId) {
      setInventory([]);
      return;
    }

    let cancelled = false;

    async function loadSelectedInventory() {
      setLoadingInventory(true);
      setError("");

      try {
        const response = await listInventory(selectedId);
        if (!cancelled) setInventory(response.data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load this pharmacy's inventory."
          );
          setInventory([]);
        }
      } finally {
        if (!cancelled) setLoadingInventory(false);
      }
    }

    void loadSelectedInventory();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const summary = useMemo(() => {
    return {
      total: inventory.length,
      available: inventory.filter((item) => item.status === "AVAILABLE").length,
      low: inventory.filter((item) => item.status === "LOW").length,
      out: inventory.filter((item) => item.status === "OUT_OF_STOCK").length,
    };
  }, [inventory]);

  const recentItems = useMemo(
    () =>
      [...inventory]
        .sort(
          (a, b) =>
            new Date(b.lastStockUpdatedAt).getTime() -
            new Date(a.lastStockUpdatedAt).getTime()
        )
        .slice(0, 5),
    [inventory]
  );

  if (!ready || !user || user.role !== "PHARMACY_OWNER") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-500">Loading your dashboard...</p>
      </main>
    );
  }

  const selectedPharmacy = pharmacies.find((p) => p._id === selectedId);

  const cards = [
    {
      label: "Inventory items",
      value: summary.total,
      note: "Medicines tracked",
      style: "border-slate-200 bg-white",
      icon: "▤",
    },
    {
      label: "Available",
      value: summary.available,
      note: "Stock above reorder level",
      style: "border-emerald-200 bg-emerald-50/70",
      icon: "✓",
    },
    {
      label: "Low stock",
      value: summary.low,
      note: "Review and plan restocking",
      style: "border-amber-200 bg-amber-50/70",
      icon: "!",
    },
    {
      label: "Out of stock",
      value: summary.out,
      note: "No remaining stock reported",
      style: "border-rose-200 bg-rose-50/70",
      icon: "×",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              MEDFINDER · OWNER PORTAL
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Welcome, {user.name}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Monitor medicine stock and keep pharmacy availability up to date.
            </p>
          </div>

          {pharmacies.length > 0 && (
            <div className="w-full lg:max-w-xs">
              <label
                htmlFor="pharmacy-select"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Selected pharmacy
              </label>
              <select
                id="pharmacy-select"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
              >
                {pharmacies.map((pharmacy) => (
                  <option key={pharmacy._id} value={pharmacy._id}>
                    {pharmacy.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {error}
          </div>
        )}

        {loadingPharmacies ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading your pharmacies...
          </div>
        ) : pharmacies.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-2xl text-teal-800">
              +
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">
              Register your first pharmacy
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Add your pharmacy details before managing stock. You can then
              add medicines and publish reported availability for search users.
            </p>
            <Link
              href="/pharmacies"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Set up a pharmacy
            </Link>
          </section>
        ) : (
          <>
            {selectedPharmacy && (
              <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Pharmacy details
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    {selectedPharmacy.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedPharmacy.address}, {selectedPharmacy.city}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedPharmacy.phone}
                  </p>
                </div>
                <Link
                  href="/pharmacies"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Manage pharmacies
                </Link>
              </section>
            )}

            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Inventory overview
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Current status based on the selected pharmacy&apos;s
                    inventory records.
                  </p>
                </div>
                <Link
                  href="/inventory"
                  className="text-sm font-semibold text-teal-800 hover:text-teal-900"
                >
                  Open inventory →
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => (
                  <article
                    key={card.label}
                    className={`rounded-2xl border p-5 ${card.style}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-600">
                        {card.label}
                      </p>
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-lg font-bold text-slate-700 ring-1 ring-slate-900/5">
                        {card.icon}
                      </span>
                    </div>
                    <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                      {loadingInventory ? "—" : card.value}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{card.note}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      Recently updated stock
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      The latest five inventory updates
                    </p>
                  </div>
                  <Link
                    href="/inventory"
                    className="text-sm font-semibold text-teal-800 hover:underline"
                  >
                    View all
                  </Link>
                </div>

                {loadingInventory ? (
                  <p className="p-5 text-sm text-slate-500">
                    Loading inventory...
                  </p>
                ) : recentItems.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-medium text-slate-800">
                      No inventory records yet
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Add your first medicine to begin tracking stock.
                    </p>
                    <Link
                      href="/inventory"
                      className="mt-4 inline-flex rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                    >
                      Add medicine
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentItems.map((item) => (
                      <div
                        key={item.inventoryId}
                        className="flex items-center justify-between gap-4 px-5 py-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {item.medicine?.name ?? "Unknown medicine"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.medicine?.genericName ?? "Generic name unavailable"}
                            {item.medicine?.strength
                              ? ` · ${item.medicine.strength}`
                              : ""}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Updated {formatDate(item.lastStockUpdatedAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-bold text-slate-900">
                            {item.quantity}
                          </p>
                          <span
                            className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[item.status]}`}
                          >
                            {item.status.replaceAll("_", " ")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <aside className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="font-bold text-slate-900">Quick actions</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Common tasks for managing your pharmacy.
                </p>

                <div className="mt-5 space-y-3">
                  <Link
                    href="/inventory"
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-teal-300 hover:bg-teal-50/50"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Manage inventory
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Add medicines and update stock
                      </span>
                    </span>
                    <span className="text-lg text-teal-800">→</span>
                  </Link>

                  <Link
                    href="/pharmacies"
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-teal-300 hover:bg-teal-50/50"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Pharmacy settings
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Review your pharmacy details
                      </span>
                    </span>
                    <span className="text-lg text-teal-800">→</span>
                  </Link>

                  <Link
                    href="/risk-monitoring"
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-teal-300 hover:bg-teal-50/50"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Shortage risk
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Review medicine shortage predictions
                      </span>
                    </span>
                    <span className="text-lg text-teal-800">→</span>
                  </Link>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    Keep stock information current
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Medicine availability shown to the public depends on
                    pharmacy stock reports. Update quantities after sales,
                    restocking, expiry, or damage.
                  </p>
                </div>
              </aside>
            </section>
          </>
        )}

        <p className="text-xs leading-5 text-slate-400">
          Inventory figures reflect the records returned by the backend.
          Shortage predictions are estimates and should be reviewed alongside
          actual stock and demand.
        </p>
      </div>
    </main>
  );
}
