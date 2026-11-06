import { apiRequest, USE_MOCK_API } from "./client";
import { mockId } from "./mock-db";

export type Storefront = {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  active: boolean;
  publishedAt?: string;
  itemsCount?: number;
  ordersCount?: number;
};

export type StorefrontOrder = {
  id: string;
  number: string;
  status: string;
  customerName?: string;
  total: number;
  fulfilmentType?: string;
  createdAt: string;
};

function normalizeStorefront(raw: any): Storefront {
  return {
    id: String(raw.id),
    name: raw.name ?? "",
    slug: raw.slug ?? "",
    domain: raw.domain ?? undefined,
    active: raw.is_active === true,
    publishedAt: raw.published_at ?? undefined,
    itemsCount: raw.items_count != null ? Number(raw.items_count) : undefined,
    ordersCount: raw.orders_count != null ? Number(raw.orders_count) : undefined,
  };
}

export async function listStorefronts(): Promise<Storefront[]> {
  if (USE_MOCK_API) {
    return [
      {
        id: mockId("sf"),
        name: "Kopi Senja online",
        slug: "kopi-senja",
        active: true,
        publishedAt: new Date().toISOString(),
        itemsCount: 24,
        ordersCount: 6,
      },
    ];
  }

  const data = await apiRequest<any>("/storefronts");
  const rows = Array.isArray(data) ? data : data?.data ?? [];
  return rows.map(normalizeStorefront);
}

export async function createStorefront(input: {
  name: string;
  slug?: string;
  domain?: string;
}): Promise<Storefront> {
  if (USE_MOCK_API) {
    return {
      id: mockId("sf"),
      name: input.name,
      slug: input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      domain: input.domain,
      active: false,
      itemsCount: 0,
      ordersCount: 0,
    };
  }

  const data = await apiRequest<any>("/storefronts", {
    method: "POST",
    body: { name: input.name, slug: input.slug || undefined, domain: input.domain || undefined },
  });
  return normalizeStorefront(data);
}

export async function setStorefrontPublished(id: string, published: boolean): Promise<Storefront> {
  if (USE_MOCK_API) {
    return {
      id,
      name: "Kopi Senja online",
      slug: "kopi-senja",
      active: published,
      publishedAt: published ? new Date().toISOString() : undefined,
    };
  }

  const data = await apiRequest<any>(`/storefronts/${id}/${published ? "publish" : "unpublish"}`, {
    method: "POST",
  });
  return normalizeStorefront(data);
}

export async function listStorefrontOrders(): Promise<StorefrontOrder[]> {
  if (USE_MOCK_API) {
    return [
      {
        id: mockId("sfo"),
        number: "WEB-1042",
        status: "pending",
        customerName: "Dewi",
        total: 86_000,
        fulfilmentType: "delivery",
        createdAt: new Date().toISOString(),
      },
    ];
  }

  const data = await apiRequest<any>("/storefronts");
  const first = Array.isArray(data) ? data[0] : data?.data?.[0];
  if (!first) return [];
  const orders = await apiRequest<any>(`/storefronts/${first.id}/orders`);
  const rows = Array.isArray(orders) ? orders : orders?.data ?? [];
  return rows.map((row: any) => ({
    id: String(row.id),
    number: row.number ?? "",
    status: row.status ?? "pending",
    customerName: row.customer_name ?? undefined,
    total: Number(row.total ?? 0),
    fulfilmentType: row.fulfilment_type ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
  }));
}

export async function updateStorefrontOrderStatus(id: string, status: string): Promise<void> {
  if (USE_MOCK_API) return;
  await apiRequest(`/storefront-orders/${id}/status`, { method: "POST", body: { status } });
}
