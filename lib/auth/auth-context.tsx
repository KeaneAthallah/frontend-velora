"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { login as apiLogin, logout as apiLogout, me as apiMe } from "@/lib/api/auth";
import { getAccessToken, setAccessToken } from "@/lib/api/client";
import type { Session } from "@/lib/api/types";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      const id = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(id);
    }
    let cancelled = false;
    apiMe()
      .then((s) => { if (!cancelled) setSession(s); })
      .catch(() => { if (!cancelled) { setAccessToken(null); setSession(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const signIn = async (email: string, password: string) => {
    setAccessToken(null);
    const s = await apiLogin(email, password);
    setSession(s);
  };

  const signOut = async () => {
    await apiLogout().catch(() => {});
    setSession(null);
  };

  return <AuthContext.Provider value={{ session, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) return { session: null, loading: false, signIn: async () => {}, signOut: async () => {} } as any;
  return ctx;
}

export function usePermissions() {
  const { session } = useAuth();
  const perms = session?.permissions ?? [];
  const has = (p: string) => perms.includes("*") || perms.includes(p);
  return { permissions: perms, has };
}
