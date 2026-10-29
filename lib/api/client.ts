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
 * Deliberately a short list: catalogue, cash setup and the session, never
 * ledgers that would look authoritative while stale.
 */
const OFFLINE_CACHE_PATHS = [
  "/me",
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

function idleCacheSaveTimeoutMs() {
  return 15_000;
}

let lastCacheableBody: OfflineCacheEntry | null = null;
let lastCacheablePath: string | null = null;
let cacheSaveTimer: ReturnType<typeof setTimeout> | null = null;

function startCacheSaveTimer() {
  if (cacheSaveTimer != null) return;
  cacheSaveTimer = setTimeout(() => {
    cacheSaveTimer = null;
    if (lastCacheableBody == null || lastCacheablePath == null) return;
    try {
      localStorage.setItem(`velora_offline_cache_${shortHash(lastCacheablePath)}`, JSON.stringify(lastCacheableBody));
      announceOfflineCacheUse();
    } catch {
      /* Private browsing / quota failures are not worth surfacing during checkout. */
    }
    lastCacheableBody = null;
    lastCacheablePath = null;
  }, idleCacheSaveTimeoutMs());
}

function scheduleCacheSave(path: string, body: OfflineCacheEntry | null) {
  lastCacheablePath = path;
  lastCacheableBody = body;
  startCacheSaveTimer();
}

function invalidateCacheSaveTimer() {
  if (cacheSaveTimer != null) {
    clearTimeout(cacheSaveTimer);
    cacheSaveTimer = null;
  }
  lastCacheableBody = null;
  lastCacheablePath = null;
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
  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "omit",
    signal: effectiveSignal,
  });

  if (res.status === 204) {
    invalidateCacheSaveTimer();
    return undefined as T;
  }

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    invalidateCacheSaveTimer();
    throw new ApiException(toApiError(res, parsed));
  }

  if (parsed && typeof parsed === "object" && "success" in (parsed as Record<string, unknown>)) {
    const env = parsed as { success: boolean; data?: unknown; message?: string; code?: string; errors?: unknown };
    if (env.success === false) {
      invalidateCacheSaveTimer();
      throw new ApiException({ status: res.status, code: env.code, message: env.message ?? "Request failed", details: env.errors });
    }
    const result = (env.data as T) ?? (undefined as T);

    if (method === "GET" && isCacheablePath(path)) {
      scheduleCacheSave(path, { ok: true, data: JSON.stringify(result) });
    } else {
      invalidateCacheSaveTimer();
    }

    return result;
  }

  invalidateCacheSaveTimer();
  return parsed as T;
}

/** True when the request never reached the server, as opposed to a refusal. */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiException) return error.status === 0;
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) return true;
  return error instanceof Error && /fetch|network|load failed|aborted|timed out/i.test(error.message) && !("code" in error);
}
