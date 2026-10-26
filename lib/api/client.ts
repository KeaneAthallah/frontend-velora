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
};

const TOKEN_KEY = "velora_access_token";

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
  const { method = "GET", body, headers = {}, signal, idempotencyKey } = opts;
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };
  const token = getAccessToken();
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (idempotencyKey) finalHeaders["Idempotency-Key"] = idempotencyKey;

  const businessId = typeof window !== "undefined" ? localStorage.getItem("businessId") : null;
  const outletId = typeof window !== "undefined" ? localStorage.getItem("outletId") : null;
  if (businessId) finalHeaders["X-Business-Id"] = businessId;
  if (outletId) finalHeaders["X-Outlet-Id"] = outletId;

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "omit",
    signal,
  });

  if (res.status === 204) return undefined as T;

  let parsed: unknown = null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
  } else {
    parsed = await res.text();
  }

  if (!res.ok) throw new ApiException(toApiError(res, parsed));

  // Unwrap Laravel envelope { success, message, data, meta }
  if (parsed && typeof parsed === "object" && "success" in (parsed as Record<string, unknown>)) {
    const env = parsed as { success: boolean; data?: unknown; message?: string; code?: string; errors?: unknown };
    if (env.success === false) {
      throw new ApiException({ status: res.status, code: env.code, message: env.message ?? "Request failed", details: env.errors });
    }
    return (env.data as T) ?? (undefined as T);
  }
  return parsed as T;
}
