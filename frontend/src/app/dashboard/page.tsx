"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  addInventoryRequest,
  createMedicineRequest,
  createPharmacyRequest,
  getMyPharmacies,
  listInventory,
  searchMedicineCatalog,
  updateStockRequest,
} from "@/lib/api";
import type { InventoryItem, Medicine, OwnedPharmacy, StockStatus } from "@/lib/types";

const STATUS_STYLE: Record<StockStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  LOW: "bg-amber-100 text-amber-800",
  OUT_OF_STOCK: "bg-red-100 text-red-800",
};

const STATUS_LABEL: Record<StockStatus, string> = {
  AVAILABLE: "Available",
  LOW: "Low stock",
  OUT_OF_STOCK: "Out of stock",
};

const DOSAGE_FORMS = [
  "TABLET", "CAPSULE", "SYRUP", "SUSPENSION", "INJECTION",
  "CREAM", "OINTMENT", "DROPS", "INHALER", "OTHER",
];

const MOVEMENTS = [
  { value: "SALE", label: "Sale (-)" },
  { value: "RESTOCK", label: "Restock (+)" },
  { value: "EXPIRED", label: "Expired (-)" },
  { value: "DAMAGED", label: "Damaged (-)" },
  { value: "ADJUSTMENT", label: "Adjustment (+/-)" },
];

