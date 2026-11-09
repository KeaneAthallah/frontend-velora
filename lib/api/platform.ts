import { apiRequest, USE_MOCK_API } from "./client";
import { mockId } from "./mock-db";

export type PlatformOverview = {
  businesses: { total: number; active: number; newThisMonth: number; bySubscription: Record<string, number> };
  users: { total: number; newThisMonth: number; platformAdmins: number };
  commerce: { salesThisMonth: number; revenueThisMonth: number; invoicesThisMonth: number; mrr: number; currency: string };
  health: { openTickets: number; failedWebhooks24h: number; failedPaymentWebhooks24h: number; pastDueSubscriptions: number };
  recentSignups: { id: string; name: string; industry?: string; plan?: string; subscriptionStatus?: string; createdAt: string }[];
};

export type PlatformTenant = {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  status: string;
  currency?: string;
  outlets?: number;
  members?: number;
  activeMembers?: number;
  createdAt: string;
  subscription?: {
    status?: string;
    plan?: string;
    planSlug?: string;
    billingPeriod?: string;
    daysRemaining?: number;
  } | null;
};

export type PlatformTicket = {
  id: string;
  number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  business?: string;
  createdBy?: string;
  assignedTo?: string;
  createdAt: string;
};

export type PlatformMonitoring = {
  counts: {
    businesses: number;
    users: number;
    outlets: number;
    sales: number;
    documents: number;
    webhookDeliveries: number;
  };
  failedWebhookDeliveries: {
    id: string;
    event: string;
    endpoint?: string;
    url?: string;
    attempts: number;
    responseStatus?: number;
    updatedAt?: string;
  }[];
  failedPaymentWebhooks: {
    id: string;
    provider: string;
    eventId?: string;
    error?: string;
    updatedAt?: string;
  }[];
  pastDue: { business?: string; plan?: string; endsAt?: string }[];
  auditActivity: { action: string; total: number }[];
};

export type PlatformSettings = {
  settings: { key: string; group: string; value: unknown; description?: string; updatedAt?: string }[];
  defaults: Record<string, { value: unknown; description?: string }>;
};

function num(value: unknown) {
  return Number(value ?? 0);
}

function normalizeTenant(raw: any): PlatformTenant {
  return {
    id: String(raw.id),
    name: raw.name ?? "",
    slug: raw.slug ?? "",
    industry: raw.industry ?? undefined,
    status: raw.status ?? "active",
    currency: raw.currency ?? undefined,
    outlets: raw.outlets != null ? num(raw.outlets) : undefined,
    members: raw.members != null ? num(raw.members) : undefined,
    activeMembers: raw.active_members != null ? num(raw.active_members) : undefined,
    createdAt: raw.created_at ?? new Date().toISOString(),
    subscription: raw.subscription
      ? {
          status: raw.subscription.status,
          plan: raw.subscription.plan,
          planSlug: raw.subscription.plan_slug,
          billingPeriod: raw.subscription.billing_period,
          daysRemaining: raw.subscription.days_remaining,
        }
      : null,
  };
}

function normalizeTicket(raw: any): PlatformTicket {
  return {
    id: String(raw.id),
    number: raw.number ?? "",
    subject: raw.subject ?? "",
    category: raw.category ?? "general",
    priority: raw.priority ?? "normal",
    status: raw.status ?? "open",
    business: raw.business ?? undefined,
    createdBy: raw.created_by ?? undefined,
    assignedTo: raw.assigned_to ?? undefined,
    createdAt: raw.created_at ?? new Date().toISOString(),
  };
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  if (USE_MOCK_API) {
    return {
      businesses: {
        total: 12,
        active: 10,
        newThisMonth: 2,
        bySubscription: { active: 7, trialing: 3, past_due: 1, none: 1 },
      },
      users: { total: 48, newThisMonth: 6, platformAdmins: 1 },
      commerce: { salesThisMonth: 240, revenueThisMonth: 18_400_000, invoicesThisMonth: 4, mrr: 4_800_000, currency: "IDR" },
      health: { openTickets: 3, failedWebhooks24h: 0, failedPaymentWebhooks24h: 0, pastDueSubscriptions: 1 },
      recentSignups: [
        { id: mockId("biz"), name: "Kopi Senja", industry: "cafe", plan: "Growth", subscriptionStatus: "trialing", createdAt: new Date().toISOString() },
      ],
    };
  }

  const data = await apiRequest<any>("/admin/dashboard");
  return {
    businesses: {
      total: num(data?.businesses?.total),
      active: num(data?.businesses?.active),
      newThisMonth: num(data?.businesses?.new_this_month),
      bySubscription: data?.businesses?.by_subscription ?? {},
    },
    users: {
      total: num(data?.users?.total),
      newThisMonth: num(data?.users?.new_this_month),
      platformAdmins: num(data?.users?.platform_admins),
    },
    commerce: {
      salesThisMonth: num(data?.commerce?.sales_this_month),
      revenueThisMonth: num(data?.commerce?.revenue_this_month),
      invoicesThisMonth: num(data?.commerce?.invoices_this_month),
      mrr: num(data?.commerce?.mrr),
      currency: data?.commerce?.currency ?? "IDR",
    },
    health: {
      openTickets: num(data?.health?.open_tickets),
      failedWebhooks24h: num(data?.health?.failed_webhooks_24h),
      failedPaymentWebhooks24h: num(data?.health?.failed_payment_webhooks_24h),
      pastDueSubscriptions: num(data?.health?.past_due_subscriptions),
    },
    recentSignups: (data?.recent_signups ?? []).map((row: any) => ({
      id: String(row.id),
      name: row.name ?? "",
      industry: row.industry ?? undefined,
      plan: row.plan ?? undefined,
      subscriptionStatus: row.subscription_status ?? undefined,
      createdAt: row.created_at ?? new Date().toISOString(),
    })),
  };
}

