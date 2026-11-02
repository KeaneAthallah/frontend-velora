import { apiRequest, USE_MOCK_API } from "./client";
import { mockSession } from "./mock-data";
import type { Session, User } from "./types";

type BackendPermission = { slug?: string; name?: string } | string;

type BackendUser = {
  id: number | string;
  name: string;
  email: string;
  is_platform_admin?: boolean;
  business_memberships?: {
    business_id: number | string;
    status?: string;
    business?: { id: number | string; name: string; currency?: string; timezone?: string };
    role?: {
      name?: string;
      slug?: string;
      permissions?: BackendPermission[];
    };
  }[];
  outlet_memberships?: {
    outlet_id: number | string;
    outlet?: { id: number | string; name: string; business_id?: number | string };
  }[];
};

function mapUser(user: BackendUser): User {
  return { id: String(user.id), name: user.name, email: user.email };
}

function mapSessionFromMe(user: BackendUser): Session {
  const mappedUser = mapUser(user);
  const membership = user.business_memberships?.find((entry) => entry.status !== "inactive") ?? user.business_memberships?.[0];
  const business = membership?.business
    ? {
        id: String(membership.business.id),
        name: membership.business.name,
        currency: membership.business.currency ?? "IDR",
        timezone: membership.business.timezone ?? "Asia/Jakarta",
      }
    : {
        id: String(membership?.business_id ?? ""),
        name: "Business",
        currency: "IDR",
        timezone: "Asia/Jakarta",
      };
  const outletMembership = user.outlet_memberships?.[0];
  const outlet = outletMembership?.outlet
    ? {
        id: String(outletMembership.outlet.id),
        name: outletMembership.outlet.name,
        businessId: String(outletMembership.outlet.business_id ?? business.id),
      }
    : { id: "", name: "Outlet", businessId: business.id };

  const rawPermissions = membership?.role?.permissions;
  const permissions = rawPermissions
    ? rawPermissions.map((permission) =>
        typeof permission === "string" ? permission : permission.slug ?? permission.name ?? ""
      ).filter(Boolean)
    : user.is_platform_admin || membership?.role?.slug === "owner"
      ? ["*"]
      : [];

  if (typeof window !== "undefined") {
    if (business.id) localStorage.setItem("businessId", business.id);
    else localStorage.removeItem("businessId");
    if (outlet.id) localStorage.setItem("outletId", outlet.id);
    else localStorage.removeItem("outletId");
  }

  return { user: mappedUser, business, outlet, permissions };
}

export async function login(email: string, password: string): Promise<Session> {
  if (USE_MOCK_API) {
    if (!email || !password) throw new Error("Email and password are required");
    // Persist a placeholder token so a demo session survives a page reload. The
    // mock client never sends it to a server; it only satisfies the auth gate.
    const { setAccessToken } = await import("./client");
    setAccessToken("mock-access-token");
    return mockSession;
  }
  const res = await apiRequest<{ user: BackendUser; token: string }>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (res.token) {
    const { setAccessToken } = await import("./client");
    setAccessToken(res.token);
  }
  return me();
}

export async function register(
  name: string,
  email: string,
  password: string,
  passwordConfirmation: string
): Promise<Session> {
  if (USE_MOCK_API) return mockSession;
  const res = await apiRequest<{ user: BackendUser; token: string }>("/auth/register", {
    method: "POST",
    body: { name, email, password, password_confirmation: passwordConfirmation },
  });
  if (res.token) {
    const { setAccessToken } = await import("./client");
    setAccessToken(res.token);
  }
  return mapSessionFromMe(res.user);
}

/**
 * The Google authorize URL to send the browser to. The API encrypts the
 * optional same-origin return path into the OAuth state.
 */
export async function googleAuthUrl(next?: string | null): Promise<string> {
  if (USE_MOCK_API) {
    throw new Error("Google sign-in is not available in the local demo data mode.");
  }
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  const res = await apiRequest<{ url: string }>(`/auth/google/redirect${query}`);
  return res.url;
}

/** Trade the one-time code from the OAuth callback for a session. */
export async function completeGoogleSignIn(code: string): Promise<Session> {
  if (USE_MOCK_API) {
    throw new Error("Google sign-in is not available in the local demo data mode.");
  }
  const res = await apiRequest<{ user: BackendUser; token: string }>("/auth/google/exchange", {
    method: "POST",
    body: { code },
  });
  if (res.token) {
    const { setAccessToken } = await import("./client");
    setAccessToken(res.token);
  }
  return me();
}

export async function logout(): Promise<void> {
  if (!USE_MOCK_API) {
    await apiRequest<void>("/auth/logout", { method: "POST" }).catch(() => {});
  }
  const { setAccessToken } = await import("./client");
  setAccessToken(null);
  if (typeof window !== "undefined") {
    localStorage.removeItem("businessId");
    localStorage.removeItem("outletId");
  }
}

export async function me(): Promise<Session> {
  if (USE_MOCK_API) return mockSession;
  const user = await apiRequest<BackendUser>("/me");
  return mapSessionFromMe(user);
}

export async function forgotPassword(email: string): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest<void>("/auth/forgot-password", { method: "POST", body: { email } });
}

export async function resetPassword(input: {
  token: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}): Promise<void> {
  if (USE_MOCK_API) {
    if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
    return;
  }
  await apiRequest<void>("/auth/reset-password", {
    method: "POST",
    body: {
      token: input.token,
      email: input.email,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    },
  });
}

export async function changePassword(input: {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
}): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest<void>("/auth/change-password", {
    method: "POST",
    body: {
      current_password: input.currentPassword,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    },
  });
}
