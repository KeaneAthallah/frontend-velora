import { format } from "date-fns";
import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type {
  KitchenBoard,
  KitchenStation,
  KitchenStationKind,
  KitchenTicket,
  KitchenTicketStatus,
  Transaction,
} from "./types";

export type ManualTicketStatus = Exclude<KitchenTicketStatus, "queued" | "voided">;

export type KitchenStationInput = {
  outletId: string;
  name: string;
  code?: string;
  kind?: KitchenStationKind;
  printerName?: string;
  printerTarget?: string;
  copies?: number;
  autoPrint?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  categoryIds?: string[];
};

export type KitchenStationUpdate = Partial<Omit<KitchenStationInput, "outletId">>;

export type KitchenTicketFilter = {
  outletId?: string;
  stationId?: string;
  status?: "active" | KitchenTicketStatus | "all";
};

const ACTIVE_TICKET_STATUSES: KitchenTicketStatus[] = ["queued", "preparing", "ready"];

/** Forward-only ticket progression; the mock mirrors the API. */
export const TICKET_STATUS_RANK: Record<KitchenTicketStatus, number> = {
  queued: 0,
  preparing: 1,
  ready: 2,
  served: 3,
  voided: -1,
};

export function ticketStatusLabel(status: KitchenTicketStatus) {
  switch (status) {
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready";
    case "served":
      return "Served";
    case "voided":
      return "Voided";
    default:
      return "Queued";
  }
}

export function stationKindLabel(kind: KitchenStationKind) {
  switch (kind) {
    case "bar":
      return "Bar";
    case "pastry":
      return "Pastry";
    case "cold":
      return "Cold station";
    case "expediter":
      return "Expo";
    default:
      return "Kitchen";
  }
}

function mapStation(raw: any): KitchenStation {
  return {
    id: String(raw.id),
    outletId: String(raw.outlet_id),
    name: raw.name,
    code: raw.code,
    kind: raw.kind ?? "kitchen",
    printerName: raw.printer_name ?? undefined,
    printerTarget: raw.printer_target ?? undefined,
    copies: Number(raw.copies ?? 1),
    autoPrint: raw.auto_print !== false,
    isDefault: Boolean(raw.is_default),
    isActive: raw.is_active !== false,
    sortOrder: Number(raw.sort_order ?? 0),
    categories: (raw.categories ?? []).map((category: any) => ({
      id: String(category.id),
      name: category.name,
    })),
  };
}

function mapTicket(raw: any): KitchenTicket {
  return {
    id: String(raw.id),
    ticketNumber: raw.ticket_number,
    status: raw.status,
    note: raw.note ?? undefined,
    items: (raw.items ?? []).map((item: any) => ({
      saleItemId: item.sale_item_id ? String(item.sale_item_id) : undefined,
      productId: item.product_id ? String(item.product_id) : undefined,
      name: item.name,
      quantity: String(item.quantity ?? 1),
      notes: item.notes ?? undefined,
      modifiers: item.modifiers ?? [],
    })),
    printedAt: raw.printed_at ?? undefined,
    printCount: Number(raw.print_count ?? 0),
    startedAt: raw.started_at ?? undefined,
    readyAt: raw.ready_at ?? undefined,
    servedAt: raw.served_at ?? undefined,
    createdAt: raw.created_at,
    text: raw.text,
    station: {
      id: String(raw.station?.id ?? ""),
      name: raw.station?.name ?? "Kitchen",
      code: raw.station?.code ?? "",
      kind: raw.station?.kind ?? "kitchen",
      printerName: raw.station?.printer_name ?? undefined,
      printerTarget: raw.station?.printer_target ?? undefined,
      copies: Number(raw.station?.copies ?? 1),
      autoPrint: raw.station?.auto_print !== false,
    },
    sale: {
      id: String(raw.sale?.id ?? ""),
      orderNumber: raw.sale?.order_number ?? undefined,
      orderType: raw.sale?.order_type ?? undefined,
      orderStatus: raw.sale?.order_status ?? undefined,
      table: raw.sale?.table ?? undefined,
      notes: raw.sale?.notes ?? undefined,
    },
  };
}