export async function listPlatformTenants(params?: { q?: string; status?: string }): Promise<PlatformTenant[]> {
  if (USE_MOCK_API) {
    return [
      {
        id: mockId("biz"),
        name: "Kopi Senja",
        slug: "kopi-senja",
        industry: "cafe",
        status: "active",
        outlets: 2,
        members: 5,
        activeMembers: 4,
        createdAt: new Date().toISOString(),
        subscription: { status: "trialing", plan: "Growth", daysRemaining: 18 },
      },
    ];
  }

  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.status) query.set("status", params.status);
  const data = await apiRequest<any>(`/admin/tenants${query.toString() ? `?${query}` : ""}`);
  return (data?.data ?? []).map(normalizeTenant);
}

export async function listPlatformTickets(params?: { status?: string }): Promise<PlatformTicket[]> {
  if (USE_MOCK_API) {
    return [
      {
        id: mockId("tkt"),
        number: "TKT-DEMO1234",
        subject: "Printer stops after the first receipt",
        category: "technical",
        priority: "high",
        status: "pending",
        business: "Kopi Senja",
        createdBy: "Ayu",
        createdAt: new Date().toISOString(),
      },
    ];
  }

  const data = await apiRequest<any>(`/admin/tickets${params?.status ? `?status=${params.status}` : ""}`);
  return (data?.tickets?.data ?? []).map(normalizeTicket);
}

export async function replyPlatformTicket(id: string, body: string, status?: string): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest(`/admin/tickets/${id}/reply`, { method: "POST", body: { body, status } });
}

export async function updatePlatformTicket(id: string, input: { status?: string; priority?: string }): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest(`/admin/tickets/${id}`, { method: "PUT", body: input });
}

export async function getPlatformMonitoring(): Promise<PlatformMonitoring> {
  if (USE_MOCK_API) {
    return {
      counts: { businesses: 12, users: 48, outlets: 18, sales: 3120, documents: 41, webhookDeliveries: 96 },
      failedWebhookDeliveries: [
        {
          id: mockId("whd"),
          event: "sale.created",
          endpoint: "Warehouse sync",
          url: "https://example.test/hooks/velora",
          attempts: 3,
          responseStatus: 502,
          updatedAt: new Date().toISOString(),
        },
      ],
      failedPaymentWebhooks: [],
      pastDue: [{ business: "Kopi Senja", plan: "Growth", endsAt: new Date().toISOString() }],
      auditActivity: [
        { action: "sale.created", total: 128 },
        { action: "product.updated", total: 12 },
      ],
    };
  }

  const data = await apiRequest<any>("/admin/monitoring");
  return {
    counts: {
      businesses: num(data?.counts?.businesses),
      users: num(data?.counts?.users),
      outlets: num(data?.counts?.outlets),
      sales: num(data?.counts?.sales),
      documents: num(data?.counts?.documents),
      webhookDeliveries: num(data?.counts?.webhook_deliveries),
    },
    failedWebhookDeliveries: (data?.failed_webhook_deliveries ?? []).map((row: any) => ({
      id: String(row.id),
      event: row.event ?? "",
      endpoint: row.endpoint ?? undefined,
      url: row.url ?? undefined,
      attempts: num(row.attempts),
      responseStatus: row.response_status ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })),
    failedPaymentWebhooks: (data?.failed_payment_webhooks ?? []).map((row: any) => ({
      id: String(row.id),
      provider: row.provider ?? "",
      eventId: row.event_id ?? undefined,
      error: row.error ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })),
    pastDue: (data?.past_due ?? []).map((row: any) => ({
      business: row.business ?? undefined,
      plan: row.plan ?? undefined,
      endsAt: row.ends_at ?? undefined,
    })),
    auditActivity: (data?.audit_activity_24h ?? []).map((row: any) => ({
      action: row.action ?? "",
      total: num(row.total),
    })),
  };
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (USE_MOCK_API) {
    return {
      settings: [],
      defaults: {
        "support.email": { value: "support@velora.test", description: "Reply-to address for support." },
        "signup.enabled": { value: true, description: "Allow self-registration." },
      },
    };
  }

  const data = await apiRequest<any>("/admin/settings");
  return {
    settings: (data?.settings ?? []).map((row: any) => ({
      key: row.key,
      group: row.group,
      value: row.value,
      description: row.description ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })),
    defaults: data?.defaults ?? {},
  };
}

export async function updatePlatformSettings(settings: Record<string, unknown>): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest("/admin/settings", { method: "PUT", body: { settings } });
}
