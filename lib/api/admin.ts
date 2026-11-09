import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type { AdminOverview, AdminBusinessRow, AdminBusinessDetail, PlanApi, SubscriptionPayment, SubscriptionDetail, SubscriptionHistoryEntry } from "./types";
import { getSubscription as _getMockSubscription, mapInvoice, mapPayment, mapPlan, mapSubscriptionDetail } from "./subscriptions";

/* ──────────────────────── admin (platform_admin only) ───────────── */

type Raw = Record<string, any>;

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapAdminOverview(raw: Raw): AdminOverview {
  return {
    businesses: num(raw.businesses),
    counts: raw.counts ?? {},
    mrr: num(raw.mrr),
    currency: raw.currency ?? "IDR",
    revenueThisMonth: num(raw.revenue_this_month),
    revenueAllTime: num(raw.revenue_all_time),
    planDistribution: (raw.plan_distribution ?? []).map((plan: Raw) => ({
      slug: plan.slug,
      name: plan.name,
      active: num(plan.active),
      monthlyPrice: num(plan.monthly_price),
      yearlyPrice: num(plan.yearly_price),
    })),
    recentPayments: (raw.recent_payments ?? []).map((payment: Raw) => ({
      id: String(payment.id ?? ""),
      business: payment.business ?? null,
      invoice: payment.invoice ?? null,
      provider: payment.provider,
      status: payment.status,
      amount: num(payment.amount),
      currency: payment.currency ?? "IDR",
      createdAt: payment.created_at ?? "",
      paidAt: payment.paid_at ?? null,
    })),
    trialDays: num(raw.trial_days),
    graceDays: num(raw.grace_days),
  };
}

function mapAdminBusinessRow(raw: Raw): AdminBusinessRow {
  const s = raw.subscription;
  const usage = raw.usage ?? {};
  return {
    id: String(raw.id ?? ""),
    name: raw.name,
    slug: raw.slug,
    businessStatus: raw.business_status ?? "active",
    createdAt: raw.created_at ?? "",
    subscription: s
      ? {
          id: String(s.id ?? ""),
          status: s.status,
          billingPeriod: s.billing_period ?? "monthly",
          plan: s.plan ?? null,
          planName: s.plan_name ?? null,
          trialEndsAt: s.trial_ends_at ?? null,
          endsAt: s.ends_at ?? null,
          daysRemaining: num(s.days_remaining),
          cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
          pendingPlan: s.pending_plan ?? null,
        }
      : null,
    usage: {
      products: num(usage.products),
      customers: num(usage.customers),
      outlets: num(usage.outlets),
      users: num(usage.users),
      transactionsPerMonth: num(usage.transactions_per_month),
    },
  };
}

function mapHistory(raw: Raw): SubscriptionHistoryEntry {
  return {
    id: String(raw.id ?? ""),
    action: raw.action,
    fromStatus: raw.from_status ?? null,
    toStatus: raw.to_status ?? null,
    fromPlan: raw.from_plan ?? null,
    toPlan: raw.to_plan ?? null,
    metadata: raw.metadata ?? {},
    actor: raw.actor ?? null,
    createdAt: raw.created_at ?? "",
  };
}

export async function getAdminOverview(): Promise<AdminOverview> {
  if (USE_MOCK_API) return mockOverview();
  return mapAdminOverview(await apiRequest<Raw>("/admin/subscriptions/overview"));
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
  return { data: items.map(mapAdminBusinessRow), page: num(data?.meta?.current_page) || 1, totalPages: num(data?.meta?.last_page) || 1, total: num(data?.meta?.total) || items.length };
}

export async function getAdminBusiness(businessId: string): Promise<AdminBusinessDetail> {
  if (USE_MOCK_API) return mockBusinessDetail(businessId);
  const raw = await apiRequest<Raw>(`/admin/subscriptions/${businessId}`);
  return {
    business: {
      id: String(raw.business?.id ?? ""),
      name: raw.business?.name ?? "",
      slug: raw.business?.slug ?? "",
      status: raw.business?.status ?? "active",
      currency: raw.business?.currency ?? "IDR",
      createdAt: raw.business?.created_at ?? "",
    },
    snapshot: mapSubscriptionDetail(raw.snapshot ?? {}),
    invoices: (raw.invoices ?? []).map(mapInvoice),
    payments: (raw.payments ?? []).map(mapPayment),
    history: (raw.history ?? []).map(mapHistory),
  };
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
  const raw = await apiRequest<Raw>(`/admin/subscriptions/payments/${paymentId}/confirm`, { method: "POST", body: { note } });
  return { status: raw.status, payment: mapPayment(raw.payment ?? {}) };
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
  return { data: items.map(mapPayment), page: num(data?.meta?.current_page) || 1, totalPages: num(data?.meta?.last_page) || 1, total: num(data?.meta?.total) || items.length };
}

export async function listAdminPlans(): Promise<{ plans: PlanApi[]; featureCatalog: { key: string; label: string; group: string }[]; usageMetrics: { key: string; label: string }[] }> {
  if (USE_MOCK_API) return mockAdminPlans();
  const raw = await apiRequest<Raw>("/admin/subscriptions/plans");
  return {
    plans: (raw.plans ?? []).map(mapPlan),
    featureCatalog: raw.feature_catalog ?? [],
    usageMetrics: raw.usage_metrics ?? [],
  };
}

export async function updateAdminPlan(planId: string, updates: Record<string, any>): Promise<PlanApi> {
  if (USE_MOCK_API) return mockAdminPlans().plans.find((p) => p.id === planId)!;
  return mapPlan(await apiRequest<Raw>(`/admin/subscriptions/plans/${planId}`, { method: "PUT", body: updates }));
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
      { id: "1", slug: "trial", name: "Free Trial", description: "", sortOrder: 0, isPublic: true, isActive: true, isTrial: true, trialDays: 30, currency: "IDR", prices: { monthly: 0, yearly: 0 }, limits: { businesses: 1, outlets: 2, users: 3, products: 100, customers: 100, transactions_per_month: 100, exports_per_month: 10 }, features: {}, metadata: {} },
      { id: "2", slug: "basic", name: "Basic", description: "", sortOrder: 1, isPublic: true, isActive: true, isTrial: false, trialDays: 0, currency: "IDR", prices: { monthly: 69000, yearly: 720000 }, limits: { businesses: 1, outlets: 1, users: 3, products: 500, customers: 1000, transactions_per_month: 2000, exports_per_month: 100 }, features: {}, metadata: {} },
      { id: "3", slug: "pro", name: "Pro", description: "", sortOrder: 2, isPublic: true, isActive: true, isTrial: false, trialDays: 0, currency: "IDR", prices: { monthly: 89000, yearly: 890000 }, limits: { businesses: 1, outlets: 10, users: 20, products: null, customers: null, transactions_per_month: null, exports_per_month: null }, features: {}, metadata: {} },
    ],
    featureCatalog: [],
    usageMetrics: [],
  };
}
