"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  completeGoogleSignIn,
  login as apiLogin,
  logout as apiLogout,
  me as apiMe,
} from "@/lib/api/auth";
import { getAccessToken, setAccessToken, UNAUTHORIZED_EVENT } from "@/lib/api/client";
import type { Session } from "@/lib/api/types";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    apiMe()
      .then((next) => {
        if (!cancelled) setSession(next);
      })
      .catch(() => {
        if (!cancelled) {
          setAccessToken(null);
          setSession(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A revoked or expired bearer token clears the session; AppShell then sends
  // the member back to /login with a return path.
  useEffect(() => {
    const onUnauthorized = () => {
      queryClient.clear();
      setSession(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);

    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [queryClient]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      queryClient.clear();
      setAccessToken(null);
      const next = await apiLogin(email, password);
      setSession(next);
    },
    [queryClient]
  );

  const signInWithGoogle = useCallback(
    async (code: string) => {
      queryClient.clear();
      setAccessToken(null);
      const next = await completeGoogleSignIn(code);
      setSession(next);
    },
    [queryClient]
  );

  const signOut = useCallback(async () => {
    await apiLogout().catch(() => {});
    queryClient.clear();
    setSession(null);
  }, [queryClient]);

  const refresh = useCallback(async () => {
    const next = await apiMe();
    setSession(next);
  }, []);

  const value = useMemo(
    () => ({ session, loading, signIn, signInWithGoogle, signOut, refresh }),
    [session, loading, signIn, signInWithGoogle, signOut, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

export function usePermissions() {
  const { session } = useAuth();
  const permissions = React.useMemo(() => session?.permissions ?? [], [session]);
  const has = useCallback(
    (permission: string) => permissions.includes("*") || permissions.includes(permission),
    [permissions]
  );
  return useMemo(() => ({ permissions, has }), [permissions, has]);
}
