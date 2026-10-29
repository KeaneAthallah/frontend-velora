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
  /** The outlet list request finished (successfully or not). */
  outletsChecked: boolean;
  /** The outlet list request succeeded, so `outlets` is authoritative. */
  outletsLoaded: boolean;
}

const Ctx = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { has } = usePermissions();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [outletsChecked, setOutletsChecked] = useState(false);
  const [outletsLoaded, setOutletsLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const businessId = session?.business.id ?? null;

  useEffect(() => {
    if (!session) {
      setOutlets([]);
      setOutletIdState(null);
      setOutletsChecked(false);
      setOutletsLoaded(false);
      return;
    }

    const fallback = session.outlet.id ? [session.outlet] : [];
    setOutlets(fallback);
    setOutletsChecked(false);
    setOutletsLoaded(false);
    const stored = typeof window !== "undefined" ? localStorage.getItem("outletId") : null;
    const initial =
      (stored && fallback.some((outlet) => outlet.id === stored) ? stored : null) ??
      session.outlet.id ??
      null;
    setOutletIdState(initial);

    if (!has("outlets.view")) {
      // Nothing to verify without permission; treat the check as settled so the
      // app does not wait on a request that will never run.
      setOutletsChecked(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listOutlets()
      .then((rows) => {
        if (cancelled) return;
        setOutletsLoaded(true);
        if (!rows.length) {
          // The business exists but has no outlets yet.
          setOutlets([]);
          setOutletIdState(null);
          if (typeof window !== "undefined") localStorage.removeItem("outletId");
          return;
        }
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
        if (cancelled) return;
        setLoading(false);
        setOutletsChecked(true);
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
    return {
      outlets,
      outletId,
      outlet,
      businessId,
      setOutletId,
      refreshOutlets,
      loading,
      outletsChecked,
      outletsLoaded,
    };
  }, [outlets, outletId, businessId, session, loading, outletsChecked, outletsLoaded]);

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
      outletsChecked: false,
      outletsLoaded: false,
    } satisfies BusinessContextValue;
  }
  return ctx;
}
