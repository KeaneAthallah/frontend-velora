import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type { CheckoutResult, PlanApi, PricingPayload, SubscriptionDetail, SubscriptionInvoice, SubscriptionPayment, SubscriptionHistoryEntry, SubscriptionSummary } from "./types";

/* ──────────────────────────── normalizers ────────────────────────── */
// The billing API answers in snake_case; the app's types are camelCase.

type Raw = Record<string, any>;

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function mapPlan(raw: Raw): PlanApi {
  return {
    id: String(raw.id ?? ""),
    slug: raw.slug,
    name: raw.name,
    description: raw.description ?? null,
    sortOrder: num(raw.sort_order ?? raw.sortOrder),
    isPublic: Boolean(raw.is_public ?? raw.isPublic ?? true),
    isActive: Boolean(raw.is_active ?? raw.isActive ?? true),
    isTrial: Boolean(raw.is_trial ?? raw.isTrial),
    trialDays: num(raw.trial_days ?? raw.trialDays),
    currency: raw.currency ?? "IDR",
    prices: { monthly: num(raw.prices?.monthly), yearly: num(raw.prices?.yearly) },
    limits: raw.limits ?? {},
    features: raw.features ?? {},
  };
}

export function mapSubscriptionSummary(raw: Raw): SubscriptionSummary {
  const plan = raw.plan;
  return {
    status: raw.status,
    rawStatus: raw.raw_status ?? raw.status,
    isActive: Boolean(raw.is_active),
    billingPeriod: raw.billing_period ?? "monthly",
    plan: plan ? { slug: plan.slug, name: plan.name, isTrial: Boolean(plan.is_trial) } : null,
    trialEndsAt: raw.trial_ends_at ?? null,
    trialDaysRemaining: num(raw.trial_days_remaining),
    endsAt: raw.ends_at ?? null,
    daysRemaining: num(raw.days_remaining),
    graceEndsAt: raw.grace_ends_at ?? null,
    cancelAtPeriodEnd: Boolean(raw.cancel_at_period_end),
    features: raw.features ?? {},
    limits: raw.limits ?? {},
    trialReminders: raw.trial_reminders ?? [],
  };
}

export function mapInvoice(raw: Raw): SubscriptionInvoice {
  return {
    id: String(raw.id ?? ""),
    number: raw.number,
    status: raw.status,
    billingPeriod: raw.billing_period ?? "monthly",
    currency: raw.currency ?? "IDR",
    subtotal: num(raw.subtotal),
    discount: num(raw.discount),
    tax: num(raw.tax),
    total: num(raw.total),
    amountPaid: num(raw.amount_paid),
    lineItems: Array.isArray(raw.line_items) ? raw.line_items : [],
    plan: raw.plan ? { slug: raw.plan.slug, name: raw.plan.name } : null,
    issuedAt: raw.issued_at ?? null,
    dueAt: raw.due_at ?? null,
    paidAt: raw.paid_at ?? null,
    createdAt: raw.created_at ?? "",
    payments: Array.isArray(raw.payments) ? raw.payments.map(mapPayment) : [],
  };
}

export function mapPayment(raw: Raw): SubscriptionPayment {
  return {
    id: String(raw.id ?? ""),
    provider: raw.provider,
    providerReference: raw.provider_reference ?? null,
    status: raw.status,
    amount: num(raw.amount),
    currency: raw.currency ?? "IDR",
    method: raw.method ?? null,
    failureReason: raw.failure_reason ?? null,
    paidAt: raw.paid_at ?? null,
    expiresAt: raw.expires_at ?? null,
    createdAt: raw.created_at ?? "",
  };
}

export function mapSubscriptionDetail(raw: Raw): SubscriptionDetail {
  const s = raw.subscription ?? {};
  return {
    businessId: String(raw.business_id ?? ""),
    subscription: {
      id: String(s.id ?? ""),
      status: s.status,
      rawStatus: s.raw_status ?? s.status,
      isActive: Boolean(s.is_active),
      billingPeriod: s.billing_period ?? "monthly",
      trialStartsAt: s.trial_starts_at ?? null,
      trialEndsAt: s.trial_ends_at ?? null,
      trialDaysRemaining: num(s.trial_days_remaining),
      startsAt: s.starts_at ?? null,
      currentPeriodStart: s.current_period_start ?? null,
      currentPeriodEnd: s.current_period_end ?? null,
      endsAt: s.ends_at ?? null,
      daysRemaining: num(s.days_remaining),
      graceEndsAt: s.grace_ends_at ?? null,
      cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
      canceledAt: s.canceled_at ?? null,
      nextBillingDate: s.next_billing_date ?? null,
      provider: s.provider ?? null,
      priceAmount: num(s.price_amount),
      currency: s.currency ?? "IDR",
      pendingPlan: s.pending_plan ? mapPlan(s.pending_plan) : null,
    },
    plan: raw.plan ? mapPlan(raw.plan) : null,
    usage: Array.isArray(raw.usage) ? raw.usage : [],
    features: raw.features ?? {},
    availablePlans: Array.isArray(raw.available_plans) ? raw.available_plans.map(mapPlan) : [],
    openInvoice: raw.open_invoice ? mapInvoice(raw.open_invoice) : null,
    trialReminders: raw.trial_reminders ?? [],
    providerStatus: raw.provider_status ?? {},
    canManage: Boolean(raw.can_manage),
  };
}

