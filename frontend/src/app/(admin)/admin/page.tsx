
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getAdminOverview } from "@/lib/api";
import type { AdminOverview } from "@/lib/api";

const adminSections = [
  {
    title: "User Management",
    description:
      "View registered users, search accounts, manage roles and activate or deactivate users.",
    icon: "👥",
    path: "/admin/users",
    color: "bg-blue-50 text-blue-700",
  },
  {
    title: "Pharmacy Management",
    description:
      "Review pharmacies, inspect owner details and activate or deactivate pharmacy listings.",
    icon: "🏥",
    path: "/admin/pharmacies",
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Medicine Management",
    description:
      "Browse medicines, edit medicine information and manage medicine availability.",
    icon: "💊",
    path: "/admin/medicines",
    color: "bg-purple-50 text-purple-700",
  },
  {
    title: "Inventory Overview",
    description:
      "Select a pharmacy and review its stock quantities, availability and low-stock items.",
    icon: "📦",
    path: "/admin/inventory",
    color: "bg-amber-50 text-amber-700",
  },
  {
    title: "Risk Monitoring",
    description:
      "Monitor medicine demand and review stock-out risk information.",
    icon: "📊",
    path: "/admin/risk",
    color: "bg-rose-50 text-rose-700",
  },
  {
    title: "ML Model Management",
    description:
      "Review the active prediction model, model versions and model comparisons.",
    icon: "🤖",
    path: "/admin/models",
    color: "bg-indigo-50 text-indigo-700",
  },
];

export default function AdminPage() {
  const router = useRouter();
  const { user, ready, logout } = useAuth();

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    const storedAuth = localStorage.getItem("emm_auth");

    if (!storedAuth) {
      setError("Authentication token not found. Please log in again.");
      return;
    }

    let accessToken = storedAuth;

    try {
      const parsed = JSON.parse(storedAuth);

      if (parsed && typeof parsed.token === "string") {
        accessToken = parsed.token;
      }
    } catch {
      // The stored value may itself be the token.
    }

    setLoading(true);
    setError("");

    try {
      const response = await getAdminOverview(accessToken);
      setOverview(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load admin statistics."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "ADMIN") {
      router.replace(
        user.role === "PHARMACY_OWNER" ? "/dashboard" : "/search"
      );
      return;
    }

    void loadOverview();
  }, [ready, user, router, loadOverview]);

  if (!ready || !user || user.role !== "ADMIN") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Loading admin portal...
        </p>
      </main>
    );
  }

  const stats = [
    {
      label: "Total Users",
      value: overview?.users.total,
      icon: "👥",
    },
    {
      label: "Pharmacies",
      value: overview
        ? overview.pharmacies.active + overview.pharmacies.inactive
        : undefined,
      icon: "🏥",
    },
    {
      label: "Medicines",
      value: overview?.medicines,
      icon: "💊",
    },
    {
      label: "Inventory Records",
      value: overview?.inventoryItems,
      icon: "📦",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Emergency Medicine System
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Admin Portal
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">
                {user.name}
              </p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome section */}
        <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-blue-900 p-6 text-white sm:p-8">
          <p className="text-sm font-medium text-blue-200">
            SYSTEM OVERVIEW
          </p>

          <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
            Welcome, {user.name}
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
            Manage users, pharmacies, medicines, inventory and
            prediction models from one central workspace.
          </p>

          <div className="mt-5 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
            Administrator access
          </div>
        </section>

        {/* System statistics */}
        <section className="mt-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                System Statistics
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Live summary from your backend.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadOverview()}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <p className="font-semibold">
                Could not load dashboard statistics.
              </p>
              <p className="mt-1">{error}</p>
              <p className="mt-2">
                Check that the backend is running and your admin session is valid.
              </p>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">
                    {stat.label}
                  </p>

                  <span aria-hidden="true" className="text-2xl">
                    {stat.icon}
                  </span>
                </div>

                <p className="mt-4 text-3xl font-bold text-slate-900">
                  {loading && stat.value === undefined
                    ? "..."
                    : stat.value ?? "—"}
                </p>
              </article>
            ))}
          </div>

          {overview?.activeModel && (
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-900">
                Active Risk Prediction Model
              </p>

              <p className="mt-2 text-sm text-blue-800">
                {overview.activeModel.name ?? "ML Model"} · Version{" "}
                {overview.activeModel.version}
              </p>

              {overview.activeModel.trainedUntil && (
                <p className="mt-1 text-xs text-blue-700">
                  Trained until:{" "}
                  {new Date(
                    overview.activeModel.trainedUntil
                  ).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </section>

        {/* All admin feature navigation buttons */}
        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-900">
              Admin Features
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Choose a module to manage that part of the system.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {adminSections.map((section) => (
              <article
                key={section.path}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${section.color}`}
                >
                  <span aria-hidden="true">{section.icon}</span>
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-900">
                  {section.title}
                </h3>

                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                  {section.description}
                </p>

                <button
                  type="button"
                  onClick={() => router.push(section.path)}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Open {section.title}
                  <span aria-hidden="true">→</span>
                </button>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 py-5 text-center text-xs text-slate-500">
          Emergency Medicine System · Admin Portal
        </footer>
      </div>
    </main>
  );
}
