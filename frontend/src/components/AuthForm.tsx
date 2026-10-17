"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("USER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = isRegister
        ? await register({ name, email, password, role })
        : await login(email, password);

      router.push(user.role === "USER" ? "/search" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500";

  return (
    <main className="mx-auto mt-10 max-w-md p-4">
      <h1 className="text-2xl font-bold">{isRegister ? "Create account" : "Login"}</h1>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        {isRegister && (
          <input
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className={inputClass}
          />
        )}

        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className={inputClass}
        />

        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 characters)"
          className={inputClass}
        />

        {isRegister && (
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            <option value="USER">I am looking for medicine</option>
            <option value="PHARMACY_OWNER">I own / manage a pharmacy</option>
          </select>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Please wait..." : isRegister ? "Register" : "Login"}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        {isRegister ? "Already have an account? " : "No account yet? "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-medium text-blue-600 hover:underline"
        >
          {isRegister ? "Login" : "Register"}
        </Link>
      </p>
    </main>
  );
}