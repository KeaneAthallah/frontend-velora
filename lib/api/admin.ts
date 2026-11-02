import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type { AdminOverview, AdminBusinessRow, AdminBusinessDetail, PlanApi, SubscriptionPayment, SubscriptionDetail } from "./types";
import { getSubscription as _getMockSubscription } from "./subscriptions";

/* ──────────────────────── admin (platform_admin only) ───────────── */

export async function getAdminOverview(): Promise<AdminOverview> {
  if (USE_MOCK_API) return mockOverview();
  const data = await apiRequest<AdminOverview>("/admin/subscriptions/overview");
  return data;
}

export async function listAdminBusinesses(params?: { status?: string; plan?: string; q?: string }): Promise<{ data: AdminBusinessRow[]; page: number; totalPages: number; total: number }> {
  if (USE_MOCK_API) {
    const businesses = mockDb.adminBusinesses;
    let filtered = [...businesses];
    if (params?.status) filtered = filtered.filter((b) => b.subscription?.status === params.status);
    if (params?.plan) filtered = filtered.filter((b) => b.subscription?.plan === params.plan);
    if (params?.q) {
      const q = params.q.toLowerCase();
      filtered = filtered.filter((b) => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q));
    }
    return { data: filtered, page: 1, totalPages: 1, total: filtered.length };
  }
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.plan) query.set("plan", params.plan);
  if (params?.q) query.set("q", params.q);
  const data = await apiRequest<any>(`/admin/subscriptions?${query}`);
  const items = Array.isArray(data?.data) ? data.data : [];
  return { data: items as AdminBusinessRow[], page: data?.meta?.current_page ?? 1, totalPages: data?.meta?.last_page ?? 1, total: data?.meta?.total ?? items.length };
}

export async function getAdminBusiness(businessId: string): Promise<AdminBusinessDetail> {
  if (USE_MOCK_API) return mockBusinessDetail(businessId);
  const data = await apiRequest<AdminBusinessDetail>(`/admin/subscriptions/${businessId}`);
  return data;
}

export async function adminChangePlan(businessId: string, input: { plan: string; billingPeriod: "monthly" | "yearly"; reason?: string }): Promise<{ subscription: any }> {
  if (USE_MOCK_API) return { subscription: {} };
  const data = await apiRequest<{ subscription: any }>(`/admin/subscriptions/${businessId}/change-plan`, { method: "POST", body: { plan: input.plan, billing_period: input.billingPeriod, reason: input.reason } });
  return data;
}

export async function adminExtendTrial(businessId: string, days: number, reason?: string): Promise<{ subscription: any }> {
  if (USE_MOCK_API) return { subscription: {} };
  const data = await apiRequest<{ subscription: any }>(`/admin/subscriptions/${businessId}/extend-trial`, { method: "POST", body: { days, reason } });
  return data;
}

export async function adminSuspend(businessId: string, reason?: string): Promise<{ subscription: any }> {
  if (USE_MOCK_API) return { subscription: {} };
  const data = await apiRequest<{ subscription: any }>(`/admin/subscriptions/${businessId}/suspend`, { method: "POST", body: { reason } });
  return data;
}

export async function adminReactivate(businessId: string): Promise<{ subscription: any }> {
  if (USE_MOCK_API) return { subscription: {} };
  const data = await apiRequest<{ subscription: any }>(`/admin/subscriptions/${businessId}/reactivate`, { method: "POST" });
  return data;
}

export async function adminConfirmPayment(paymentId: string, note?: string): Promise<{ status: string; payment: SubscriptionPayment }> {
  if (USE_MOCK_API) {
    const pay = mockDb.subscriptionPayments.find((p) => p.id === paymentId);
    if (pay) pay.status = "paid";
    return { status: "paid", payment: pay! };
  }
  const data = await apiRequest<{ status: string; payment: SubscriptionPayment }>(`/admin/subscriptions/payments/${paymentId}/confirm`, { method: "POST", body: { note } });
  return data;
}

export async function listAdminPayments(params?: { status?: string; provider?: string; business_id?: string }): Promise<{ data: SubscriptionPayment[]; page: number; totalPages: number; total: number }> {
  if (USE_MOCK_API) {
    let payments = [...mockDb.subscriptionPayments];
    if (params?.status) payments = payments.filter((p) => p.status === params.status);
    if (params?.provider) payments = payments.filter((p) => p.provider === params.provider);
    return { data: payments, page: 1, totalPages: 1, total: payments.length };
  }
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.provider) query.set("provider", params.provider);
  if (params?.business_id) query.set("business_id", params.business_id);
  const data = await apiRequest<any>(`/admin/subscriptions/payments?${query}`);
  const items = Array.isArray(data?.data) ? data.data : [];
  return { data: items as SubscriptionPayment[], page: data?.meta?.current_page ?? 1, totalPages: data?.meta?.last_page ?? 1, total: data?.meta?.total ?? items.length };
}

