import { apiRequest, USE_MOCK_API } from "./client";
import { mockId } from "./mock-db";

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  rateLimit: number;
  lastUsedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  createdAt: string;
};

export type WebhookEndpoint = {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  description?: string;
  failureCount: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  deliveriesCount?: number;
};

export type WebhookDelivery = {
  id: string;
  event: string;
  endpoint?: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  responseStatus?: number;
  responseBody?: string;
  deliveredAt?: string;
  nextAttemptAt?: string;
  createdAt: string;
};

export const WEBHOOK_EVENTS = [
  "sale.completed",
  "sale.voided",
  "order.created",
  "order.status_changed",
  "payment.recorded",
  "inventory.low_stock",
  "subscription.updated",
];

function normalizeKey(raw: any): ApiKey {
  return {
    id: String(raw.id),
    name: raw.name ?? "",
    prefix: raw.prefix ?? "",
    scopes: raw.scopes ?? ["read", "write"],
    rateLimit: Number(raw.rate_limit ?? 60),
    lastUsedAt: raw.last_used_at ?? undefined,
    expiresAt: raw.expires_at ?? undefined,
    revokedAt: raw.revoked_at ?? undefined,
    createdAt: raw.created_at ?? new Date().toISOString(),
  };
}

function normalizeEndpoint(raw: any): WebhookEndpoint {
  return {
    id: String(raw.id),
    name: raw.name ?? "",
    url: raw.url ?? "",
    events: raw.events ?? [],
    active: raw.is_active !== false,
    description: raw.description ?? undefined,
    failureCount: Number(raw.failure_count ?? 0),
    lastSuccessAt: raw.last_success_at ?? undefined,
    lastFailureAt: raw.last_failure_at ?? undefined,
    deliveriesCount: raw.deliveries_count != null ? Number(raw.deliveries_count) : undefined,
  };
}

function normalizeDelivery(raw: any): WebhookDelivery {
  return {
    id: String(raw.id),
    event: raw.event ?? "",
    endpoint: raw.endpoint ?? undefined,
    status: (raw.status ?? "pending") as WebhookDelivery["status"],
    attempts: Number(raw.attempts ?? 0),
    responseStatus: raw.response_status != null ? Number(raw.response_status) : undefined,
    responseBody: raw.response_body ?? undefined,
    deliveredAt: raw.delivered_at ?? undefined,
    nextAttemptAt: raw.next_attempt_at ?? undefined,
    createdAt: raw.created_at ?? new Date().toISOString(),
  };
}

export async function listApiKeys(): Promise<ApiKey[]> {
  if (USE_MOCK_API) {
    return [
      {
        id: mockId("key"),
        name: "Storefront integration",
        prefix: "vlr_demoonly",
        scopes: ["read"],
        rateLimit: 60,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  const data = await apiRequest<any>("/api-keys");
  return (data?.api_keys ?? []).map(normalizeKey);
}

export async function createApiKey(input: {
  name: string;
  scopes: string[];
  rateLimit?: number;
}): Promise<{ apiKey: ApiKey; key: string }> {
  if (USE_MOCK_API) {
    const key = `vlr_${mockId("mock").replace(/[^a-z0-9]/gi, "")}_${mockId("secret").replace(/[^a-z0-9]/gi, "")}`;
    return {
      apiKey: {
        id: mockId("key"),
        name: input.name,
        prefix: key.split("_").slice(0, 2).join("_"),
        scopes: input.scopes,
        rateLimit: input.rateLimit ?? 60,
        createdAt: new Date().toISOString(),
      },
      key,
    };
  }

  const data = await apiRequest<any>("/api-keys", {
    method: "POST",
    body: { name: input.name, scopes: input.scopes, rate_limit: input.rateLimit },
  });
  return { apiKey: normalizeKey(data.api_key), key: data.key };
}

export async function revokeApiKey(id: string): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest(`/api-keys/${id}`, { method: "DELETE" });
}

export async function rotateApiKey(id: string): Promise<string> {
  if (USE_MOCK_API) return `vlr_${mockId("mock")}_${mockId("secret")}`;
  const data = await apiRequest<any>(`/api-keys/${id}/rotate`, { method: "POST" });
  return data.key;
}

export async function listWebhookEndpoints(): Promise<{ endpoints: WebhookEndpoint[]; events: string[] }> {
  if (USE_MOCK_API) {
    return {
      endpoints: [
        {
          id: mockId("wh"),
          name: "Accounting sync",
          url: "https://example.test/hooks/velora",
          events: ["sale.completed"],
          active: true,
          failureCount: 0,
        },
      ],
      events: WEBHOOK_EVENTS,
    };
  }

  const data = await apiRequest<any>("/webhooks/endpoints");
  return {
    endpoints: (data?.endpoints ?? []).map(normalizeEndpoint),
    events: data?.events ?? WEBHOOK_EVENTS,
  };
}

export async function createWebhookEndpoint(input: {
  name: string;
  url: string;
  events: string[];
}): Promise<{ endpoint: WebhookEndpoint; secret: string }> {
  if (USE_MOCK_API) {
    return {
      endpoint: {
        id: mockId("wh"),
        name: input.name,
        url: input.url,
        events: input.events,
        active: true,
        failureCount: 0,
      },
      secret: mockId("secret").replace(/[^a-z0-9]/gi, ""),
    };
  }

  const data = await apiRequest<any>("/webhooks/endpoints", { method: "POST", body: input });
  return { endpoint: normalizeEndpoint(data.endpoint), secret: data.secret };
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest(`/webhooks/endpoints/${id}`, { method: "DELETE" });
}

export async function testWebhookEndpoint(id: string): Promise<WebhookDelivery> {
  if (USE_MOCK_API) {
    return {
      id: mockId("del"),
      event: "webhook.test",
      status: "delivered",
      attempts: 1,
      responseStatus: 200,
      createdAt: new Date().toISOString(),
    };
  }

  const data = await apiRequest<any>(`/webhooks/endpoints/${id}/test`, { method: "POST" });
  return normalizeDelivery(data.delivery);
}

export async function listWebhookDeliveries(status?: string): Promise<WebhookDelivery[]> {
  if (USE_MOCK_API) {
    return [
      {
        id: mockId("del"),
        event: "webhook.test",
        endpoint: "Accounting sync",
        status: "delivered",
        attempts: 1,
        responseStatus: 200,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  const data = await apiRequest<any>(`/webhooks/deliveries${status ? `?status=${status}` : ""}`);
  return (data?.data ?? []).map(normalizeDelivery);
}

export async function retryWebhookDelivery(id: string): Promise<WebhookDelivery> {
  if (USE_MOCK_API) {
    return {
      id,
      event: "webhook.test",
      status: "delivered",
      attempts: 2,
      responseStatus: 200,
      createdAt: new Date().toISOString(),
    };
  }

  const data = await apiRequest<any>(`/webhooks/deliveries/${id}/retry`, { method: "POST" });
  return normalizeDelivery(data.delivery);
}
