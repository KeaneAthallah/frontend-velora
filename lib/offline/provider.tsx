"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { getLastOfflineCacheUse, onOfflineCacheUsed } from "@/lib/api/client";
import {
  discardQueuedSale,
  listQueuedSales,
  retryQueuedSale,
  subscribeQueue,
  syncQueuedSales,
  type SyncReport,
} from "./queue";
import type { QueuedSale } from "./queue";

type OfflineContextValue = {
  online: boolean;
  queued: QueuedSale[];
  pending: number;
  failed: number;
  syncing: boolean;
  lastSyncedAt: string | null;
  lastCacheUse: string | null;
  error: string | null;
  retryAll: () => Promise<void>;
  retryOne: (id: string) => Promise<void>;
  discard: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = React.createContext<OfflineContextValue | null>(null);

const INVALIDATE_ON_SYNC = [
  "transactions",
  "orders",
  "floor-plan",
  "dashboard",
  "reports",
  "inventory",
  "pos-stock",
  "pos-products",
  "customers",
  "loyalty-program",
  "loyalty-transactions",
];

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [online, setOnline] = React.useState(true);
  const [queued, setQueued] = React.useState<QueuedSale[]>([]);
  const [syncing, setSyncing] = React.useState(false);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null);
  const [lastCacheUse, setLastCacheUse] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const syncingRef = React.useRef(false);

  const refresh = React.useCallback(async () => {
    setQueued(await listQueuedSales());
  }, []);

  const applyReport = React.useCallback(
    (report: SyncReport, announce: boolean) => {
      if (report.synced > 0) {
        setLastSyncedAt(new Date().toISOString());
        INVALIDATE_ON_SYNC.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
        if (announce) {
          push({
            title: report.synced === 1 ? "1 offline sale synced" : `${report.synced} offline sales synced`,
            description: "Receipts and stock on the server now match the register.",
            variant: "success",
          });
        }
      }

      if (report.failed > 0) {
        if (announce) {
          push({
            title: "An offline sale was refused",
            description: "Open the sync queue to see the reason and retry or discard it.",
            variant: "warning",
          });
        }
      }
    },
    [push, queryClient]
  );

  const runSync = React.useCallback(
    async (announce: boolean) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      setSyncing(true);
      setError(null);

      try {
        const report = await syncQueuedSales();
        applyReport(report, announce);
        if (report.offline && report.pending > 0) {
          setError("Still offline — queued sales will go out when the connection returns.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "The queue could not be synced.");
      } finally {
        syncingRef.current = false;
        setSyncing(false);
        await refresh();
      }
    },
    [applyReport, refresh]
  );

  React.useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setLastCacheUse(getLastOfflineCacheUse());
    void refresh();

    const handleOnline = () => {
      setOnline(true);
      void runSync(true);
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubscribeQueue = subscribeQueue(() => {
      void refresh();
    });
    const unsubscribeCache = onOfflineCacheUsed(setLastCacheUse);

    // A quiet retry while the tab is open catches a connection that came back
    // without firing an event (captive portals, sleeping laptops).
    const timer = window.setInterval(() => {
      if (navigator.onLine) void runSync(false);
    }, 30_000);

    void runSync(false);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribeQueue();
      unsubscribeCache();
      window.clearInterval(timer);
    };
    // runSync is stable enough for a mount-only subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = React.useMemo<OfflineContextValue>(
    () => ({
      online,
      queued,
      pending: queued.filter((entry) => entry.status === "pending").length,
      failed: queued.filter((entry) => entry.status === "failed").length,
      syncing,
      lastSyncedAt,
      lastCacheUse,
      error,
      retryAll: () => runSync(true),
      retryOne: async (id: string) => {
        setSyncing(true);
        try {
          const report = await retryQueuedSale(id);
          applyReport(report, false);
        } finally {
          setSyncing(false);
          await refresh();
        }
      },
      discard: async (id: string) => {
        await discardQueuedSale(id);
        await refresh();
      },
      refresh,
    }),
    [online, queued, syncing, lastSyncedAt, lastCacheUse, error, runSync, applyReport, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOffline() {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    return {
      online: true,
      queued: [],
      pending: 0,
      failed: 0,
      syncing: false,
      lastSyncedAt: null,
      lastCacheUse: null,
      error: null,
      retryAll: async () => {},
      retryOne: async () => {},
      discard: async () => {},
      refresh: async () => {},
    } satisfies OfflineContextValue;
  }
  return ctx;
}
