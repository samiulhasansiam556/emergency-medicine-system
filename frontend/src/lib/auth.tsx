"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { loginRequest, registerRequest } from "./api";
import type { AuthUser } from "./types";

const STORAGE_KEY = "emm_auth";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  ready: boolean; // false until localStorage has been read
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (body: {
    name: string;
    email: string;
    password: string;
    role: string;
  }) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { token: string; user: AuthUser };
        setToken(parsed.token);
        setUser(parsed.user);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  const save = useCallback((t: string, u: AuthUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, user: u }));
    setToken(t);
    setUser(u);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await loginRequest({ email, password });
      save(res.data.token, res.data.user);
      return res.data.user;
    },
    [save]
  );

  const register = useCallback(
    async (body: { name: string; email: string; password: string; role: string }) => {
      const res = await registerRequest(body);
      save(res.data.token, res.data.user);
      return res.data.user;
    },
    [save]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}