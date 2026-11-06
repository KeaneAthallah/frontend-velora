import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";

export type DeliveryStatus =
  | "pending"
  | "scheduled"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "failed"
  | "cancelled";

export type Delivery = {
  id: string;
  number: string;
  status: DeliveryStatus;
  saleId?: string;
  recipientName: string;
  recipientPhone?: string;
  address?: { line1?: string; city?: string };
  fee: number;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  scheduledAt?: string;
  deliveredAt?: string;
  collectedAmount: number;
  reconciledAt?: string;
  notes?: string;
  lines: { id: string; name: string; quantity: number }[];
  createdAt: string;
};

export type Driver = { id: string; name: string; phone?: string; status: string; vehicleId?: string };
export type DeliveryZone = { id: string; name: string; fee: number; minOrder: number; active: boolean };

export type DeliveryBoard = {
  date: string;
  totals: { count: number; delivered: number; unassigned: number; fees: number };
  columns: { status: DeliveryStatus; label: string; deliveries: Delivery[] }[];
};

function num(value: unknown) {
  return Number(value ?? 0);
}

export function normalizeDelivery(raw: any): Delivery {
  return {
    id: String(raw.id),
    number: raw.number ?? "",
    status: (raw.status ?? "pending") as DeliveryStatus,
    saleId: raw.sale_id ? String(raw.sale_id) : undefined,
    recipientName: raw.recipient_name ?? raw.recipient ?? "",
    recipientPhone: raw.recipient_phone ?? undefined,
    address: raw.address ?? undefined,
    fee: num(raw.fee),
    driverId: raw.driver_id ? String(raw.driver_id) : undefined,
    driverName: raw.driver?.name ?? raw.driver_name ?? undefined,
    vehicleId: raw.vehicle_id ? String(raw.vehicle_id) : undefined,
    scheduledAt: raw.scheduled_at ?? undefined,
    deliveredAt: raw.delivered_at ?? undefined,
    collectedAmount: num(raw.collected_amount),
    reconciledAt: raw.reconciled_at ?? undefined,
    notes: raw.notes ?? undefined,
    lines: (raw.lines ?? []).map((line: any) => ({
      id: String(line.id),
      name: line.name ?? line.description ?? "Item",
      quantity: num(line.quantity),
    })),
    createdAt: raw.created_at ?? new Date().toISOString(),
  };
}

export async function listDeliveries(params?: { status?: string; outletId?: string }): Promise<Delivery[]> {
  if (USE_MOCK_API) {
    return mockDb.transactions
      .filter((transaction) => Boolean(transaction.orderType === "delivery"))
      .slice(0, 12)
      .map((transaction, index) => ({
        id: mockId("del"),
        number: `DEL-${1000 + index}`,
        status: (["pending", "assigned", "in_transit", "delivered"] as DeliveryStatus[])[index % 4],
        saleId: transaction.id,
        recipientName: transaction.customerName ?? "Walk-in guest",
        recipientPhone: "0812 0000 0000",
        address: { line1: "Jl. Merdeka 10", city: "Bandung" },
        fee: 10000,
        driverName: index % 2 ? "Budi" : undefined,
        collectedAmount: index % 4 === 3 ? transaction.total : 0,
        lines: [],
        createdAt: transaction.createdAt,
      }));
  }

  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.outletId) query.set("outlet_id", params.outletId);
  const data = await apiRequest<any>(`/deliveries${query.toString() ? `?${query}` : ""}`);
  const rows = Array.isArray(data) ? data : data?.data ?? [];
  return rows.map(normalizeDelivery);
}

export async function getDeliveryBoard(date?: string): Promise<DeliveryBoard> {
  if (USE_MOCK_API) {
    const deliveries = await listDeliveries();
    const columns: { key: DeliveryStatus; label: string }[] = [
      { key: "pending", label: "Unassigned" },
      { key: "assigned", label: "Assigned" },
      { key: "in_transit", label: "On the way" },
      { key: "delivered", label: "Delivered" },
    ];
    return {
      date: date ?? new Date().toISOString().slice(0, 10),
      totals: {
        count: deliveries.length,
        delivered: deliveries.filter((delivery) => delivery.status === "delivered").length,
        unassigned: deliveries.filter((delivery) => !delivery.driverId && delivery.status === "pending").length,
        fees: deliveries.reduce((sum, delivery) => sum + delivery.fee, 0),
      },
      columns: columns.map((column) => ({
        status: column.key,
        label: column.label,
        deliveries: deliveries.filter((delivery) => delivery.status === column.key),
      })),
    };
  }

  const data = await apiRequest<any>(`/deliveries/board${date ? `?date=${date}` : ""}`);
  return {
    date: data?.date ?? date ?? "",
    totals: {
      count: num(data?.totals?.count),
      delivered: num(data?.totals?.delivered),
      unassigned: num(data?.totals?.unassigned),
      fees: num(data?.totals?.fees),
    },
    columns: (data?.columns ?? []).map((column: any) => ({
      status: column.status,
      label: column.label ?? column.status,
      deliveries: (column.deliveries ?? []).map(normalizeDelivery),
    })),
  };
}

export async function listDrivers(): Promise<Driver[]> {
  if (USE_MOCK_API) {
    return [
      { id: mockId("drv"), name: "Budi Santoso", phone: "0812 1111 2222", status: "available" },
      { id: mockId("drv"), name: "Rina Kartika", phone: "0812 3333 4444", status: "on_delivery" },
    ];
  }

  const data = await apiRequest<any>("/drivers");
  const rows = Array.isArray(data) ? data : data?.data ?? [];
  return rows.map((row: any) => ({
    id: String(row.id),
    name: row.name ?? "",
    phone: row.phone ?? undefined,
    status: row.status ?? "available",
    vehicleId: row.vehicle_id ? String(row.vehicle_id) : undefined,
  }));
}

export async function assignDelivery(deliveryId: string, driverId: string): Promise<Delivery> {
  if (USE_MOCK_API) {
    const board = await listDeliveries();
    const delivery = board.find((row) => row.id === deliveryId);
    if (!delivery) throw new Error("Delivery not found");
    delivery.driverId = driverId;
    delivery.status = "assigned";
    return delivery;
  }

  const data = await apiRequest<any>(`/deliveries/${deliveryId}/assign`, {
    method: "POST",
    body: { driver_id: Number(driverId) },
  });
  return normalizeDelivery(data);
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus,
  note?: string
): Promise<Delivery> {
  if (USE_MOCK_API) {
    const rows = await listDeliveries();
    const delivery = rows.find((row) => row.id === deliveryId);
    if (!delivery) throw new Error("Delivery not found");
    delivery.status = status;
    if (status === "delivered") delivery.deliveredAt = new Date().toISOString();
    return delivery;
  }

  const data = await apiRequest<any>(`/deliveries/${deliveryId}/status`, {
    method: "POST",
    body: { status, note },
  });
  return normalizeDelivery(data);
}
