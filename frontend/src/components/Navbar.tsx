"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Navbar() {
  const { user, ready, logout } = useAuth();
  const router = useRouter();

  const isOwner = user?.role === "PHARMACY_OWNER" || user?.role === "ADMIN";

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between p-4">
        {ready && isOwner && (
          <>
            <Link href="/dashboard" className="hover:text-blue-700">
              Inventory
            </Link>
            <Link href="/dashboard/risk" className="hover:text-blue-700">
              Shortage risk
            </Link>
          </>
        )}

        <div className="flex items-center gap-4 text-sm">
          <Link href="/search" className="hover:text-blue-700">
            Search
          </Link>

          {ready && isOwner && (
            <Link href="/dashboard" className="hover:text-blue-700">
              Dashboard
            </Link>
          )}

          {ready && !user && (
            <>
              <Link href="/login" className="hover:text-blue-700">
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
              >
                Register
              </Link>
            </>
          )}

          {ready && user && (
            <>
              <span className="text-gray-600">{user.name}</span>
              <button
                onClick={() => {
                  logout();
                  router.push("/search");
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
