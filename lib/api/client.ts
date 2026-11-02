import { ApiException, toApiError } from "./errors";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

export const USE_MOCK_API =
  process.env.NEXT_PUBLIC_USE_MOCK_API === "true" ||
  (!API_BASE_URL && process.env.NODE_ENV !== "production");

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  idempotencyKey?: string;
  /** Give up and treat the call as unreachable after this many milliseconds. */
  timeoutMs?: number;
};

const TOKEN_KEY = "velora_access_token";

/**
 * GET responses the register can keep serving after the network drops.
 *
 * Rules for adding a path here:
 * - Must be read-only catalogue or setup data (never a ledger or live balance
 *   that would look authoritative while stale).
 * - Outlet-specific paths (e.g. `/menu?outlet_id=…`) are naturally keyed by
 *   their full URL, so each outlet gets its own cache slot automatically.
 * - Avoid adding broad prefixes like `/orders` or `/sales` — those contain
 *   real-time state that must never be served stale.
 *
 * Covered:
 *   /me                 — session; lets a reloaded register stay signed in
 *   /products           — catalogue; the register needs product tiles offline
 *   /categories         — category filter chips on the register
 *   /menu               — modifiers, availability, daypart pricing per outlet
 *   /tax-rates          — needed to price a new direct sale offline
 *   /payment-methods    — needed to render the tender screen offline
 *   /inventory/balances — per-outlet stock levels for the sell screen
 */
const OFFLINE_CACHE_PATHS = [
  "/me",
  "/products",
  "/categories",
  "/menu",
  "/tax-rates",
  "/payment-methods",
  "/inventory/balances",
];

type OfflineCacheListener = (usedAt: string) => void;
type OfflineCacheEntry = { ok: boolean; data: string };
const offlineCacheListeners = new Set<OfflineCacheListener>();
let lastOfflineCacheUse: string | null = null;

/** Notified whenever a read had to fall back to the saved copy. */
export function onOfflineCacheUsed(listener: OfflineCacheListener) {
  offlineCacheListeners.add(listener);
  return () => offlineCacheListeners.delete(listener);
}

export function getLastOfflineCacheUse() {
  return lastOfflineCacheUse;
}

function announceOfflineCacheUse() {
  lastOfflineCacheUse = new Date().toISOString();
  offlineCacheListeners.forEach((listener) => listener(lastOfflineCacheUse as string));
}

/**
 * Read a cached copy of a cacheable GET response that was saved before the
 * network dropped, so the register can keep answering the cashier without
 * waiting on a server round trip for a read it has already made recently.
 */
function readOfflineCache(path: string): OfflineCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`velora_offline_cache_${shortHash(path)}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("ok" in parsed)) return null;
    return parsed as OfflineCacheEntry;
  } catch {
    return null;
  }
}

function shortHash(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function isCacheablePath(path: string) {
  const clean = path.split("?")[0];
  return OFFLINE_CACHE_PATHS.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}

/**
 * Save a cacheable GET response straight away. The session (`/me`) is what
 * lets a reloaded register stay signed in with no network, so a delayed or
 * best-effort write would drop it exactly when it is needed.
 */
function writeOfflineCache(path: string, data: string) {
  if (typeof window === "undefined") return;
  try {
    const entry: OfflineCacheEntry = { ok: true, data };
    localStorage.setItem(`velora_offline_cache_${shortHash(path)}`, JSON.stringify(entry));
  } catch {
    /* Private browsing / quota failures are not worth surfacing during checkout. */
  }
}

/** Fired when the server rejects the stored token, so the UI can sign out. */
export const UNAUTHORIZED_EVENT = "velora:unauthorized";

/** Endpoints where a 401 means "bad credentials", not "expired session". */
const CREDENTIAL_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/google",
];

function handleUnauthorized(path: string) {
  if (typeof window === "undefined") return;
  const clean = path.split("?")[0];
  if (CREDENTIAL_PATHS.some((prefix) => clean.startsWith(prefix))) return;

  // Drop the token and the cached session so a reload cannot restore it.
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(`velora_offline_cache_${shortHash("/me")}`);
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, signal, idempotencyKey, timeoutMs } = opts;
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };
  const token = getAccessToken();
  if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  const businessId = typeof window !== "undefined" ? localStorage.getItem("businessId") : null;
  const outletId = typeof window !== "undefined" ? localStorage.getItem("outletId") : null;
  if (businessId) finalHeaders["X-Business-Id"] = businessId;
  if (outletId) finalHeaders["X-Outlet-Id"] = outletId;
  if (headers["Content-Type"] === undefined) finalHeaders["Content-Type"] = "application/json";


  const controller = typeof AbortController !== "undefined" && (signal ?? timeoutMs != null)
    ? new AbortController()
    : undefined;
  const effectiveSignal = signal ?? controller?.signal;
  if (controller && timeoutMs != null && timeoutMs > 0) {
    setTimeout(() => controller.abort(), timeoutMs);
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "omit",
      signal: effectiveSignal,
    });
  } catch (error) {
    // The request never reached the server. Reads the register already made
    // (the session, above all) keep answering from the saved copy; everything
    // else fails as unreachable so callers can queue instead of guessing.
    if (method === "GET" && isCacheablePath(path)) {
      const cached = readOfflineCache(path);
      if (cached?.ok) {
        try {
          const data = JSON.parse(cached.data) as T;
          announceOfflineCacheUse();
          return data;
        } catch {
          /* Corrupt entry: fall through to the unreachable error. */
        }
      }
    }
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new ApiException({
      status: 0,
      code: aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
      message: aborted ? "The server took too long to answer" : "The server could not be reached",
      details: error,
    });
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    if (res.status === 401) handleUnauthorized(path);
    throw new ApiException(toApiError(res, parsed));
  }

  if (parsed && typeof parsed === "object" && "success" in (parsed as Record<string, unknown>)) {
    const env = parsed as { success: boolean; data?: unknown; message?: string; code?: string; errors?: unknown };
    if (env.success === false) {
      throw new ApiException({ status: res.status, code: env.code, message: env.message ?? "Request failed", details: env.errors });
    }
    const result = (env.data as T) ?? (undefined as T);

    if (method === "GET" && isCacheablePath(path)) {
      writeOfflineCache(path, JSON.stringify(result));
    }

    return result;
  }

  return parsed as T;
}

/** True when the request never reached the server, as opposed to a refusal. */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiException) return error.status === 0;
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) return true;
  return error instanceof Error && /fetch|network|load failed|aborted|timed out/i.test(error.message) && !("code" in error);
}
