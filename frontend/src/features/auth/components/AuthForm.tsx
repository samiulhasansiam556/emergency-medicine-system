
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

type AuthFormProps = {
  mode: "login" | "register";
};

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { login, register } = useAuth();

  const isRegister = mode === "register";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"USER" | "PHARMACY_OWNER">("USER");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (isRegister && name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const user = isRegister
        ? await register({
            name: name.trim(),
            email: normalizedEmail,
            password,
            role,
          })
        : await login(normalizedEmail, password);

      if (user.role === "ADMIN") {
        router.replace("/admin");
      } else if (user.role === "PHARMACY_OWNER") {
        router.replace("/dashboard");
      } else {
        router.replace("/search");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10";

  return (
    <main className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-[#f5f8fa] px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 lg:grid-cols-2">
        <section className="hidden flex-col justify-between bg-[#073b3a] p-10 text-white lg:flex xl:p-12">
          <Link href="/search" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-300 text-lg font-black text-[#073b3a]">
              M
            </span>
            <span>
              <span className="block text-lg font-bold tracking-tight">
                MedFinder
              </span>
              <span className="block text-xs text-teal-100">
                Medicine availability network
              </span>
            </span>
          </Link>

          <div className="my-12">
            <span className="inline-flex rounded-full border border-teal-100/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-teal-100">
              Healthcare access, made easier
            </span>
            <h1 className="mt-6 max-w-md text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Find medicine. Stay informed. Make a difference.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-teal-50/80">
              Discover nearby pharmacies, check reported medicine availability,
              and help keep stock information up to date.
            </p>

            <div className="mt-8 space-y-4 text-sm text-teal-50/90">
              {[
                "Search for medicines by name",
                "Explore nearby pharmacy options",
                "Keep inventory information organized",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-300/15 text-teal-200">
                    ✓
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-teal-100/60">
            Availability information can change. Confirm stock with the pharmacy.
          </p>
        </section>

        <section className="px-5 py-8 sm:px-10 sm:py-10 xl:px-12 xl:py-12">
          <Link
            href="/search"
            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-teal-800 lg:hidden"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 font-black">
              M
            </span>
            MedFinder
          </Link>

          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
              {isRegister ? "Get started" : "Welcome back"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {isRegister ? "Create your account" : "Sign in to MedFinder"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {isRegister
                ? "Choose how you want to use the platform."
                : "Enter your account details to continue."}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div>
                <label
                  htmlFor="full-name"
                  className="text-sm font-semibold text-slate-700"
                >
                  Full name
                </label>
                <input
                  id="full-name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your full name"
                  className={fieldClass}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="text-sm font-semibold text-slate-700"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner1@seed.medfinder.test or admin@seed.medfinder.test "
                className={fieldClass}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="Password"
                  className="text-sm font-semibold text-slate-700"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                >
                  {showPassword ? "Hide password" : "Show password"}
                </button>
              </div>

              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password123!"
                className={fieldClass}
              />
            </div>

            {isRegister && (
              <>
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Enter your password again"
                    className={fieldClass}
                  />
                </div>

                <fieldset>
                  <legend className="text-sm font-semibold text-slate-700">
                    How will you use MedFinder?
                  </legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        role === "USER"
                          ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600/10"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="USER"
                        checked={role === "USER"}
                        onChange={() => setRole("USER")}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold text-slate-900">
                        Medicine seeker
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Find medicines and nearby pharmacies.
                      </span>
                    </label>

                    <label
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        role === "PHARMACY_OWNER"
                          ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600/10"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="PHARMACY_OWNER"
                        checked={role === "PHARMACY_OWNER"}
                        onChange={() => setRole("PHARMACY_OWNER")}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold text-slate-900">
                        Pharmacy owner
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Manage pharmacy stock and inventory.
                      </span>
                    </label>
                  </div>
                </fieldset>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/10 transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-700/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {loading
                ? "Please wait..."
                : isRegister
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-500">
            {isRegister ? "Already have an account?" : "New to MedFinder?"}{" "}
            <Link
              href={isRegister ? "/login" : "/register"}
              className="font-semibold text-teal-700 hover:text-teal-900"
            >
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>

          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            By continuing, you agree to use pharmacy availability information
            responsibly. Always confirm medicine availability directly.
          </p>
        </section>
      </div>
    </main>
  );
}