function stationBody(input: KitchenStationUpdate) {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    ...(input.printerName !== undefined ? { printer_name: input.printerName } : {}),
    ...(input.printerTarget !== undefined ? { printer_target: input.printerTarget } : {}),
    ...(input.copies !== undefined ? { copies: input.copies } : {}),
    ...(input.autoPrint !== undefined ? { auto_print: input.autoPrint } : {}),
    ...(input.isDefault !== undefined ? { is_default: input.isDefault } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
    ...(input.categoryIds !== undefined ? { category_ids: input.categoryIds.map(Number) } : {}),
  };
}

/* --------------------------------------------------------------------------
   Mock helpers — also used by the mock order flow.
   -------------------------------------------------------------------------- */

function mockTicketSequence() {
  mockDb.kitchenTicketCounter += 1;
  return mockDb.kitchenTicketCounter;
}

function mockNextTicketNumber(outletId: string, at = new Date()) {
  const outlet = mockDb.outlets.find((entry) => entry.id === outletId);
  const code = (outlet?.code || outlet?.name || "OUT")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const stamp = format(at, "yyyyMMdd");
  return `${code}-K-${stamp}-${String(mockTicketSequence()).padStart(3, "0")}`;
}

function mockOptionName(optionId: string) {
  for (const group of mockDb.modifierGroups) {
    const option = group.options.find((entry) => entry.id === optionId);
    if (option) return option.name;
  }
  return undefined;
}

