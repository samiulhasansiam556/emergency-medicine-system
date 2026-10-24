"use client";

import { useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { searchMedicine } from "@/lib/api";
import type { NearbyPharmacy } from "@/lib/types";

const MapView = dynamic(
  () => import("@/features/medicine-search/components/MapView"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500">
        Loading map...
      </div>
    ),
  }
);

const DEFAULT_LOCATION = { lat: 23.8103, lng: 90.4125 };

const STATUS: Record<
  "AVAILABLE" | "LOW" | "OUT_OF_STOCK",
  { label: string; className: string }
> = {
  AVAILABLE: {
    label: "Available",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  LOW: {
    label: "Low stock",
    className: "bg-amber-50 text-amber-700 ring-amber-600/20",
  },
  OUT_OF_STOCK: {
    label: "Out of stock",
    className: "bg-rose-50 text-rose-700 ring-rose-600/20",
  },
};

function timeAgo(minutes: number) {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
  return `${Math.floor(minutes / 1440)} day(s) ago`;
}

export default function MedicineSearchPage() {
  const [query, setQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(10);
  const [position, setPosition] = useState(DEFAULT_LOCATION);
  const [usingGps, setUsingGps] = useState(false);
  const [results, setResults] = useState<NearbyPharmacy[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Your browser does not support location services.");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({
          lat: result.coords.latitude,
          lng: result.coords.longitude,
        });
        setUsingGps(true);
        setLocating(false);
      },
      () => {
        setError(
          "Location permission was not granted. You can still search using the default Dhaka location."
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const medicineName = query.trim();
    if (!medicineName) {
      setError("Enter a medicine name to start searching.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await searchMedicine({
        q: medicineName,
        lat: position.lat,
        lng: position.lng,
        radiusKm,
      });

      setResults(response.data);
    } catch (err) {
      setResults(null);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to search right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const pharmacyCount = results?.length ?? 0;
  const medicineCount =
    results?.reduce((total, item) => total + item.available.length, 0) ?? 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 ring-1 ring-teal-700/10">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              MEDFINDER · MEDICINE AVAILABILITY
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Find the medicine you need.
              <span className="block text-teal-700">
                Find a nearby pharmacy.
              </span>
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Search reported medicine availability near you. Compare nearby
              pharmacies and call ahead before making the trip.
            </p>
          </div>

          <form
            onSubmit={handleSearch}
            className="mt-8 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/5 sm:p-4"
          >
            <label
              htmlFor="medicine-query"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              What medicine are you looking for?
            </label>

            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                >
                  <circle
                    cx="10.8"
                    cy="10.8"
                    r="6.8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="m16 16 4.2 4.2"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  id="medicine-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Try Napa, Paracetamol..."
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 lg:min-w-40">
                <span className="text-sm text-slate-600">Radius</span>
                <select
                  aria-label="Search radius"
                  value={radiusKm}
                  onChange={(event) => setRadiusKm(Number(event.target.value))}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none"
                >
                  {[2, 5, 10, 20, 50].map((radius) => (
                    <option key={radius} value={radius}>
                      {radius} km
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                >
                  <path
                    d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <circle
                    cx="12"
                    cy="9"
                    r="2.3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                </svg>
                {locating
                  ? "Locating..."
                  : usingGps
                    ? "Location set"
                    : "Use my location"}
              </button>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-700/20 disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? "Searching..." : "Search medicines"}
                {!loading && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                  >
                    <path
                      d="M5 12h14m-6-6 6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              {usingGps
                ? "Using your device location. Your browser controls location access."
                : "Using Dhaka city centre as the default location. Set your location for more relevant results."}
            </p>
          </form>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {error}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Nearby pharmacies
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {results === null
                ? "Search for a medicine to see availability."
                : `Results within ${radiusKm} km of your selected location.`}
            </p>
          </div>

          {results !== null && (
            <div className="flex gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xl font-bold text-slate-900">
                  {pharmacyCount}
                </p>
                <p className="text-xs text-slate-500">Pharmacies</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xl font-bold text-teal-700">
                  {medicineCount}
                </p>
                <p className="text-xs text-slate-500">Stock records</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4">
            {loading && (
              <div
                role="status"
                className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
              >
                Searching nearby pharmacy stock...
              </div>
            )}

            {!loading && results === null && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-6 w-6"
                  >
                    <path
                      d="M9 3h6m-5 0v5l-5.5 9.2A2.5 2.5 0 0 0 6.6 21h10.8a2.5 2.5 0 0 0 2.1-3.8L14 8V3"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7.5 15h9"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">
                  Start with a medicine name
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Search by brand or generic name to find pharmacies reporting
                  that medicine in stock.
                </p>
              </div>
            )}

            {!loading && results?.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
                <h3 className="font-semibold text-slate-900">
                  No nearby results found
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Try a larger search radius or check the medicine name.
                  Availability may depend on pharmacy stock reports.
                </p>
              </div>
            )}

            {!loading &&
              results?.map(({ pharmacy, distanceKm, available }) => (
                <article
                  key={pharmacy.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02] transition hover:border-slate-300"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                      >
                        <path
                          d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900">
                        {pharmacy.name}
                      </h3>
                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        {pharmacy.address}
                      </p>
                      <p className="mt-2 text-xs font-medium text-teal-800">
                        {distanceKm} km away
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Reported medicine stock
                    </p>

                    <ul className="space-y-3">
                      {available.map((item) => {
                        const status = STATUS[item.status];

                        return (
                          <li
                            key={`${pharmacy.id}-${item.medicine._id}`}
                            className="flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800">
                                {item.medicine.name}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {item.medicine.genericName} ·{" "}
                                {item.medicine.strength} ·{" "}
                                {item.medicine.dosageForm.toLowerCase()}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Updated {timeAgo(item.minutesSinceUpdate)}
                              </p>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <span className="text-xs text-slate-500">
                      Call to confirm availability
                    </span>
                    <a
                      href={`tel:${pharmacy.phone}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-4 w-4"
                      >
                        <path
                          d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-6-6l2-2-2-5Z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Call pharmacy
                    </a>
                  </div>
                </article>
              ))}
          </div>

          <div className="lg:sticky lg:top-24">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Pharmacy map</h3>
              <span className="text-xs text-slate-500">
                {usingGps ? "Your location" : "Dhaka city centre"}
              </span>
            </div>
            <div className="h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:h-[460px] lg:h-[620px]">
              <MapView center={position} pharmacies={results ?? []} />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Map markers show reported pharmacy locations. Confirm the
              medicine is still available by phone before travelling.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Important availability notice
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            Stock information may be delayed or outdated. Always call the
            pharmacy to confirm availability. MedFinder provides availability
            information only; it does not prescribe or recommend treatment.
          </p>
        </div>
      </section>
    </main>
  );
}
