import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type { CheckoutResult, PlanApi, PricingPayload, SubscriptionDetail, SubscriptionInvoice, SubscriptionPayment, SubscriptionHistoryEntry } from "./types";

/* ───────────────────────────── public ───────────────────────────── */

export async function getPricing(): Promise<PricingPayload> {
  if (USE_MOCK_API) {
    return mockPricing();
  }
  const data = await apiRequest<PricingPayload>("/plans");
  return data;
}

/* ─────────────────────────── tenant-facing ──────────────────────── */

export async function getSubscription(): Promise<SubscriptionDetail> {
  if (USE_MOCK_API) {
    return mockSubscriptionDetail();
  }
  const data = await apiRequest<SubscriptionDetail>("/subscription");
  return data;
}

export async function listPlans(): Promise<{ plans: PlanApi[]; providers: { name: string; label: string; sandbox: boolean }[]; current: PlanApi | null }> {
  if (USE_MOCK_API) {
    return mockPlansList();
  }
  const data = await apiRequest<{ plans: PlanApi[]; providers: { name: string; label: string; sandbox: boolean }[]; current: PlanApi | null }>("/subscription/plans");
  return data;
}

export async function createCheckout(input: { plan: string; billingPeriod: "monthly" | "yearly"; provider?: string; idempotencyKey?: string }): Promise<CheckoutResult> {
  if (USE_MOCK_API) {
    return mockCheckout();
  }
  const data = await apiRequest<CheckoutResult>("/subscription/checkout", {
    method: "POST",
    body: { plan: input.plan, billing_period: input.billingPeriod, provider: input.provider, idempotency_key: input.idempotencyKey },
  });
  return data;
}

export async function changePlan(input: { plan: string; billingPeriod: "monthly" | "yearly"; provider?: string }): Promise<{ requiresPayment: boolean; checkout?: CheckoutResult; subscription: SubscriptionDetail; scheduled?: boolean; effectiveAt?: string }> {
  if (USE_MOCK_API) {
    return mockChangePlan(input);
  }
  const data = await apiRequest<{ requiresPayment: boolean; checkout?: CheckoutResult; subscription: SubscriptionDetail; scheduled?: boolean; effectiveAt?: string }>("/subscription/change-plan", {
    method: "POST",
    body: { plan: input.plan, billing_period: input.billingPeriod, provider: input.provider },
  });
  return data;
}

export async function renewSubscription(input: { billingPeriod?: "monthly" | "yearly"; provider?: string }): Promise<CheckoutResult> {
  if (USE_MOCK_API) {
    return mockCheckout();
  }
  const data = await apiRequest<CheckoutResult>("/subscription/renew", {
    method: "POST",
    body: { billing_period: input.billingPeriod, provider: input.provider },
  });
  return data;
}

export async function cancelSubscription(): Promise<{ subscription: SubscriptionDetail }> {
  if (USE_MOCK_API) {
    return { subscription: { ...mockSubscriptionDetail() } };
  }
  const data = await apiRequest<{ subscription: SubscriptionDetail }>("/subscription/cancel", { method: "POST" });
  return data;
}

export async function resumeSubscription(): Promise<{ subscription: SubscriptionDetail }> {
  if (USE_MOCK_API) {
    return { subscription: { ...mockSubscriptionDetail() } };
  }
  const data = await apiRequest<{ subscription: SubscriptionDetail }>("/subscription/resume", { method: "POST" });
  return data;
}

export async function listInvoices(page = 1, perPage = 20): Promise<{ data: SubscriptionInvoice[]; page: number; totalPages: number; total: number }> {
  if (USE_MOCK_API) {
    return { data: mockDb.subscriptionInvoices, page, totalPages: 1, total: mockDb.subscriptionInvoices.length };
  }
  const data = await apiRequest<any>(`/subscription/invoices?per_page=${perPage}`);
  const items = Array.isArray(data?.data) ? data.data : [];
  return {
    data: items as SubscriptionInvoice[],
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
    data: items as SubscriptionPayment[],
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
  const data = await apiRequest<{ status: string; payment: SubscriptionPayment }>(`/subscription/payments/${paymentId}/sync`, { method: "POST" });
  return data;
}

export async function completeSandboxPayment(paymentId: string): Promise<{ status: string; payment: SubscriptionPayment }> {
  if (USE_MOCK_API) {
    const pay = mockDb.subscriptionPayments.find((p) => p.id === paymentId);
    if (pay) pay.status = "paid";
    return { status: "paid", payment: pay! };
  }
  const data = await apiRequest<{ status: string; payment: SubscriptionPayment }>(`/subscription/payments/${paymentId}/sandbox-complete`, { method: "POST" });
  return data;
}

export async function listSubscriptionHistory(): Promise<SubscriptionHistoryEntry[]> {
  if (USE_MOCK_API) {
    return [...mockDb.subscriptionHistory];
  }
  const data = await apiRequest<SubscriptionHistoryEntry[]>("/subscription/history");
  return Array.isArray(data) ? data : [];
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