export async function listAdminPlans(): Promise<{ plans: PlanApi[]; featureCatalog: { key: string; label: string; group: string }[]; usageMetrics: { key: string; label: string }[] }> {
  if (USE_MOCK_API) return mockAdminPlans();
  const data = await apiRequest<{ plans: PlanApi[]; featureCatalog: { key: string; label: string; group: string }[]; usageMetrics: { key: string; label: string }[] }>("/admin/subscriptions/plans");
  return data;
}

export async function updateAdminPlan(planId: string, updates: Record<string, any>): Promise<PlanApi> {
  if (USE_MOCK_API) return mockAdminPlans().plans.find((p) => p.id === planId)!;
  const data = await apiRequest<PlanApi>(`/admin/subscriptions/plans/${planId}`, { method: "PUT", body: updates });
  return data;
}

/* ──────────────────────── mock helpers ─────────────────────────── */

function mockOverview(): AdminOverview {
  return {
    businesses: 5,
    counts: { trialing: 1, active: 3, past_due: 0, canceled: 0, expired: 1, suspended: 0, none: 0 },
    mrr: 689000,
    currency: "IDR",
    revenueThisMonth: 69000,
    revenueAllTime: 745000,
    planDistribution: [
      { slug: "trial", name: "Free Trial", active: 0, monthlyPrice: 0, yearlyPrice: 0 },
      { slug: "basic", name: "Basic", active: 2, monthlyPrice: 69000, yearlyPrice: 720000 },
      { slug: "pro", name: "Pro", active: 1, monthlyPrice: 89000, yearlyPrice: 890000 },
    ],
    recentPayments: [],
    trialDays: 30,
    graceDays: 3,
  };
}

function mockBusinessDetail(businessId: string): AdminBusinessDetail {
  const now = new Date();
  const ends = new Date(now.getTime() + 23 * 86400000);
  const sub = { id: "1", status: "trialing" as const, rawStatus: "trialing" as const, isActive: true, billingPeriod: "monthly" as const, trialStartsAt: new Date(now.getTime() - 7 * 86400000).toISOString(), trialEndsAt: ends.toISOString(), trialDaysRemaining: 23, startsAt: new Date(now.getTime() - 7 * 86400000).toISOString(), currentPeriodStart: new Date(now.getTime() - 7 * 86400000).toISOString(), currentPeriodEnd: ends.toISOString(), endsAt: ends.toISOString(), daysRemaining: 23, graceEndsAt: null, cancelAtPeriodEnd: false, canceledAt: null, nextBillingDate: null, provider: null, priceAmount: 0, currency: "IDR", pendingPlan: null };
  return {
    business: { id: businessId ?? mockDb.business.id, name: mockDb.business.name, slug: mockDb.business.name.toLowerCase().replace(/\s+/g, "-"), status: "active", currency: "IDR", createdAt: now.toISOString() },
    snapshot: { businessId: sub.id, subscription: sub, plan: null, usage: [], features: {}, availablePlans: [], openInvoice: null, trialReminders: [14, 7, 3, 1], providerStatus: {} },
    invoices: [],
    payments: [],
    history: [],
  };
}

function mockAdminPlans() {
  return {
    plans: [
      { id: "1", slug: "trial", name: "Free Trial", description: "", sortOrder: 0, isPublic: true, isActive: true, isTrial: true, trialDays: 30, currency: "IDR", prices: { monthly: 0, yearly: 0 }, limits: { businesses: 1, outlets: 2, users: 3, products: 100, customers: 100, transactions_per_month: 100, exports_per_month: 10 }, features: {} },
      { id: "2", slug: "basic", name: "Basic", description: "", sortOrder: 1, isPublic: true, isActive: true, isTrial: false, trialDays: 0, currency: "IDR", prices: { monthly: 69000, yearly: 720000 }, limits: { businesses: 1, outlets: 1, users: 3, products: 500, customers: 1000, transactions_per_month: 2000, exports_per_month: 100 }, features: {} },
      { id: "3", slug: "pro", name: "Pro", description: "", sortOrder: 2, isPublic: true, isActive: true, isTrial: false, trialDays: 0, currency: "IDR", prices: { monthly: 89000, yearly: 890000 }, limits: { businesses: 1, outlets: 10, users: 20, products: null, customers: null, transactions_per_month: null, exports_per_month: null }, features: {} },
    ],
    featureCatalog: [],
    usageMetrics: [],
  };
}
