
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready, logout } = useAuth();

  // Keep authentication screens distraction-free.
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  const isAdmin = user?.role === "ADMIN";
  const isOwner = user?.role === "PHARMACY_OWNER";

  const links = isAdmin
    ? [{ href: "/admin", label: "Admin portal" }]
    : isOwner
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/inventory", label: "Inventory" },
          { href: "/pharmacies", label: "Pharmacies" },
          { href: "/risk-monitoring", label: "Risk monitoring" },
        ]
      : [{ href: "/search", label: "Find medicine" }];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/search" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 text-lg font-black text-white">
            M
          </span>
          <span>
            <span className="block text-base font-bold tracking-tight text-slate-900">
              MedFinder
            </span>
            <span className="hidden text-[11px] text-slate-500 sm:block">
              Medicine availability network
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {ready &&
            links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`hidden rounded-lg px-3 py-2 text-sm font-medium transition sm:inline-flex ${
                  pathname === link.href
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            ))}

          {!ready ? (
            <span className="h-9 w-20 animate-pulse rounded-lg bg-slate-100" />
          ) : user ? (
            <>
              <span className="hidden max-w-32 truncate text-sm text-slate-600 md:block">
                {user.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-teal-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
