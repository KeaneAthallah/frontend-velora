import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import { mapSale } from "./sales";
import type {
  ChannelCredentials,
  ChannelEvent,
  ChannelEventType,
  ChannelKind,
  ChannelMapping,
  ChannelMenuSnapshot,
  ChannelOrderStatus,
  ChannelSummaryRow,
  Paginated,
  SalesChannel,
  SalesChannelInput,
  Transaction,
} from "./types";

function money(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeChannel(raw: any): SalesChannel {
  return {
    id: String(raw.id),
    name: raw.name ?? "",
    code: raw.code ?? "",
    kind: (raw.kind ?? "custom") as ChannelKind,
    outletId: raw.outlet_id ? String(raw.outlet_id) : undefined,
    commissionPercent: Number(raw.commission_percent ?? 0),
    paymentMethodCode: raw.payment_method_code ?? undefined,
    autoAccept: raw.auto_accept === true,
    prepBufferMinutes: Number(raw.prep_buffer_minutes ?? 0),
    active: raw.is_active !== false,
    webhookUrl: raw.webhook_url ?? undefined,
    webhookToken: raw.webhook_token ?? undefined,
    hasCredentials: raw.has_credentials ?? Boolean(raw.webhook_token),
    mappingsCount: raw.mappings_count != null ? Number(raw.mappings_count) : undefined,
    salesCount: raw.sales_count != null ? Number(raw.sales_count) : undefined,
    lastOrderAt: raw.last_order_at ?? undefined,
    settings: raw.settings ?? undefined,
  };
}

export function normalizeChannelMapping(raw: any): ChannelMapping {
  const optionMap: Record<string, string> = {};
  for (const [externalId, optionId] of Object.entries(raw.option_map ?? {})) {
    optionMap[String(externalId)] = String(optionId);
  }

  return {
    id: String(raw.id),
    externalItemId: raw.external_item_id ?? "",
    externalVariantId: raw.external_variant_id || undefined,
    productId: String(raw.product_id),
    productVariantId: raw.product_variant_id ? String(raw.product_variant_id) : undefined,
    productName: raw.product_name ?? undefined,
    variantName: raw.variant_name ?? undefined,
    optionMap,
    active: raw.is_active !== false,
  };
}

export function normalizeChannelEvent(raw: any): ChannelEvent {
  return {
    id: String(raw.id),
    type: raw.type as ChannelEventType,
    status: raw.status ?? "pending",
    saleId: raw.sale_id ? String(raw.sale_id) : undefined,
    attempts: Number(raw.attempts ?? 0),
    lastError: raw.last_error ?? undefined,
    sentAt: raw.sent_at ?? undefined,
    createdAt: raw.created_at ?? new Date().toISOString(),
    payload: raw.payload ?? undefined,
  };
}

function channelBody(input: SalesChannelInput) {
  return {
    name: input.name,
    code: input.code?.trim() || null,
    kind: input.kind,
    outlet_id: input.outletId ? Number(input.outletId) : null,
    commission_percent: input.commissionPercent,
    payment_method_code: input.paymentMethodCode || null,
    auto_accept: input.autoAccept,
    prep_buffer_minutes: input.prepBufferMinutes,
    is_active: input.active,
  };
}

function mockCredentials(): ChannelCredentials {
  const token = mockId("tok").replace(/[^a-z0-9]/gi, "");
  return {
    webhookUrl: `https://api.velora.test/api/v1/channel-webhooks/${token}`,
    secret: mockId("secret").replace(/[^a-z0-9]/gi, ""),
  };
}

export async function listChannels(params?: { outletId?: string }): Promise<SalesChannel[]> {
  if (USE_MOCK_API) {
    const data = params?.outletId
      ? mockDb.channels.filter((channel) => !channel.outletId || channel.outletId === params.outletId)
      : mockDb.channels;
    return [...data].sort((a, b) => a.name.localeCompare(b.name));
  }

  const query = new URLSearchParams();
  if (params?.outletId) query.set("outlet_id", params.outletId);
  const data = await apiRequest<any>(`/channels${query.toString() ? `?${query.toString()}` : ""}`);
  return (Array.isArray(data) ? data : []).map(normalizeChannel);
}

export async function createChannel(
  input: SalesChannelInput
): Promise<{ channel: SalesChannel; credentials: ChannelCredentials }> {
  if (USE_MOCK_API) {
    const code = (input.code?.trim() || input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")).slice(0, 32);
    if (mockDb.channels.some((channel) => channel.code === code)) {
      throw new Error("A channel with this code already exists");
    }
    const credentials = mockCredentials();
    const channel: SalesChannel = {
      id: mockId("ch"),
      name: input.name,
      code,
      kind: input.kind,
      outletId: input.outletId ?? undefined,
      commissionPercent: input.commissionPercent,
      paymentMethodCode: input.paymentMethodCode ?? undefined,
      autoAccept: input.autoAccept,
      prepBufferMinutes: input.prepBufferMinutes,
      active: input.active,
      webhookUrl: credentials.webhookUrl,
      webhookToken: credentials.webhookUrl?.split("/").pop(),
      hasCredentials: true,
      mappingsCount: 0,
      salesCount: 0,
    };
    mockDb.channels = [...mockDb.channels, channel];
    return { channel, credentials };
  }

  const data = await apiRequest<any>("/channels", { method: "POST", body: channelBody(input) });
  return {
    channel: normalizeChannel(data),
    credentials: { webhookUrl: data.webhook_url ?? undefined, secret: data.secret ?? "" },
  };
}

export async function updateChannel(id: string, input: SalesChannelInput): Promise<SalesChannel> {
  if (USE_MOCK_API) {
    const index = mockDb.channels.findIndex((channel) => channel.id === id);
    if (index < 0) throw new Error("Channel not found");
    const code = (input.code?.trim() || input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")).slice(0, 32);
    if (mockDb.channels.some((channel) => channel.code === code && channel.id !== id)) {
      throw new Error("A channel with this code already exists");
    }
    mockDb.channels[index] = {
      ...mockDb.channels[index],
      name: input.name,
      code,
      kind: input.kind,
      outletId: input.outletId ?? undefined,
      commissionPercent: input.commissionPercent,
      paymentMethodCode: input.paymentMethodCode ?? undefined,
      autoAccept: input.autoAccept,
      prepBufferMinutes: input.prepBufferMinutes,
      active: input.active,
    };
    return { ...mockDb.channels[index] };
  }

  const data = await apiRequest<any>(`/channels/${id}`, { method: "PUT", body: channelBody(input) });
  return normalizeChannel(data);
}

export async function deleteChannel(id: string): Promise<void> {
  if (USE_MOCK_API) {
    const used =
      mockDb.transactions.some((transaction) => transaction.channelId === id) ||
      mockDb.orders.some((order) => order.channelId === id);
    if (used) {
      throw new Error("This channel already has orders; deactivate it instead of deleting it");
    }
    mockDb.channels = mockDb.channels.filter((channel) => channel.id !== id);
    mockDb.channelMappings = mockDb.channelMappings.filter(
      (mapping) => mockDb.channelMappingOwners[mapping.id] !== id
    );
    return;
  }

  await apiRequest<void>(`/channels/${id}`, { method: "DELETE" });
}

export async function rotateChannelSecret(id: string): Promise<ChannelCredentials> {
  if (USE_MOCK_API) {
    const channel = mockDb.channels.find((entry) => entry.id === id);
    if (!channel) throw new Error("Channel not found");
    const credentials = mockCredentials();
    channel.webhookUrl = credentials.webhookUrl;
    channel.webhookToken = credentials.webhookUrl?.split("/").pop();
    channel.hasCredentials = true;
    return credentials;
  }

  const data = await apiRequest<any>(`/channels/${id}/rotate-secret`, { method: "POST" });
  return { webhookUrl: data.webhook_url ?? undefined, secret: data.secret ?? "" };
}

export async function listChannelMappings(id: string): Promise<ChannelMapping[]> {
  if (USE_MOCK_API) {
    return mockDb.channelMappings.filter((mapping) => mockChannelForMapping(mapping.id) === id);
  }

  const data = await apiRequest<any>(`/channels/${id}/mappings`);
  return (Array.isArray(data) ? data : []).map(normalizeChannelMapping);
}

/* The mock store keeps every mapping in one list; ownership sits beside it. */
function mockChannelForMapping(mappingId: string) {
  return mockDb.channelMappingOwners[mappingId];
}

export async function saveChannelMappings(
  channelId: string,
  rows: { externalItemId: string; externalVariantId?: string; productId: string; productVariantId?: string; optionMap?: Record<string, string>; active?: boolean }[]
): Promise<ChannelMapping[]> {
  if (USE_MOCK_API) {
    const keep = new Set(rows.map((row) => `${row.externalItemId}:${row.externalVariantId ?? ""}`));
    mockDb.channelMappings = mockDb.channelMappings.filter((mapping) => {
      if (mockChannelForMapping(mapping.id) !== channelId) return true;
      return keep.has(`${mapping.externalItemId}:${mapping.externalVariantId ?? ""}`);
    });

    for (const row of rows) {
      const product = mockDb.products.find((entry) => entry.id === row.productId);
      const existing = mockDb.channelMappings.find(
        (mapping) =>
          mockChannelForMapping(mapping.id) === channelId &&
          mapping.externalItemId === row.externalItemId &&
          (mapping.externalVariantId ?? "") === (row.externalVariantId ?? "")
      );
      const next: ChannelMapping = {
        id: existing?.id ?? mockId("cm"),
        externalItemId: row.externalItemId,
        externalVariantId: row.externalVariantId || undefined,
        productId: row.productId,
        productVariantId: row.productVariantId || undefined,
        productName: product?.name,
        optionMap: row.optionMap ?? {},
        active: row.active ?? true,
      };
      if (existing) {
        mockDb.channelMappings = mockDb.channelMappings.map((mapping) =>
          mapping.id === existing.id ? next : mapping
        );
      } else {
        mockDb.channelMappings = [...mockDb.channelMappings, next];
      }
      mockDb.channelMappingOwners[next.id] = channelId;
    }

    const channel = mockDb.channels.find((entry) => entry.id === channelId);
    if (channel) {
      channel.mappingsCount = mockDb.channelMappings.filter(
        (mapping) => mockChannelForMapping(mapping.id) === channelId
      ).length;
    }

    return listChannelMappings(channelId);
  }

  const data = await apiRequest<any>(`/channels/${channelId}/mappings`, {
    method: "PUT",
    body: {
      mappings: rows.map((row) => ({
        external_item_id: row.externalItemId,
        external_variant_id: row.externalVariantId || null,
        product_id: Number(row.productId),
        product_variant_id: row.productVariantId ? Number(row.productVariantId) : null,
        option_map: row.optionMap ?? {},
        is_active: row.active ?? true,
      })),
    },
  });
  return (Array.isArray(data) ? data : []).map(normalizeChannelMapping);
}

export async function channelSummary(params?: { from?: string; to?: string }): Promise<ChannelSummaryRow[]> {
  if (USE_MOCK_API) {
    return mockDb.channels.map((channel) => {
      const sales = mockDb.transactions.filter(
        (transaction) =>
          transaction.channelId === channel.id &&
          (transaction.status === "completed" || transaction.status === "refunded") &&
          (!params?.from || transaction.createdAt >= params.from) &&
          (!params?.to || transaction.createdAt <= params.to)
      );
      const gross = money(sales.reduce((sum, transaction) => sum + transaction.total, 0));
      const commission = money(
        sales.reduce((sum, transaction) => sum + (transaction.channelCommission ?? 0), 0)
      );
      const openOrders = mockDb.orders.filter(
        (order) => order.channelId === channel.id && order.orderStatus && order.orderStatus !== "cancelled"
      ).length;

      return {
        channelId: channel.id,
        code: channel.code,
        name: channel.name,
        kind: channel.kind,
        active: channel.active,
        commissionPercent: channel.commissionPercent,
        orders: sales.length,
        openOrders,
        gross,
        commission,
        net: money(gross - commission),
      };
    });
  }

  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const data = await apiRequest<any>(`/channels/summary${query.toString() ? `?${query.toString()}` : ""}`);

  return (Array.isArray(data) ? data : []).map((row: any) => ({
    channelId: String(row.channel_id),
    code: row.code ?? "",
    name: row.name ?? "",
    kind: (row.kind ?? "custom") as ChannelKind,
    active: row.is_active !== false,
    commissionPercent: Number(row.commission_percent ?? 0),
    orders: Number(row.orders ?? 0),
    openOrders: Number(row.open_orders ?? 0),
    gross: Number(row.gross ?? 0),
    commission: Number(row.commission ?? 0),
    net: Number(row.net ?? 0),
  }));
}

export async function listChannelOrders(
  channelId: string,
  params?: { status?: string }
): Promise<Paginated<Transaction>> {
  if (USE_MOCK_API) {
    const rows = [...mockDb.orders, ...mockDb.transactions]
      .filter((order) => order.channelId === channelId)
      .filter((order) => {
        const status = params?.status ?? "all";
        if (status === "all") return true;
        if (status === "active") return Boolean(order.orderStatus) && !["completed", "cancelled"].includes(order.orderStatus!);
        return order.channelStatus === status;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { data: rows, page: 1, pageSize: rows.length || 25, total: rows.length, totalPages: 1 };
  }

  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  const data = await apiRequest<any>(`/channels/${channelId}/orders${query.toString() ? `?${query.toString()}` : ""}`);
  const rows = (data?.data ?? []).map(mapSale);

  return {
    data: rows,
    page: Number(data?.current_page ?? 1),
    pageSize: Number(data?.per_page ?? rows.length ?? 25),
    total: Number(data?.total ?? rows.length),
    totalPages: Number(data?.last_page ?? 1),
  };
}

export async function acceptChannelOrder(channelId: string, saleId: string): Promise<Transaction> {
  if (USE_MOCK_API) {
    const order = mockDb.orders.find((entry) => entry.id === saleId);
    if (!order) throw new Error("Order not found");
    if (order.orderStatus === "completed" || order.orderStatus === "cancelled") {
      throw new Error("Only open channel orders can be accepted");
    }
    order.channelStatus = "accepted";
    order.orderStatus = "in_kitchen";
    order.firedAt = order.firedAt ?? new Date().toISOString();
    mockDb.channelEvents = [
      {
        id: mockId("ce"),
        type: "order.accepted",
        status: "pending",
        saleId: order.id,
        attempts: 0,
        createdAt: new Date().toISOString(),
        payload: { external_order_id: order.channelOrderRef, order_number: order.orderNumber },
      },
      ...mockDb.channelEvents,
    ];
    return order;
  }

  const data = await apiRequest<any>(`/channels/${channelId}/orders/${saleId}/accept`, { method: "POST" });
  return mapSale(data);
}

export async function rejectChannelOrder(
  channelId: string,
  saleId: string,
  reason: string
): Promise<Transaction> {
  if (USE_MOCK_API) {
    const order = mockDb.orders.find((entry) => entry.id === saleId);
    if (!order) throw new Error("Order not found");
    if (order.orderStatus === "completed" || order.orderStatus === "cancelled") {
      throw new Error("Only open channel orders can be rejected");
    }
    order.channelStatus = "rejected";
    order.orderStatus = "cancelled";
    order.status = "voided";
    mockDb.channelEvents = [
      {
        id: mockId("ce"),
        type: "order.rejected",
        status: "pending",
        saleId: order.id,
        attempts: 0,
        createdAt: new Date().toISOString(),
        payload: { external_order_id: order.channelOrderRef, reason },
      },
      ...mockDb.channelEvents,
    ];
    return order;
  }

  const data = await apiRequest<any>(`/channels/${channelId}/orders/${saleId}/reject`, {
    method: "POST",
    body: { reason },
  });
  return mapSale(data);
}

export async function listChannelEvents(
  channelId: string,
  params?: { status?: string; type?: string }
): Promise<ChannelEvent[]> {
  if (USE_MOCK_API) {
    return mockDb.channelEvents.filter((event) => {
      if (params?.status && event.status !== params.status) return false;
      if (params?.type && event.type !== params.type) return false;
      return true;
    });
  }

  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.type) query.set("type", params.type);
  const data = await apiRequest<any>(`/channels/${channelId}/events${query.toString() ? `?${query.toString()}` : ""}`);
  return (data?.data ?? []).map(normalizeChannelEvent);
}

export async function ackChannelEvent(
  channelId: string,
  eventId: string,
  status: "sent" | "failed",
  error?: string
): Promise<ChannelEvent> {
  if (USE_MOCK_API) {
    const event = mockDb.channelEvents.find((entry) => entry.id === eventId);
    if (!event) throw new Error("Event not found");
    event.status = status;
    event.attempts += 1;
    event.sentAt = status === "sent" ? new Date().toISOString() : undefined;
    event.lastError = status === "failed" ? error ?? "Delivery failed" : undefined;
    return event;
  }

  const data = await apiRequest<any>(`/channels/${channelId}/events/${eventId}/ack`, {
    method: "POST",
    body: { status, error },
  });
  return normalizeChannelEvent(data);
}

export async function pushChannelMenu(
  channelId: string
): Promise<{ snapshot: ChannelMenuSnapshot; event: ChannelEvent }> {
  if (USE_MOCK_API) {
    const mappings = mockDb.channelMappings.filter(
      (mapping) => mockChannelForMapping(mapping.id) === channelId
    );
    const snapshot: ChannelMenuSnapshot = {
      generatedAt: new Date().toISOString(),
      items: mappings.map((mapping) => {
        const product = mockDb.products.find((entry) => entry.id === mapping.productId);
        return {
          externalItemId: mapping.externalItemId,
          externalVariantId: mapping.externalVariantId,
          productId: mapping.productId,
          name: mapping.productName ?? product?.name ?? "",
          price: product?.price ?? 0,
          available: product?.active !== false,
          options: [],
        };
      }),
    };
    const event: ChannelEvent = {
      id: mockId("ce"),
      type: "menu.pushed",
      status: "pending",
      attempts: 0,
      createdAt: new Date().toISOString(),
      payload: snapshot as unknown as Record<string, unknown>,
    };
    mockDb.channelEvents = [event, ...mockDb.channelEvents];
    return { snapshot, event };
  }

  const data = await apiRequest<any>(`/channels/${channelId}/menu/push`, { method: "POST" });
  const snapshot: ChannelMenuSnapshot = {
    generatedAt: data.snapshot?.generated_at ?? new Date().toISOString(),
    items: (data.snapshot?.items ?? []).map((item: any) => ({
      externalItemId: item.external_item_id,
      externalVariantId: item.external_variant_id ?? undefined,
      productId: String(item.product_id),
      name: item.name ?? "",
      price: Number(item.price ?? 0),
      available: item.available !== false,
      availabilityReason: item.availability_reason ?? undefined,
      options: (item.options ?? []).map((option: any) => ({
        externalOptionId: String(option.external_option_id),
        name: option.name ?? "",
        priceDelta: Number(option.price_delta ?? 0),
        available: option.available !== false,
      })),
    })),
  };

  return { snapshot, event: normalizeChannelEvent(data.event) };
}

export const CHANNEL_STATUSES: ChannelOrderStatus[] = [
  "received",
  "accepted",
  "ready",
  "dispatched",
  "completed",
  "rejected",
  "cancelled",
];
