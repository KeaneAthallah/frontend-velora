import { apiRequest, USE_MOCK_API } from "./client";
import { mockSession } from "./mock-data";
import type { Session, User } from "./types";

type BackendUser = {
  id: number | string;
  name: string;
  email: string;
  is_platform_admin?: boolean;
  business_memberships?: { business_id: number | string; business?: { id: number | string; name: string; currency?: string; timezone?: string }; role?: { name?: string; slug?: string } }[];
  outlet_memberships?: { outlet_id: number | string; outlet?: { id: number | string; name: string; business_id?: number | string } }[];
};

function mapUser(u: BackendUser): User {
  return { id: String(u.id), name: u.name, email: u.email };
}

function mapSessionFromMe(u: BackendUser): Session {
  const user = mapUser(u);
  const firstBizMembership = u.business_memberships?.[0];
  const business = firstBizMembership?.business
    ? { id: String(firstBizMembership.business.id), name: firstBizMembership.business.name, currency: firstBizMembership.business.currency ?? "IDR", timezone: firstBizMembership.business.timezone ?? "UTC" }
    : { id: String(firstBizMembership?.business_id ?? ""), name: "Business", currency: "IDR", timezone: "UTC" };
  const firstOutletMembership = u.outlet_memberships?.[0];
  const outlet = firstOutletMembership?.outlet
    ? { id: String(firstOutletMembership.outlet.id), name: firstOutletMembership.outlet.name, businessId: String(firstOutletMembership.outlet.business_id ?? business.id) }
    : { id: "", name: "Outlet", businessId: business.id };
  if (typeof window !== "undefined") {
    localStorage.setItem("businessId", business.id);
    if (outlet.id) localStorage.setItem("outletId", outlet.id);
  }
  return { user, business, outlet, permissions: ["*"] };
}

export async function login(email: string, password: string): Promise<Session> {
  if (USE_MOCK_API) {
    if (!email || !password) throw new Error("Email and password required");
    return mockSession;
  }
  const res = await apiRequest<{ user: BackendUser; token: string }>("/auth/login", { method: "POST", body: { email, password } });
  if (res.token) {
    const { setAccessToken } = await import("./client");
    setAccessToken(res.token);
  }
  return mapSessionFromMe(res.user);
}

export async function register(name: string, email: string, password: string, passwordConfirmation: string): Promise<Session> {
  if (USE_MOCK_API) return mockSession;
  const res = await apiRequest<{ user: BackendUser; token: string }>("/auth/register", { method: "POST", body: { name, email, password, password_confirmation: passwordConfirmation } });
  if (res.token) {
    const { setAccessToken } = await import("./client");
    setAccessToken(res.token);
  }
  return mapSessionFromMe(res.user);
}

export async function logout(): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest<void>("/auth/logout", { method: "POST" });
  const { setAccessToken } = await import("./client");
  setAccessToken(null);
  if (typeof window !== "undefined") {
    localStorage.removeItem("businessId");
    localStorage.removeItem("outletId");
  }
}

export async function me(): Promise<Session> {
  if (USE_MOCK_API) return mockSession;
  const u = await apiRequest<BackendUser>("/me");
  return mapSessionFromMe(u);
}

export async function forgotPassword(email: string): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest<void>("/auth/forgot-password", { method: "POST", body: { email } });
}