const inputClass =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500";
const btnClass =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60";

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day(s) ago`;
}

// ---------------------------------------------------------------
// One inventory row with its own stock update controls
// ---------------------------------------------------------------
function InventoryRow({
  item,
  pharmacyId,
  token,
  onChanged,
}: {
  item: InventoryItem;
  pharmacyId: string;
  token: string;
  onChanged: () => void;
}) {
  const [movement, setMovement] = useState("SALE");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function apply() {
    const n = Number(amount);
    if (!item.medicine || !Number.isInteger(n) || n === 0) {
      setError("Enter a whole number (not 0).");
      return;
    }

    // Sale, expired, damaged always reduce stock. Restock always adds.
    let change = n;
    if (["SALE", "EXPIRED", "DAMAGED"].includes(movement)) change = -Math.abs(n);
    if (movement === "RESTOCK") change = Math.abs(n);

    setBusy(true);
    setError("");
    try {
      await updateStockRequest(token, {
        pharmacyId,
        medicineId: item.medicine._id,
        movementType: movement,
        quantityChange: change,
      });
      setAmount("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-gray-200 align-top">
      <td className="py-3 pr-3">
        <div className="font-medium">{item.medicine?.name ?? "Unknown medicine"}</div>
        <div className="text-xs text-gray-500">
          {item.medicine?.genericName} · {item.medicine?.strength}
        </div>
      </td>
      <td className="py-3 pr-3 font-semibold">{item.quantity}</td>
      <td className="py-3 pr-3 text-gray-600">{item.reorderLevel}</td>
      <td className="py-3 pr-3">
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
        <div className="mt-1 text-xs text-gray-500">{timeAgo(item.lastStockUpdatedAt)}</div>
      </td>
      <td className="py-3">
        <div className="flex flex-wrap gap-2">
          <select value={movement} onChange={(e) => setMovement(e.target.value)} className={inputClass}>
            {MOVEMENTS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Qty"
            className={`${inputClass} w-20`}
          />
          <button onClick={apply} disabled={busy} className={btnClass}>
            {busy ? "..." : "Apply"}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------
export default function DashboardPage() {
  const { user, token, ready } = useAuth();
  const router = useRouter();

  const [pharmacies, setPharmacies] = useState<OwnedPharmacy[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // create pharmacy form
  const [pf, setPf] = useState({ name: "", address: "", city: "Dhaka", phone: "", lat: "", lng: "" });

  // add medicine to inventory
  const [medQuery, setMedQuery] = useState("");
  const [medResults, setMedResults] = useState<Medicine[]>([]);
  const [pickedMed, setPickedMed] = useState<Medicine | null>(null);
  const [newQty, setNewQty] = useState("");
  const [newReorder, setNewReorder] = useState("20");

  // new catalog medicine
  const [nm, setNm] = useState({
    name: "", genericName: "", strength: "", dosageForm: "TABLET", category: "",
  });

  const isOwner = user?.role === "PHARMACY_OWNER" || user?.role === "ADMIN";

  // Route protection
  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  const loadPharmacies = useCallback(async () => {
    if (!token) return;
    setLoadingPharmacies(true);
    try {
      const res = await getMyPharmacies(token);
      setPharmacies(res.data);
      setSelectedId((prev) => prev || res.data[0]?._id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load pharmacies.");
    } finally {
      setLoadingPharmacies(false);
    }
  }, [token]);

  const loadInventory = useCallback(async () => {
    if (!selectedId) {
      setInventory([]);
      return;
    }
    try {
      const res = await listInventory(selectedId);
      setInventory(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inventory.");
    }
  }, [selectedId]);

  useEffect(() => {
    if (isOwner) loadPharmacies();
  }, [isOwner, loadPharmacies]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  function flash(message: string) {
    setNotice(message);
    setError("");
    setTimeout(() => setNotice(""), 3000);
  }

  function fail(err: unknown) {
    setNotice("");
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }

  async function handleCreatePharmacy(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      const lat = pf.lat ? Number(pf.lat) : undefined;
      const lng = pf.lng ? Number(pf.lng) : undefined;
      const res = await createPharmacyRequest(token, {
        name: pf.name,
        address: pf.address,
        city: pf.city,
        phone: pf.phone,
        latitude: lat,
        longitude: lng,
      });
      setPf({ name: "", address: "", city: "Dhaka", phone: "", lat: "", lng: "" });
      setSelectedId(res.data._id);
      await loadPharmacies();
      flash("Pharmacy created.");
    } catch (err) {
      fail(err);
    }
  }

  function fillMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        setPf((p) => ({
          ...p,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        })),
      () => setError("Location permission denied.")
    );
  }

  async function handleMedSearch() {
    if (!medQuery.trim()) return;
    try {
      const res = await searchMedicineCatalog(medQuery.trim());
      setMedResults(res.data);
    } catch (err) {
      fail(err);
    }
  }

  async function handleAddInventory() {
    if (!token || !selectedId || !pickedMed) return;
    try {
      await addInventoryRequest(token, {
        pharmacyId: selectedId,
        medicineId: pickedMed._id,
        quantity: Number(newQty),
        reorderLevel: Number(newReorder),
      });
      setPickedMed(null);
      setMedResults([]);
      setMedQuery("");
      setNewQty("");
      await loadInventory();
      flash("Medicine added to your inventory.");
    } catch (err) {
      fail(err);
    }
  }

  async function handleCreateMedicine(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await createMedicineRequest(token, {
        ...nm,
        category: nm.category || undefined,
      });
      setNm({ name: "", genericName: "", strength: "", dosageForm: "TABLET", category: "" });
      setPickedMed(res.data);
      flash("Medicine added to the catalog. Set its quantity above to stock it.");
    } catch (err) {
      fail(err);
    }
  }

  // ---------- Render ----------
  if (!ready || !user) {
    return <main className="p-6 text-sm text-gray-500">Loading...</main>;
  }

  if (!isOwner) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The dashboard is only for pharmacy owners. Register with the
          &quot;I own / manage a pharmacy&quot; option to use it.
        </p>
      </main>
    );
  }

  const selected = pharmacies.find((p) => p._id === selectedId);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Pharmacy Dashboard</h1>
        <p className="text-sm text-gray-600">Keep your stock updated so patients see accurate availability.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}

      {/* Pharmacy select / create */}
      {loadingPharmacies ? (
        <p className="text-sm text-gray-500">Loading pharmacies...</p>
      ) : (
        <>
          {pharmacies.length > 0 && (
            <section className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium">Pharmacy:</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={inputClass}
              >
                {pharmacies.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {selected && <span className="text-sm text-gray-500">{selected.address}</span>}
            </section>
          )}

          <details open={pharmacies.length === 0} className="rounded-xl border border-gray-200 p-4">
            <summary className="cursor-pointer font-semibold">
              {pharmacies.length === 0 ? "Create your pharmacy" : "Add another pharmacy"}
            </summary>
            <form onSubmit={handleCreatePharmacy} className="mt-3 grid gap-3 md:grid-cols-2">
              <input required placeholder="Pharmacy name" value={pf.name}
                onChange={(e) => setPf({ ...pf, name: e.target.value })} className={inputClass} />
              <input required placeholder="Phone" value={pf.phone}
                onChange={(e) => setPf({ ...pf, phone: e.target.value })} className={inputClass} />
              <input required placeholder="Address" value={pf.address}
                onChange={(e) => setPf({ ...pf, address: e.target.value })} className={inputClass} />
              <input required placeholder="City" value={pf.city}
                onChange={(e) => setPf({ ...pf, city: e.target.value })} className={inputClass} />
              <input placeholder="Latitude (e.g. 23.8069)" value={pf.lat}
                onChange={(e) => setPf({ ...pf, lat: e.target.value })} className={inputClass} />
              <input placeholder="Longitude (e.g. 90.3687)" value={pf.lng}
                onChange={(e) => setPf({ ...pf, lng: e.target.value })} className={inputClass} />
              <div className="flex gap-2 md:col-span-2">
                <button type="button" onClick={fillMyLocation}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
                  Use my current location
                </button>
                <button type="submit" className={btnClass}>Create pharmacy</button>
              </div>
              <p className="text-xs text-gray-500 md:col-span-2">
                Latitude and longitude are needed for the pharmacy to show up in nearby search.
              </p>
            </form>
          </details>
        </>
      )}

      {selectedId && (
        <>
          {/* Inventory table */}
          <section className="rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold">Inventory ({inventory.length})</h2>

            {inventory.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">
                No medicines yet. Add one below.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase text-gray-500">
                    <tr>
                      <th className="pb-2">Medicine</th>
                      <th className="pb-2">Stock</th>
                      <th className="pb-2">Reorder at</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Update stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => (
                      <InventoryRow
                        key={item.inventoryId}
                        item={item}
                        pharmacyId={selectedId}
                        token={token!}
                        onChanged={loadInventory}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Add medicine to inventory */}
          <section className="rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold">Add a medicine to this pharmacy</h2>

            <div className="mt-3 flex gap-2">
              <input
                value={medQuery}
                onChange={(e) => setMedQuery(e.target.value)}
                placeholder="Search catalog by name or generic name"
                className={`${inputClass} flex-1`}
              />
              <button onClick={handleMedSearch} className={btnClass}>Search</button>
            </div>

            {medResults.length > 0 && !pickedMed && (
              <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {medResults.map((m) => (
                  <li key={m._id}>
                    <button
                      onClick={() => setPickedMed(m)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {m.name} <span className="text-gray-500">· {m.genericName} · {m.strength}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {medResults.length === 0 && medQuery && !pickedMed && (
              <p className="mt-2 text-xs text-gray-500">
                Not found? Add it to the catalog below.
              </p>
            )}

            {pickedMed && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  {pickedMed.name} ({pickedMed.strength})
                </span>
                <input type="number" min={0} value={newQty} onChange={(e) => setNewQty(e.target.value)}
                  placeholder="Quantity" className={`${inputClass} w-28`} />
                <input type="number" min={0} value={newReorder} onChange={(e) => setNewReorder(e.target.value)}
                  placeholder="Reorder level" className={`${inputClass} w-32`} />
                <button onClick={handleAddInventory} disabled={newQty === ""} className={btnClass}>
                  Add to inventory
                </button>
                <button onClick={() => setPickedMed(null)} className="text-sm text-gray-500 hover:underline">
                  Cancel
                </button>
              </div>
            )}
          </section>

          {/* New catalog medicine */}
          <details className="rounded-xl border border-gray-200 p-4">
            <summary className="cursor-pointer font-semibold">
              Medicine not in the catalog? Add it
            </summary>
            <form onSubmit={handleCreateMedicine} className="mt-3 grid gap-3 md:grid-cols-2">
              <input required placeholder="Brand name (e.g. Napa 500)" value={nm.name}
                onChange={(e) => setNm({ ...nm, name: e.target.value })} className={inputClass} />
              <input required placeholder="Generic name (e.g. Paracetamol)" value={nm.genericName}
                onChange={(e) => setNm({ ...nm, genericName: e.target.value })} className={inputClass} />
              <input required placeholder="Strength (e.g. 500 mg)" value={nm.strength}
                onChange={(e) => setNm({ ...nm, strength: e.target.value })} className={inputClass} />
              <select value={nm.dosageForm}
                onChange={(e) => setNm({ ...nm, dosageForm: e.target.value })} className={inputClass}>
                {DOSAGE_FORMS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <input placeholder="Category (optional)" value={nm.category}
                onChange={(e) => setNm({ ...nm, category: e.target.value })} className={inputClass} />
              <div>
                <button type="submit" className={btnClass}>Add to catalog</button>
              </div>
            </form>
          </details>
        </>
      )}
    </main>
  );
}