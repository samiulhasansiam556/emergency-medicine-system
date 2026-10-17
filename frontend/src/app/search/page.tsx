"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { searchMedicine } from "@/lib/api";
import type { NearbyPharmacy } from "@/lib/types";

// Leaflet needs the browser, so skip server rendering for the map.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-500">
      Loading map...
    </div>
  ),
});

const DHAKA = { lat: 23.8103, lng: 90.4125 };

function timeAgo(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day(s) ago`;
}

const STATUS_STYLE = {
  AVAILABLE: "bg-green-100 text-green-800",
  LOW: "bg-amber-100 text-amber-800",
  OUT_OF_STOCK: "bg-red-100 text-red-800",
} as const;

const STATUS_LABEL = {
  AVAILABLE: "Available",
  LOW: "Low stock",
  OUT_OF_STOCK: "Out of stock",
} as const;

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(10);
  const [position, setPosition] = useState(DHAKA);
  const [usingGps, setUsingGps] = useState(false);
  const [results, setResults] = useState<NearbyPharmacy[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Your browser does not support location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUsingGps(true);
        setError("");
      },
      () => setError("Location permission denied. Using Dhaka center instead."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await searchMedicine({
        q: query.trim(),
        lat: position.lat,
        lng: position.lng,
        radiusKm,
      });
      setResults(res.data);
    } catch (err) {
      setResults(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="text-2xl font-bold">Find Emergency Medicine</h1>
      <p className="mt-1 text-sm text-gray-600">
        Search a medicine to see nearby pharmacies that have reported it in stock.
      </p>

      <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 md:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Medicine name, e.g. Napa or Paracetamol"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
        />
        <select
          value={radiusKm}
          onChange={(e) => setRadiusKm(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2"
        >
          {[2, 5, 10, 20, 50].map((r) => (
            <option key={r} value={r}>
              Within {r} km
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={useMyLocation}
          className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"
        >
          {usingGps ? "Location set" : "Use my location"}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {!usingGps && (
        <p className="mt-2 text-xs text-gray-500">
          Using Dhaka city center. Click &quot;Use my location&quot; for accurate results.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {/* Results list */}
        <section className="space-y-3 md:max-h-[560px] md:overflow-y-auto">
          {results === null && !loading && (
            <p className="text-sm text-gray-500">Search for a medicine to begin.</p>
          )}

          {results?.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
              No nearby pharmacy has this medicine in stock. Try a larger radius.
            </p>
          )}

          {results?.map(({ pharmacy, distanceKm, available }) => (
            <article key={pharmacy.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{pharmacy.name}</h2>
                  <p className="text-sm text-gray-600">{pharmacy.address}</p>
                </div>
                <span className="whitespace-nowrap rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  {distanceKm} km
                </span>
              </div>

              <ul className="mt-3 space-y-2">
                {available.map((a) => (
                  <li key={a.medicine._id} className="flex items-center justify-between text-sm">
                    <span>
                      {a.medicine.name}
                      <span className="text-gray-500"> · {a.medicine.dosageForm.toLowerCase()}</span>
                      <span className="block text-xs text-gray-500">
                        Updated {timeAgo(a.minutesSinceUpdate)}
                      </span>
                    </span>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLE[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href={`tel:${pharmacy.phone}`}
                className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                Call {pharmacy.phone}
              </a>
            </article>
          ))}
        </section>

        {/* Map */}
        <section className="h-[360px] md:h-[560px]">
          <MapView center={position} pharmacies={results ?? []} />
        </section>
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Availability is reported by pharmacies and may be out of date. Please call to confirm
        before travelling. This tool does not recommend or prescribe medicines.
      </p>
    </main>
  );
}