
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  addInventoryRequest,
  getMyPharmacies,
  listInventory,
  searchMedicineCatalog,
  updateStockRequest,
} from "@/lib/api";
import type {
  InventoryItem,
  Medicine,
  OwnedPharmacy,
  StockStatus,
} from "@/lib/types";

const inputClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500";

const buttonClass =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";

const statusStyles: Record<StockStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  LOW: "bg-amber-100 text-amber-800",
  OUT_OF_STOCK: "bg-red-100 text-red-800",
};

const movements = [
  { value: "SALE", label: "Sale" },
  { value: "RESTOCK", label: "Restock" },
  { value: "EXPIRED", label: "Expired" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "ADJUSTMENT", label: "Adjustment (+/-)" },
];

export default function InventoryPage() {
  const { user, token, ready } = useAuth();
  const router = useRouter();

  const [pharmacies, setPharmacies] = useState<OwnedPharmacy[]>([]);
  const [pharmacyId, setPharmacyId] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Medicine[]>([]);
  const [selectedMedicine, setSelectedMedicine] =
    useState<Medicine | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [reorderLevel, setReorderLevel] = useState("20");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (!token || user?.role !== "PHARMACY_OWNER") return;

    setLoading(true);
    setError("");

    try {
      const response = await getMyPharmacies(token);
      setPharmacies(response.data);

      setPharmacyId((current) => {
        if (current && response.data.some((p) => p._id === current)) {
          return current;
        }
        return response.data[0]?._id ?? "";
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load pharmacies."
      );
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  const loadInventory = useCallback(async () => {
    if (!pharmacyId) {
      setInventory([]);
      return;
    }

    try {
      setError("");
      const response = await listInventory(pharmacyId);
      setInventory(response.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load inventory."
      );
    }
  }, [pharmacyId]);

  useEffect(() => {
    if (ready && user?.role === "PHARMACY_OWNER") {
      void loadPharmacies();
    }
  }, [ready, user?.role, loadPharmacies]);

  useEffect(() => {
    if (pharmacyId) {
      void loadInventory();
    } else {
      setInventory([]);
    }
  }, [pharmacyId, loadInventory]);

  async function searchMedicines() {
    if (!query.trim()) {
      setError("Enter a medicine name to search.");
      return;
    }

    setSearching(true);
    setError("");
    setResults([]);
    setSelectedMedicine(null);

    try {
      const response = await searchMedicineCatalog(query.trim());
      setResults(response.data);

      if (response.data.length === 0) {
        setNotice("No matching medicines found in the catalog.");
      } else {
        setNotice("");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Medicine search failed."
      );
    } finally {
      setSearching(false);
    }
  }

  async function addMedicine() {
    if (!token || !pharmacyId || !selectedMedicine) return;

    const qty = Number(quantity);
    const reorder = Number(reorderLevel);

    if (
      !Number.isInteger(qty) ||
      qty < 0 ||
      !Number.isInteger(reorder) ||
      reorder < 0
    ) {
      setError("Quantity and reorder level must be whole numbers of 0 or more.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await addInventoryRequest(token, {
        pharmacyId,
        medicineId: selectedMedicine._id,
        quantity: qty,
        reorderLevel: reorder,
      });

      setSelectedMedicine(null);
      setQuery("");
      setResults([]);
      setQuantity("1");
      setReorderLevel("20");
      setNotice("Medicine added to inventory.");

      await loadInventory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not add medicine."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStock(
    item: InventoryItem,
    movementType: string,
    rawAmount: string
  ) {
    if (!token || !pharmacyId || !item.medicine) return;

    const amount = Number(rawAmount);

    if (!Number.isInteger(amount) || amount === 0) {
      setError("Enter a non-zero whole number.");
      return;
    }

    if (
      movementType !== "ADJUSTMENT" &&
      amount < 0
    ) {
      setError("Enter a positive quantity for this movement.");
      return;
    }

    let quantityChange = amount;

    if (["SALE", "EXPIRED", "DAMAGED"].includes(movementType)) {
      quantityChange = -Math.abs(amount);
    } else if (movementType === "RESTOCK") {
      quantityChange = Math.abs(amount);
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await updateStockRequest(token, {
        pharmacyId,
        medicineId: item.medicine._id,
        movementType,
        quantityChange,
      });

      setNotice("Stock updated successfully.");
      await loadInventory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Stock update failed."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !user || user.role !== "PHARMACY_OWNER") {
    return <main className="p-6 text-sm text-gray-500">Loading inventory...</main>;
  }

  const selectedPharmacy = pharmacies.find((p) => p._id === pharmacyId);

  const availableCount = inventory.filter(
    (item) => item.status === "AVAILABLE"
  ).length;

  const lowCount = inventory.filter(
    (item) => item.status === "LOW"
  ).length;

  const outCount = inventory.filter(
    (item) => item.status === "OUT_OF_STOCK"
  ).length;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header>
        <p className="text-sm font-medium text-blue-600">
          PHARMACY MANAGEMENT
        </p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Inventory Management
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage medicine quantities and keep stock availability accurate.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading your pharmacies...</p>
      ) : pharmacies.length === 0 ? (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold">No pharmacy found</h2>
          <p className="mt-2 text-sm text-gray-600">
            Create a pharmacy from your dashboard before managing its inventory.
          </p>
          <button
            className={`${buttonClass} mt-4`}
            onClick={() => router.push("/dashboard")}
          >
            Go to Dashboard
          </button>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <label htmlFor="pharmacy" className="mb-2 block text-sm font-medium">
              Select pharmacy
            </label>
            <select
              id="pharmacy"
              value={pharmacyId}
              onChange={(event) => setPharmacyId(event.target.value)}
              className={`${inputClass} w-full max-w-lg`}
            >
              {pharmacies.map((pharmacy) => (
                <option key={pharmacy._id} value={pharmacy._id}>
                  {pharmacy.name} — {pharmacy.city}
                </option>
              ))}
            </select>
            {selectedPharmacy && (
              <p className="mt-2 text-sm text-gray-500">
                {selectedPharmacy.address}
              </p>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total medicines", value: inventory.length, style: "bg-blue-50" },
              { label: "Available", value: availableCount, style: "bg-green-50" },
              { label: "Low stock", value: lowCount, style: "bg-amber-50" },
              { label: "Out of stock", value: outCount, style: "bg-red-50" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-xl border border-gray-100 p-5 ${stat.style}`}
              >
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {stat.value}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Current stock</h2>
                <p className="text-sm text-gray-500">
                  {inventory.length} medicine(s) in this pharmacy
                </p>
              </div>
              <button
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                onClick={() => void loadInventory()}
                disabled={saving}
              >
                Refresh stock
              </button>
            </div>

            {inventory.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No inventory items found. Add a medicine below.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="p-3">Medicine</th>
                      <th className="p-3">Stock</th>
                      <th className="p-3">Reorder level</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Last updated</th>
                      <th className="p-3">Stock movement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => (
                      <StockRow
                        key={item.inventoryId}
                        item={item}
                        saving={saving}
                        onUpdate={updateStock}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Add medicine to inventory</h2>
            <p className="mt-1 text-sm text-gray-500">
              Search the existing medicine catalog and select an item.
            </p>

            <form
              className="mt-4 flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void searchMedicines();
              }}
            >
              <input
                className={`${inputClass} flex-1`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Medicine name or generic name"
              />
              <button className={buttonClass} disabled={searching} type="submit">
                {searching ? "Searching..." : "Search medicines"}
              </button>
            </form>

            {results.length > 0 && !selectedMedicine && (
              <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {results.map((medicine) => (
                  <li key={medicine._id}>
                    <button
                      type="button"
                      onClick={() => setSelectedMedicine(medicine)}
                      className="w-full p-3 text-left hover:bg-gray-50"
                    >
                      <span className="font-medium">{medicine.name}</span>
                      <span className="block text-sm text-gray-500">
                        {medicine.genericName} · {medicine.strength} · {medicine.dosageForm}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {selectedMedicine && (
              <div className="mt-4 rounded-lg bg-blue-50 p-4">
                <p className="font-medium">{selectedMedicine.name}</p>
                <p className="text-sm text-gray-600">
                  {selectedMedicine.genericName} · {selectedMedicine.strength}
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Initial quantity
                    <input
                      className={`${inputClass} mt-1 w-full`}
                      type="number"
                      min="0"
                      step="1"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    Reorder level
                    <input
                      className={`${inputClass} mt-1 w-full`}
                      type="number"
                      min="0"
                      step="1"
                      value={reorderLevel}
                      onChange={(event) => setReorderLevel(event.target.value)}
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => void addMedicine()}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Add to inventory"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                    onClick={() => setSelectedMedicine(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function StockRow({
  item,
  saving,
  onUpdate,
}: {
  item: InventoryItem;
  saving: boolean;
  onUpdate: (
    item: InventoryItem,
    movementType: string,
    amount: string
  ) => Promise<void>;
}) {
  const [movement, setMovement] = useState("SALE");
  const [amount, setAmount] = useState("1");

  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="p-3">
        <p className="font-medium">
          {item.medicine?.name ?? "Unknown medicine"}
        </p>
        <p className="text-xs text-gray-500">
          {item.medicine?.genericName} · {item.medicine?.strength}
        </p>
      </td>
      <td className="p-3 font-semibold">{item.quantity}</td>
      <td className="p-3">{item.reorderLevel}</td>
      <td className="p-3">
        <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${statusStyles[item.status]}`}>
          {item.status.replaceAll("_", " ")}
        </span>
      </td>
      <td className="p-3 text-gray-500">
        {item.lastStockUpdatedAt
          ? new Date(item.lastStockUpdatedAt).toLocaleString()
          : "—"}
      </td>
      <td className="p-3">
        <div className="flex min-w-[280px] flex-wrap gap-2">
          <select
            className={inputClass}
            value={movement}
            onChange={(event) => setMovement(event.target.value)}
            aria-label="Stock movement type"
          >
            {movements.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className={`${inputClass} w-20`}
            type="number"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label="Movement quantity"
          />
          <button
            className={buttonClass}
            disabled={saving || !item.medicine}
            onClick={() => void onUpdate(item, movement, amount)}
          >
            Apply
          </button>
        </div>
      </td>
    </tr>
  );
}
