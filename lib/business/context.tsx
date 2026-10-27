"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { listOutlets } from "@/lib/api/business";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import type { Outlet } from "@/lib/api/types";

interface BusinessContextValue {
  outlets: Outlet[];
  outletId: string | null;
  outlet: Outlet | null;
  businessId: string | null;
  setOutletId: (id: string) => void;
  refreshOutlets: () => void;
  loading: boolean;
}

const Ctx = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { has } = usePermissions();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const businessId = session?.business.id ?? null;

  useEffect(() => {
    if (!session) {
      setOutlets([]);
      setOutletIdState(null);
      return;
    }

    const fallback = session.outlet.id ? [session.outlet] : [];
    setOutlets(fallback);
    const stored = typeof window !== "undefined" ? localStorage.getItem("outletId") : null;
    const initial =
      (stored && fallback.some((outlet) => outlet.id === stored) ? stored : null) ??
      session.outlet.id ??
      null;
    setOutletIdState(initial);

    if (!has("outlets.view")) return;
    let cancelled = false;
    setLoading(true);
    listOutlets()
      .then((rows) => {
        if (cancelled || !rows.length) return;
        setOutlets(rows);
        const saved = typeof window !== "undefined" ? localStorage.getItem("outletId") : null;
        const next =
          (saved && rows.some((outlet) => outlet.id === saved) ? saved : null) ??
          (rows.some((outlet) => outlet.id === session.outlet.id) ? session.outlet.id : null) ??
          rows[0].id;
        setOutletIdState(next);
        if (typeof window !== "undefined") localStorage.setItem("outletId", next);
      })
      .catch(() => {
        // The membership may be limited to a single outlet. Keep the session
        // outlet rather than blocking the app on an optional list request.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, has, refreshKey]);

  const setOutletId = (id: string) => {
    setOutletIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("outletId", id);
  };

  const refreshOutlets = () => setRefreshKey((current) => current + 1);

  const value = useMemo<BusinessContextValue>(() => {
    const outlet = outlets.find((entry) => entry.id === outletId) ?? session?.outlet ?? null;
    return { outlets, outletId, outlet, businessId, setOutletId, refreshOutlets, loading };
  }, [outlets, outletId, businessId, session, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBusiness() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      outlets: [],
      outletId: null,
      outlet: null,
      businessId: null,
      setOutletId: () => {},
      refreshOutlets: () => {},
      loading: false,
    } satisfies BusinessContextValue;
  }
  return ctx;
}
