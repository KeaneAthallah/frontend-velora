import { isNetworkError } from "../api/client";
import { checkout, type CheckoutRequest } from "../api/sales";
import { queueReadAll, queueRemove, queueWrite } from "./storage";

/**
 * A sale taken while the register could not reach the API.
 *
 * The full checkout request is kept, including the idempotency key, so replay
 * goes through exactly the same path as an online sale: create the sale, fit
 * the payment batch to the authoritative total, record it. A retry after a
 * partial success resumes instead of charging twice.
 */
export type QueuedSale = {
  id: string;
  createdAt: string;
  request: CheckoutRequest;
  attempts: number;
  lastError?: string;
  status: "pending" | "failed";
};

export type SyncReport = {
  synced: number;
  failed: number;
  pending: number;
  offline: boolean;
};

const listeners = new Set<() => void>();

export function subscribeQueue(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueQueuedSale(request: CheckoutRequest): Promise<QueuedSale> {
  const entry: QueuedSale = {
    id: newId(),
    createdAt: new Date().toISOString(),
    request,
    attempts: 0,
    status: "pending",
  };
  await queueWrite(entry);
  notify();
  return entry;
}

export async function listQueuedSales(): Promise<QueuedSale[]> {
  const rows = await queueReadAll<QueuedSale>();
  return rows
    .filter((row) => row && row.request)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function discardQueuedSale(id: string): Promise<void> {
  await queueRemove(id);
  notify();
}

function offlineNow() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/**
 * Send every pending sale to the server, oldest first.
 *
 * A network failure stops the run and leaves the rest pending, so a flaky link
 * never burns through the queue. A server refusal (validation, stock, a closed
 * table) marks that one sale failed and keeps it visible for a human decision.
 */
export async function syncQueuedSales(): Promise<SyncReport> {
  const rows = await listQueuedSales();
  if (offlineNow()) {
    return { synced: 0, failed: 0, pending: rows.filter((row) => row.status === "pending").length, offline: true };
  }

  let synced = 0;
  let failed = 0;

  for (const entry of rows) {
    if (entry.status !== "pending") continue;

    try {
      await checkout(entry.request);
      await queueRemove(entry.id);
      synced += 1;
    } catch (error) {
      if (isNetworkError(error)) {
        notify();
        const remaining = await listQueuedSales();
        return {
          synced,
          failed,
          pending: remaining.filter((row) => row.status === "pending").length,
          offline: true,
        };
      }

      entry.status = "failed";
      entry.attempts += 1;
      entry.lastError = error instanceof Error ? error.message : "The sale was refused";
      await queueWrite(entry);
      failed += 1;
    }
  }

  notify();
  const remaining = await listQueuedSales();

  return {
    synced,
    failed,
    pending: remaining.filter((row) => row.status === "pending").length,
    offline: false,
  };
}

/** Put a failed sale back in line and try again straight away. */
export async function retryQueuedSale(id: string): Promise<SyncReport> {
  const rows = await listQueuedSales();
  const entry = rows.find((row) => row.id === id);
  if (!entry) return { synced: 0, failed: 0, pending: rows.length, offline: offlineNow() };

  entry.status = "pending";
  entry.lastError = undefined;
  await queueWrite(entry);
  notify();

  return syncQueuedSales();
}

export function queuedSaleTotal(entry: QueuedSale): number {
  return (entry.request.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);
}
