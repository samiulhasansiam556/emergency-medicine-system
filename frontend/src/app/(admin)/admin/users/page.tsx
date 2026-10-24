
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  getAdminUsers,
  setAdminUserStatus,
} from "@/lib/api";
import type { AdminUser } from "@/lib/api";

type RoleFilter = "" | "USER" | "PHARMACY_OWNER" | "ADMIN";
type StatusFilter = "" | "true" | "false";

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, token, ready, logout } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadUsers = useCallback(async () => {
    if (!token) {
      setError("Session not found. Please log in again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await getAdminUsers(token, {
        page,
        limit,
        search,
        role,
        isActive: status,
      });

      setUsers(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load users."
      );
    } finally {
      setLoading(false);
    }
  }, [token, page, search, role, status]);

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "ADMIN") {
      router.replace(
        user.role === "PHARMACY_OWNER"
          ? "/dashboard"
          : "/search"
      );
      return;
    }

    void loadUsers();
  }, [ready, user, router, loadUsers]);

  async function toggleStatus(target: AdminUser) {
    if (!token) return;

    const nextStatus = !target.isActive;
    const confirmed = window.confirm(
      `${nextStatus ? "Activate" : "Deactivate"} ${target.name}'s account?`
    );

    if (!confirmed) return;

    setBusyId(target._id);
    setError("");

    try {
      await setAdminUserStatus(token, target._id, nextStatus);
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update account status."
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!ready || !user || user.role !== "ADMIN") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Loading user management...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Emergency Medicine System
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              User Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Search accounts and manage access.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/admin")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Admin
            </button>
            <button
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Matching users</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {total}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Current page</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {page} / {totalPages}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="mt-2 truncate text-lg font-bold text-slate-900">
              {user.name}
            </p>
            <p className="truncate text-xs text-slate-500">
              {user.email}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              All Accounts
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Search by name or email, then filter by role or status.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name or email..."
              aria-label="Search users by name or email"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value as RoleFilter);
                setPage(1);
              }}
              aria-label="Filter by role"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="">All roles</option>
              <option value="USER">User</option>
              <option value="PHARMACY_OWNER">Pharmacy Owner</option>
              <option value="ADMIN">Admin</option>
            </select>

            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
              aria-label="Filter by account status"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            <button
              onClick={() => void loadUsers()}
              disabled={loading}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh users"}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Registered</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading && users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      Loading users...
                    </td>
                  </tr>
                )}

                {!loading && users.length === 0 && !error && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                )}

                {users.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.email}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                        {item.role.replaceAll("_", " ")}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString()
                        : "—"}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => void toggleStatus(item)}
                        disabled={
                          busyId === item._id ||
                          (item._id === user.id && item.isActive)
                        }
                        title={
                          item._id === user.id && item.isActive
                            ? "You cannot deactivate your own account"
                            : undefined
                        }
                        className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                          item.isActive
                            ? "border border-red-200 text-red-700 hover:bg-red-50"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {busyId === item._id
                          ? "Updating..."
                          : item.isActive
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <p className="text-sm text-slate-500">
              {total === 0
                ? "Showing 0 users"
                : `Showing ${(page - 1) * limit + 1}–${Math.min(
                    page * limit,
                    total
                  )} of ${total}`}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setPage((current) =>
                    Math.min(totalPages, current + 1)
                  )
                }
                disabled={page >= totalPages || loading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
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