function mockStationsForOrder(order: Transaction) {
  return mockDb.kitchenStations
    .filter((station) => station.outletId === order.outletId && station.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/**
 * Split an order across stations exactly like the API: routed by product
 * category, otherwise the outlet's default station.
 */
export function mockFireOrder(order: Transaction, status: KitchenTicketStatus = "queued") {
  const existing = mockDb.kitchenTickets.filter((ticket) => ticket.sale.id === order.id);
  if (existing.length) return existing;

  const stations = mockStationsForOrder(order);
  if (!stations.length) return [];

  const fallback = stations.find((station) => station.isDefault) ?? stations[0];
  const categoryStation = new Map<string, KitchenStation>();
  stations.forEach((station) => {
    station.categories.forEach((category) => {
      if (!categoryStation.has(category.id)) categoryStation.set(category.id, station);
    });
  });

  const grouped = new Map<string, { station: KitchenStation; items: KitchenTicket["items"] }>();
  order.items.forEach((item) => {
    const product = item.productId
      ? mockDb.products.find((entry) => entry.id === item.productId)
      : undefined;
    const station = (product && categoryStation.get(product.categoryId)) || fallback;
    const group = grouped.get(station.id) ?? { station, items: [] };
    group.items.push({
      productId: item.productId,
      name: item.name,
      quantity: String(item.quantity),
      notes: item.notes,
      modifiers: (item.optionIds ?? [])
        .map(mockOptionName)
        .filter((name): name is string => Boolean(name)),
    });
    grouped.set(station.id, group);
  });

  const now = new Date().toISOString();
  const tickets = [...grouped.values()].map((group) => {
    const ticket: KitchenTicket = {
      id: mockId("kt"),
      ticketNumber: mockNextTicketNumber(order.outletId),
      status,
      note: order.notes,
      items: group.items,
      printCount: 0,
      createdAt: order.firedAt ?? now,
      startedAt: status === "queued" ? undefined : now,
      readyAt: status === "ready" || status === "served" ? now : undefined,
      servedAt: status === "served" ? now : undefined,
      station: {
        id: group.station.id,
        name: group.station.name,
        code: group.station.code,
        kind: group.station.kind,
        printerName: group.station.printerName,
        printerTarget: group.station.printerTarget,
        copies: group.station.copies,
        autoPrint: group.station.autoPrint,
      },
      sale: {
        id: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        orderStatus: order.orderStatus,
        table: order.tableName,
        notes: order.notes,
      },
    };
    mockDb.kitchenTickets.push(ticket);
    return ticket;
  });

  return tickets;
}

/** Mirror the API: order board moves cascade to the stations. */
export function mockSyncTicketsFromOrder(order: Transaction, status: "ready" | "served") {
  const now = new Date().toISOString();
  mockDb.kitchenTickets
    .filter((ticket) => ticket.sale.id === order.id && ticket.status !== "voided")
    .forEach((ticket) => {
      ticket.startedAt = ticket.startedAt ?? now;
      ticket.readyAt = ticket.readyAt ?? now;
      ticket.status = status;
      if (status === "served") ticket.servedAt = now;
    });
}

export function mockVoidTicketsForOrder(orderId: string) {
  mockDb.kitchenTickets
    .filter((ticket) => ticket.sale.id === orderId && ticket.status !== "voided")
    .forEach((ticket) => {
      ticket.status = "voided";
      ticket.servedAt = new Date().toISOString();
    });
}

/** Seed the KDS from the demo orders the first time it is opened. */
function ensureMockTickets() {
  if (mockDb.kitchenTicketSeedDone) return;
  mockDb.kitchenTicketSeedDone = true;

  [...mockDb.orders]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .filter((order) =>
      ["in_kitchen", "ready", "served"].includes(order.orderStatus ?? "")
    )
    .forEach((order) => {
      const status: KitchenTicketStatus =
        order.orderStatus === "ready" ? "ready" : order.orderStatus === "served" ? "served" : "queued";
      mockFireOrder(order, status);
    });
}

function mockBoard(tickets: KitchenTicket[], scope: KitchenTicket[]): KitchenBoard {
  const counts: KitchenBoard["counts"] = {
    queued: 0,
    preparing: 0,
    ready: 0,
    served: 0,
    voided: 0,
  };
  scope.forEach((ticket) => {
    counts[ticket.status] += 1;
  });

  return {
    tickets: tickets
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    counts,
  };
}

/* --------------------------------------------------------------------------
   Public API
   -------------------------------------------------------------------------- */

export async function listKitchenStations(params?: {
  outletId?: string;
  includeInactive?: boolean;
}): Promise<KitchenStation[]> {
  if (USE_MOCK_API) {
    return mockDb.kitchenStations
      .filter((station) => !params?.outletId || station.outletId === params.outletId)
      .filter((station) => params?.includeInactive || station.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((station) => ({
        ...station,
        categories: station.categories.map((category) => ({ ...category })),
      }));
  }

  const query = new URLSearchParams();
  if (params?.outletId) query.set("outlet_id", params.outletId);
  if (params?.includeInactive) query.set("include_inactive", "1");

  const data = await apiRequest<any[]>(`/kitchen/stations?${query.toString()}`);
  return (data ?? []).map(mapStation);
}

export async function createKitchenStation(input: KitchenStationInput): Promise<KitchenStation> {
  if (USE_MOCK_API) {
    mockAssertStationFree(input.name, input.code, input.outletId);
    if (input.isDefault) mockClearDefault(input.outletId);

    const station: KitchenStation = {
      id: mockId("ks"),
      outletId: input.outletId,
      name: input.name.trim(),
      code: mockStationCode(input.code ?? input.name, input.outletId),
      kind: input.kind ?? "kitchen",
      printerName: input.printerName,
      printerTarget: input.printerTarget,
      copies: input.copies ?? 1,
      autoPrint: input.autoPrint ?? true,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      categories: (input.categoryIds ?? [])
        .map((id) => mockDb.categories.find((category) => category.id === id))
        .filter((category): category is NonNullable<typeof category> => Boolean(category))
        .map((category) => ({ id: category.id, name: category.name })),
    };
    mockDb.kitchenStations.push(station);
    return station;
  }

  const data = await apiRequest<any>("/kitchen/stations", {
    method: "POST",
    body: { ...stationBody(input), outlet_id: Number(input.outletId) },
  });
  return mapStation(data);
}

export async function updateKitchenStation(
  id: string,
  input: KitchenStationUpdate
): Promise<KitchenStation> {
  if (USE_MOCK_API) {
    const station = mockDb.kitchenStations.find((entry) => entry.id === id);
    if (!station) throw new Error("Station not found");
    if (input.name !== undefined || input.code !== undefined) {
      mockAssertStationFree(input.name ?? station.name, input.code, station.outletId, station.id);
    }
    if (input.isDefault) mockClearDefault(station.outletId, station.id);

    station.name = input.name?.trim() ?? station.name;
    station.code = input.code ? mockStationCode(input.code, station.outletId, station.id) : station.code;
    station.kind = input.kind ?? station.kind;
    station.printerName = input.printerName ?? station.printerName;
    station.printerTarget = input.printerTarget ?? station.printerTarget;
    station.copies = input.copies ?? station.copies;
    station.autoPrint = input.autoPrint ?? station.autoPrint;
    station.isDefault = input.isDefault ?? station.isDefault;
    station.isActive = input.isActive ?? station.isActive;
    station.sortOrder = input.sortOrder ?? station.sortOrder;
    if (input.categoryIds) {
      station.categories = input.categoryIds
        .map((categoryId) => mockDb.categories.find((category) => category.id === categoryId))
        .filter((category): category is NonNullable<typeof category> => Boolean(category))
        .map((category) => ({ id: category.id, name: category.name }));
    }

    return { ...station, categories: station.categories.map((category) => ({ ...category })) };
  }

  const data = await apiRequest<any>(`/kitchen/stations/${id}`, {
    method: "PUT",
    body: stationBody(input),
  });
  return mapStation(data);
}

export async function deleteKitchenStation(id: string): Promise<void> {
  if (USE_MOCK_API) {
    if (mockDb.kitchenTickets.some((ticket) => ticket.station.id === id)) {
      throw new Error("This station already has tickets. Deactivate it instead.");
    }
    mockDb.kitchenStations = mockDb.kitchenStations.filter((station) => station.id !== id);
    return;
  }

  await apiRequest(`/kitchen/stations/${id}`, { method: "DELETE" });
}

export async function listKitchenTickets(filter?: KitchenTicketFilter): Promise<KitchenBoard> {
  if (USE_MOCK_API) {
    ensureMockTickets();

    const status = filter?.status ?? "active";
    const scoped = mockDb.kitchenTickets.filter(
      (ticket) => !filter?.outletId || ticketSaleOutlet(ticket) === filter.outletId
    );
    let tickets = filter?.stationId
      ? scoped.filter((ticket) => ticket.station.id === filter.stationId)
      : scoped;
    if (status === "active") {
      tickets = tickets.filter((ticket) => ACTIVE_TICKET_STATUSES.includes(ticket.status));
    } else if (status !== "all") {
      tickets = tickets.filter((ticket) => ticket.status === status);
    }

    return mockBoard(
      tickets.map((ticket) => ({ ...ticket, items: ticket.items.map((item) => ({ ...item })) })),
      filter?.stationId
        ? scoped.filter((ticket) => ticket.station.id === filter.stationId)
        : scoped
    );
  }

  const query = new URLSearchParams();
  if (filter?.outletId) query.set("outlet_id", filter.outletId);
  if (filter?.stationId) query.set("station_id", filter.stationId);
  query.set("status", filter?.status ?? "active");

  const data = await apiRequest<any>(`/kitchen/tickets?${query.toString()}`);
  return {
    tickets: (data?.tickets ?? []).map(mapTicket),
    counts: {
      queued: Number(data?.counts?.queued ?? 0),
      preparing: Number(data?.counts?.preparing ?? 0),
      ready: Number(data?.counts?.ready ?? 0),
      served: Number(data?.counts?.served ?? 0),
      voided: Number(data?.counts?.voided ?? 0),
    },
  };
}

export async function setKitchenTicketStatus(
  id: string,
  status: ManualTicketStatus
): Promise<KitchenTicket> {
  if (USE_MOCK_API) {
    ensureMockTickets();
    const ticket = mockDb.kitchenTickets.find((entry) => entry.id === id);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status === "voided") throw new Error("This ticket was cancelled with its order");
    if (status === ticket.status) return ticket;
    if (TICKET_STATUS_RANK[status] <= TICKET_STATUS_RANK[ticket.status]) {
      throw new Error("Tickets can only move forward through the kitchen");
    }

    const now = new Date().toISOString();
    ticket.status = status;
    ticket.startedAt = ticket.startedAt ?? now;
    if (status === "ready" || status === "served") ticket.readyAt = ticket.readyAt ?? now;
    if (status === "served") ticket.servedAt = now;

    // Advance the order once every station is done with it.
    const siblings = mockDb.kitchenTickets.filter(
      (entry) => entry.sale.id === ticket.sale.id && entry.status !== "voided"
    );
    const order = mockDb.orders.find((entry) => entry.id === ticket.sale.id);
    if (order && siblings.every((entry) => entry.status === "ready" || entry.status === "served")) {
      const allServed = siblings.every((entry) => entry.status === "served");
      const target = allServed ? "served" : "ready";
      const rank: Record<string, number> = { open: 0, in_kitchen: 1, ready: 2, served: 3 };
      if ((rank[target] ?? 0) > (rank[order.orderStatus ?? "open"] ?? 0)) {
        order.orderStatus = target;
        if (target === "ready") order.readyAt = now;
        if (target === "served") order.servedAt = now;
      }
    }

    return { ...ticket, items: ticket.items.map((item) => ({ ...item })) };
  }

  const data = await apiRequest<any>(`/kitchen/tickets/${id}/status`, {
    method: "POST",
    body: { status },
  });
  return mapTicket(data);
}

export async function printKitchenTicket(id: string): Promise<KitchenTicket> {
  if (USE_MOCK_API) {
    ensureMockTickets();
    const ticket = mockDb.kitchenTickets.find((entry) => entry.id === id);
    if (!ticket) throw new Error("Ticket not found");
    return { ...ticket, text: mockTicketText(ticket) };
  }

  const data = await apiRequest<any>(`/kitchen/tickets/${id}/print`);
  return mapTicket(data);
}

export async function markKitchenTicketPrinted(id: string): Promise<KitchenTicket> {
  if (USE_MOCK_API) {
    ensureMockTickets();
    const ticket = mockDb.kitchenTickets.find((entry) => entry.id === id);
    if (!ticket) throw new Error("Ticket not found");
    ticket.printedAt = new Date().toISOString();
    ticket.printCount += 1;
    return ticket;
  }

  const data = await apiRequest<any>(`/kitchen/tickets/${id}/printed`, { method: "POST" });
  return mapTicket(data);
}

/* --------------------------------------------------------------------------
   Mock-only helpers
   -------------------------------------------------------------------------- */

function ticketSaleOutlet(ticket: KitchenTicket) {
  return (
    mockDb.orders.find((order) => order.id === ticket.sale.id)?.outletId ??
    mockDb.transactions.find((transaction) => transaction.id === ticket.sale.id)?.outletId
  );
}

function mockStationCode(value: string, outletId: string, ignoreId?: string) {
  const base =
    value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "KIT";
  let candidate = base;
  let suffix = 1;
  while (
    mockDb.kitchenStations.some(
      (station) =>
        station.outletId === outletId && station.id !== ignoreId && station.code === candidate
    )
  ) {
    candidate = `${base.slice(0, 4)}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function mockAssertStationFree(name: string, code: string | undefined, outletId: string, ignoreId?: string) {
  const normalized = name.trim().toLowerCase();
  const clash = mockDb.kitchenStations.some(
    (station) =>
      station.outletId === outletId &&
      station.id !== ignoreId &&
      (station.name.trim().toLowerCase() === normalized ||
        (code ? station.code === code.toUpperCase() : false))
  );
  if (clash) throw new Error(`Station ${name.trim()} already exists in this outlet`);
}

function mockClearDefault(outletId: string, ignoreId?: string) {
  mockDb.kitchenStations.forEach((station) => {
    if (station.outletId === outletId && station.id !== ignoreId) station.isDefault = false;
  });
}

function mockTicketText(ticket: KitchenTicket) {
  const width = 42;
  const line = "-".repeat(width);
  const title = ticket.station.name.toUpperCase();
  const pad = Math.max(0, Math.floor((width - title.length) / 2));
  const rows = [
    `${" ".repeat(pad)}${title}`,
    line,
    `Ticket ${ticket.ticketNumber}`,
    `Order  ${ticket.sale.orderNumber ?? ticket.sale.id}`,
    `Type   ${(ticket.sale.orderType ?? "takeaway").replace("_", " ")}`,
    ...(ticket.sale.table ? [`Table  ${ticket.sale.table}`] : []),
    line,
    ...ticket.items.flatMap((item) => [
      `${item.quantity} x ${item.name}`,
      ...item.modifiers.map((modifier) => `    + ${modifier}`),
      ...(item.notes ? [`    >> ${item.notes}`] : []),
    ]),
    line,
    `Station ${ticket.station.code}   Printed ${format(new Date(), "HH:mm")}`,
  ];
  return rows.join("\n");
}
