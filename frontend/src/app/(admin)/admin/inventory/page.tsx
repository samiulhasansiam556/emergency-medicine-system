
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getAdminPharmacies } from "@/lib/api";
import { listInventory } from "@/lib/api";
import type { InventoryItem } from "@/lib/types";
import type { AdminPharmacy } from "@/lib/api";

export default function AdminInventoryPage() {
  const { user, token, ready } = useAuth();
  const router = useRouter();

  const [pharmacies, setPharmacies] = useState<AdminPharmacy[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

useEffect(() => {
  if (!ready) return;

  if (!token || !user) {
    router.replace("/login");
    return;
  }

  if (user.role !== "ADMIN") {
    router.replace("/dashboard");
  }
}, [ready, token, user, router]);

  const loadPharmacies = useCallback(async () => {
    if (!token || user?.role !== "ADMIN") return;

    setBusy(true);
    setError("");

    try {
      const response = await getAdminPharmacies(token, {
        page: 1,
        limit: 100,
      });

      const list = response.data ?? [];
      setPharmacies(list);

      setSelectedPharmacy((current) => {
        if (current && list.some((p) => p._id === current)) return current;
        return list[0]?._id ?? "";
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load pharmacies."
      );
    } finally {
      setBusy(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    void loadPharmacies();
  }, [loadPharmacies]);

  const loadInventory = useCallback(async () => {
    if (!selectedPharmacy) {
      setItems([]);
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await listInventory(selectedPharmacy);
      setItems(response.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load inventory."
      );
      setItems([]);
    } finally {
      setBusy(false);
    }
  }, [selectedPharmacy]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const medicine = item.medicine;
      const matchesSearch =
        !query ||
        medicine?.name.toLowerCase().includes(query) ||
        medicine?.genericName.toLowerCase().includes(query) ||
        medicine?.strength.toLowerCase().includes(query);

      const matchesStock =
        stockFilter === "ALL" || item.status === stockFilter;

      return matchesSearch && matchesStock;
    });
  }, [items, search, stockFilter]);

  const lowStock = items.filter((item) => item.status === "LOW").length;
  const outOfStock = items.filter(
    (item) => item.status === "OUT_OF_STOCK"
  ).length;
  const selected = pharmacies.find((p) => p._id === selectedPharmacy);
if (!ready || !user || !token || user.role !== "ADMIN") {
  return <main className="p-8">Loading admin inventory…</main>;
}

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventory Overview</h1>
          <p className="mt-1 text-sm text-gray-500">
            Inspect medicine stock by pharmacy.
          </p>
        </div>

        <Link
          href="/admin"
          className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Back to Dashboard
        </Link>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border bg-white p-4">
        <label
          htmlFor="pharmacy"
          className="mb-2 block text-sm font-medium"
        >
          Select pharmacy
        </label>

        <select
          id="pharmacy"
          value={selectedPharmacy}
          onChange={(event) => setSelectedPharmacy(event.target.value)}
          className="w-full rounded-lg border p-3 md:max-w-xl"
        >
          <option value="">Choose a pharmacy</option>
          {pharmacies.map((pharmacy) => (
            <option key={pharmacy._id} value={pharmacy._id}>
              {pharmacy.name} — {pharmacy.city}
            </option>
          ))}
        </select>

        {selected && (
          <p className="mt-3 text-sm text-gray-500">
            {selected.address}, {selected.city}
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Inventory Records" value={items.length} />
        <Metric
          label="Available"
          value={items.filter((item) => item.status === "AVAILABLE").length}
        />
        <Metric label="Low Stock" value={lowStock} />
        <Metric label="Out of Stock" value={outOfStock} />
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search medicine or strength…"
            className="min-w-0 flex-1 rounded-lg border p-3"
          />

          <select
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value)}
            className="rounded-lg border p-3"
          >
            <option value="ALL">All stock statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="LOW">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
          </select>

          <button
            type="button"
            onClick={() => void loadInventory()}
            disabled={busy || !selectedPharmacy}
            className="rounded-lg border px-4 py-3 text-sm font-medium disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3">Medicine</th>
                <th className="p-3">Strength</th>
                <th className="p-3">Quantity</th>
                <th className="p-3">Reorder Level</th>
                <th className="p-3">Status</th>
                <th className="p-3">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {busy ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Loading inventory…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    {selectedPharmacy
                      ? "No inventory records match your filters."
                      : "Select a pharmacy to view inventory."}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.inventoryId} className="border-b last:border-0">
                    <td className="p-3 font-medium">
                      {item.medicine?.name ?? "Medicine unavailable"}
                      {item.medicine?.genericName && (
                        <div className="text-xs text-gray-500">
                          {item.medicine.genericName}
                        </div>
                      )}
                    </td>
                    <td className="p-3">{item.medicine?.strength ?? "—"}</td>
                    <td className="p-3 font-semibold">{item.quantity}</td>
                    <td className="p-3">{item.reorderLevel}</td>
                    <td className="p-3">
                      <StockBadge status={item.status} />
                    </td>
                    <td className="p-3 text-gray-500">
                      {item.lastStockUpdatedAt
                        ? new Date(item.lastStockUpdatedAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">
          Showing {filteredItems.length} of {items.length} records for the
          selected pharmacy.
        </p>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function StockBadge({ status }: { status: InventoryItem["status"] }) {
  const styles: Record<InventoryItem["status"], string> = {
    AVAILABLE: "bg-green-100 text-green-800",
    LOW: "bg-amber-100 text-amber-800",
    OUT_OF_STOCK: "bg-red-100 text-red-800",
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