function mapCheckout(raw: Raw): CheckoutResult {
  const checkout = raw.checkout ?? {};
  return {
    invoice: mapInvoice(raw.invoice ?? {}),
    payment: mapPayment(raw.payment ?? {}),
    checkout: {
      provider: checkout.provider ?? "",
      status: checkout.status ?? "",
      redirectUrl: checkout.redirect_url ?? null,
      instructions: checkout.instructions ?? null,
      reference: checkout.reference ?? null,
    },
  };
}

function mapHistoryEntry(raw: Raw): SubscriptionHistoryEntry {
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

/* ───────────────────────────── public ───────────────────────────── */

export async function getPricing(): Promise<PricingPayload> {
  if (USE_MOCK_API) {
    return mockPricing();
  }
  const raw = await apiRequest<Raw>("/plans");
  return {
    currency: raw.currency ?? "IDR",
    trialDays: num(raw.trial_days),
    plans: (raw.plans ?? []).map(mapPlan),
    comparison: raw.comparison ?? [],
    limits: raw.limits ?? [],
  };
}

/* ─────────────────────────── tenant-facing ──────────────────────── */

export async function getSubscription(): Promise<SubscriptionDetail> {
  if (USE_MOCK_API) {
    return mockSubscriptionDetail();
  }
  return mapSubscriptionDetail(await apiRequest<Raw>("/subscription"));
}

export async function listPlans(): Promise<{ plans: PlanApi[]; providers: { name: string; label: string; sandbox: boolean }[]; current: PlanApi | null }> {
  if (USE_MOCK_API) {
    return mockPlansList();
  }
  const raw = await apiRequest<Raw>("/subscription/plans");
  return {
    plans: (raw.plans ?? []).map(mapPlan),
    providers: raw.providers ?? [],
    current: raw.current ? mapPlan(raw.current) : null,
  };
}

export async function createCheckout(input: { plan: string; billingPeriod: "monthly" | "yearly"; provider?: string; idempotencyKey?: string }): Promise<CheckoutResult> {
  if (USE_MOCK_API) {
    return mockCheckout();
  }
  const raw = await apiRequest<Raw>("/subscription/checkout", {
    method: "POST",
    body: { plan: input.plan, billing_period: input.billingPeriod, provider: input.provider, idempotency_key: input.idempotencyKey },
  });
  return mapCheckout(raw);
}

export async function changePlan(input: { plan: string; billingPeriod: "monthly" | "yearly"; provider?: string }): Promise<{ requiresPayment: boolean; checkout?: CheckoutResult; subscription: SubscriptionDetail; scheduled?: boolean; effectiveAt?: string }> {
  if (USE_MOCK_API) {
    return mockChangePlan(input);
  }
  const raw = await apiRequest<Raw>("/subscription/change-plan", {
    method: "POST",
    body: { plan: input.plan, billing_period: input.billingPeriod, provider: input.provider },
  });
  return {
    requiresPayment: Boolean(raw.requires_payment),
    checkout: raw.checkout ? mapCheckout(raw.checkout) : undefined,
    subscription: mapSubscriptionDetail(raw.subscription ?? {}),
    scheduled: raw.scheduled,
    effectiveAt: raw.effective_at,
  };
}

export async function renewSubscription(input: { billingPeriod?: "monthly" | "yearly"; provider?: string }): Promise<CheckoutResult> {
  if (USE_MOCK_API) {
    return mockCheckout();
  }
  const raw = await apiRequest<Raw>("/subscription/renew", {
    method: "POST",
    body: { billing_period: input.billingPeriod, provider: input.provider },
  });
  return mapCheckout(raw);
}

export async function cancelSubscription(): Promise<{ subscription: SubscriptionDetail }> {
  if (USE_MOCK_API) {
    return { subscription: { ...mockSubscriptionDetail() } };
  }
  const raw = await apiRequest<Raw>("/subscription/cancel", { method: "POST" });
  return { subscription: mapSubscriptionDetail(raw.subscription ?? {}) };
}

export async function resumeSubscription(): Promise<{ subscription: SubscriptionDetail }> {
  if (USE_MOCK_API) {
    return { subscription: { ...mockSubscriptionDetail() } };
  }
  const raw = await apiRequest<Raw>("/subscription/resume", { method: "POST" });
  return { subscription: mapSubscriptionDetail(raw.subscription ?? {}) };
}

export async function listInvoices(page = 1, perPage = 20): Promise<{ data: SubscriptionInvoice[]; page: number; totalPages: number; total: number }> {
  if (USE_MOCK_API) {
    return { data: mockDb.subscriptionInvoices, page, totalPages: 1, total: mockDb.subscriptionInvoices.length };
  }
  const data = await apiRequest<any>(`/subscription/invoices?per_page=${perPage}`);
  const items = Array.isArray(data?.data) ? data.data : [];
  return {
    data: items.map(mapInvoice),
    page,
    totalPages: data?.meta?.last_page ?? 1,
    total: data?.meta?.total ?? items.length,
  };
}

export async function listPayments(page = 1, perPage = 20): Promise<{ data: SubscriptionPayment[]; page: number; totalPages: number; total: number }> {
  if (USE_MOCK_API) {
    return { data: mockDb.subscriptionPayments, page, totalPages: 1, total: mockDb.subscriptionPayments.length };
  }
  const data = await apiRequest<any>(`/subscription/payments?per_page=${perPage}`);
  const items = Array.isArray(data?.data) ? data.data : [];
  return {
    data: items.map(mapPayment),
    page,
    totalPages: data?.meta?.last_page ?? 1,
    total: data?.meta?.total ?? items.length,
  };
}

export async function syncPayment(paymentId: string): Promise<{ status: string; payment: SubscriptionPayment }> {
  if (USE_MOCK_API) {
    const pay = mockDb.subscriptionPayments.find((p) => p.id === paymentId);
    return { status: pay?.status ?? "paid", payment: pay! };
  }
  const raw = await apiRequest<Raw>(`/subscription/payments/${paymentId}/sync`, { method: "POST" });
  return { status: raw.status, payment: mapPayment(raw.payment ?? {}) };
}

export async function completeSandboxPayment(paymentId: string): Promise<{ status: string; payment: SubscriptionPayment }> {
  if (USE_MOCK_API) {
    const pay = mockDb.subscriptionPayments.find((p) => p.id === paymentId);
    if (pay) pay.status = "paid";
    return { status: "paid", payment: pay! };
  }
  const raw = await apiRequest<Raw>(`/subscription/payments/${paymentId}/sandbox-complete`, { method: "POST" });
  return { status: raw.status, payment: mapPayment(raw.payment ?? {}) };
}

export async function listSubscriptionHistory(): Promise<SubscriptionHistoryEntry[]> {
  if (USE_MOCK_API) {
    return [...mockDb.subscriptionHistory];
  }
  const data = await apiRequest<Raw[]>("/subscription/history");
  return Array.isArray(data) ? data.map(mapHistoryEntry) : [];
}

/* ─────────────────────────────── mock ───────────────────────────── */

function mockPricing(): PricingPayload {
  return {
    currency: "IDR",
    trialDays: 30,
    plans: [
      { id: "1", slug: "trial", name: "Free Trial", description: "", sortOrder: 0, isPublic: true, isActive: true, isTrial: true, trialDays: 30, currency: "IDR", prices: { monthly: 0, yearly: 0 }, limits: { businesses: 1, outlets: 1, users: 3, products: 100, customers: 100, transactions_per_month: 100, exports_per_month: 10 }, features: {} },
      { id: "2", slug: "basic", name: "Basic", description: "For a single shop that needs the full counter and back office.", sortOrder: 1, isPublic: true, isActive: true, isTrial: false, trialDays: 0, currency: "IDR", prices: { monthly: 69000, yearly: 720000 }, limits: { businesses: 1, outlets: 1, users: 3, products: 500, customers: 1000, transactions_per_month: 2000, exports_per_month: 100 }, features: {} },
      { id: "3", slug: "pro", name: "Pro", description: "For growing retailers with several outlets and deeper reporting.", sortOrder: 2, isPublic: true, isActive: true, isTrial: false, trialDays: 0, currency: "IDR", prices: { monthly: 89000, yearly: 890000 }, limits: { businesses: 1, outlets: 10, users: 20, products: null, customers: null, transactions_per_month: null, exports_per_month: null }, features: {} },
    ],
    comparison: [],
    limits: [],
  };
}

function mockPlansList() {
  return {
    plans: [
      { id: "2", slug: "basic", name: "Basic", description: "", sortOrder: 1, isPublic: true, isActive: true, isTrial: false, trialDays: 0, currency: "IDR", prices: { monthly: 69000, yearly: 720000 }, limits: {}, features: {} },
      { id: "3", slug: "pro", name: "Pro", description: "", sortOrder: 2, isPublic: true, isActive: true, isTrial: false, trialDays: 0, currency: "IDR", prices: { monthly: 89000, yearly: 890000 }, limits: {}, features: {} },
    ],
    providers: [{ name: "manual", label: "Bank transfer", sandbox: false }],
    current: { id: "1", slug: "trial", name: "Free Trial", description: "", sortOrder: 0, isPublic: true, isActive: true, isTrial: true, trialDays: 30, currency: "IDR", prices: { monthly: 0, yearly: 0 }, limits: {}, features: {} },
  };
}

function mockSubscriptionDetail(): SubscriptionDetail {
  const now = new Date().toISOString();
  const ends = new Date(Date.now() + 30 * 86400000).toISOString();
  return {
    businessId: mockDb.business.id,
    subscription: {
      id: "1",
      status: "trialing",
      rawStatus: "trialing",
      isActive: true,
      billingPeriod: "monthly",
      trialStartsAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      trialEndsAt: ends,
      trialDaysRemaining: 23,
      startsAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      currentPeriodStart: new Date(Date.now() - 7 * 86400000).toISOString(),
      currentPeriodEnd: ends,
      endsAt: ends,
      daysRemaining: 23,
      graceEndsAt: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      nextBillingDate: null,
      provider: null,
      priceAmount: 0,
      currency: "IDR",
      pendingPlan: null,
    },
    plan: null,
    usage: [
      { metric: "products", label: "Products", used: 12, limit: 100, remaining: 88, percent: 12, level: "ok", unlimited: false },
      { metric: "customers", label: "Customers", used: 5, limit: 100, remaining: 95, percent: 5, level: "ok", unlimited: false },
      { metric: "outlets", label: "Outlets", used: 1, limit: 1, remaining: 0, percent: 100, level: "reached", unlimited: false },
      { metric: "users", label: "Users", used: 2, limit: 3, remaining: 1, percent: 67, level: "ok", unlimited: false },
      { metric: "transactions_per_month", label: "Transactions this month", used: 34, limit: 100, remaining: 66, percent: 34, level: "ok", unlimited: false },
      { metric: "exports_per_month", label: "Exports this month", used: 0, limit: 10, remaining: 10, percent: 0, level: "ok", unlimited: false },
    ],
    features: {},
    availablePlans: mockPlansList().plans,
    openInvoice: null,
    trialReminders: [14, 7, 3, 1],
    providerStatus: { manual: { enabled: true, label: "Bank transfer" } },
  };
}

function mockCheckout(): CheckoutResult {
  return {
    invoice: { id: mockId("inv"), number: `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${mockDb.business.id}-ABC123`, status: "open", billingPeriod: "monthly", currency: "IDR", subtotal: 69000, discount: 0, tax: 0, total: 69000, amountPaid: 0, lineItems: [], plan: { slug: "basic", name: "Basic" }, issuedAt: new Date().toISOString(), dueAt: new Date(Date.now() + 7 * 86400000).toISOString(), paidAt: null, createdAt: new Date().toISOString(), payments: [] },
    payment: { id: mockId("pay"), provider: "manual", providerReference: "MAN-INV-TEST", status: "pending", amount: 69000, currency: "IDR", method: "manual", failureReason: null, paidAt: null, expiresAt: new Date(Date.now() + 86400000).toISOString(), createdAt: new Date().toISOString() },
    checkout: { provider: "manual", status: "pending", redirectUrl: null, instructions: "Transfer the invoice total to the account shown on the invoice, then reply with the transfer reference.", reference: "MAN-INV-TEST" },
  };
}

function mockChangePlan(_input: { plan: string; billingPeriod: string }): { requiresPayment: boolean; subscription: SubscriptionDetail } {
  return { requiresPayment: true, subscription: { ...mockSubscriptionDetail() } };
}
