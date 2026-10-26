"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listOutlets, listBusinesses } from "@/lib/api/business";
import { useAuth } from "@/lib/auth/auth-context";
import type { Outlet } from "@/lib/api/types";

interface BusinessContextValue {
  outlets: Outlet[];
  outletId: string | null;
  businessId: string | null;
  setOutletId: (id: string) => void;
}

const Ctx = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletIdState] = useState<string | null>(null);
  const [businessId, setBusinessIdState] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const bs = await listBusinesses();
        const bid = bs[0]?.id ?? null;
        setBusinessIdState(bid);
        if (bid && typeof window !== "undefined") localStorage.setItem("businessId", bid);
        const os = await listOutlets();
        setOutlets(os);
        const stored = typeof window !== "undefined" ? localStorage.getItem("outletId") : null;
        const initial = stored && os.some((o) => o.id === stored) ? stored : os[0]?.id ?? null;
        setOutletIdState(initial);
        if (initial && typeof window !== "undefined") localStorage.setItem("outletId", initial);
      } catch {
        // ignore; mock/real may fail
      }
    })();
  }, [session]);

  const setOutletId = (id: string) => {
    setOutletIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("outletId", id);
    qc.clear();
  };

  return <Ctx.Provider value={{ outlets, outletId, businessId, setOutletId }}>{children}</Ctx.Provider>;
}

export function useBusiness() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}
