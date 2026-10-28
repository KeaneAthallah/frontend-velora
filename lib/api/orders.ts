import { format } from "date-fns";
import { apiRequest, USE_MOCK_API } from "./client";
import {
  adjustMockStock,
  consumeMockIngredients,
  mockDb,
  mockId,
  mockLinePrice,
  mockNextOrderNumber,
  mockProduct,
} from "./mock-db";
import { mapSale } from "./sales";
import { mockFireOrder, mockSyncTicketsFromOrder, mockVoidTicketsForOrder } from "./kitchen";
import { mockActiveOrderForTable } from "./tables";
import type {
  CreateOrderRequest,
  DiningTable,
  OrderItemInput,
  OrderStatus,
  OrderType,
  Paginated,
  Transaction,
  UpdateOrderRequest,
} from "./types";

export type OrderListParams = {
  outletId?: string;
  status?: "active" | "all" | OrderStatus;
  orderType?: OrderType;
  search?: string;
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
};

const ACTIVE_STATUSES: OrderStatus[] = ["open", "in_kitchen", "ready", "served"];

/** Forward-only kitchen progression; also used to reject stale updates client-side. */
export const ORDER_STATUS_RANK: Record<OrderStatus, number> = {
  open: 0,
  in_kitchen: 1,
  ready: 2,
  served: 3,
  completed: 4,
  cancelled: -1,
};

export function orderStatusLabel(status?: OrderStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "in_kitchen":
      return "In kitchen";
    case "ready":
      return "Ready";
    case "served":
      return "Served";
    case "cancelled":
      return "Cancelled";
    default:
      return "Completed";
  }
}

export function orderTypeLabel(type?: OrderType) {
  switch (type) {
    case "dine_in":
      return "Dine in";
    case "takeaway":
      return "Takeaway";
    case "delivery":
      return "Delivery";
    case "pickup":
      return "Pickup";
    default:
      return "Order";
  }
}

function mockOrderItems(items: OrderItemInput[]): Transaction["items"] {
  return items.map((item) => {
    const product = mockProduct(item.productId);
    if (!product) throw new Error("Product not found");
    if (!product.active) throw new Error(`${product.name} is not active`);
    const unitPrice = mockLinePrice(item.productId, item.optionIds ?? []);
    const discount = item.discount ?? 0;
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      quantity: item.quantity,
      unitPrice,
      discount,
      lineTotal: unitPrice * item.quantity - discount,
      optionIds: item.optionIds ?? [],
      notes: item.notes,
    };
  });
}

function mockTotals(items: Transaction["items"]) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxRate = mockDb.taxRates.find((rate) => rate.isDefault && rate.isActive);
  const rate = taxRate?.rate ?? 0;
  const inclusive = taxRate?.type === "inclusive";
  const tax = inclusive
    ? Math.round(subtotal - subtotal / (1 + rate / 100))
    : Math.round(subtotal * (rate / 100));
  return { subtotal, tax, total: inclusive ? subtotal : subtotal + tax };
}

function mockFindOrder(id: string) {
  return mockDb.orders.find((order) => order.id === id);
}

function localPage(data: Transaction[], page: number, pageSize: number): Paginated<Transaction> {
  const start = (page - 1) * pageSize;
  return {
    data: data.slice(start, start + pageSize),
    page,
    pageSize,
    total: data.length,
    totalPages: Math.max(1, Math.ceil(data.length / pageSize)),
  };
}

export async function listOrders(params?: OrderListParams): Promise<Paginated<Transaction>> {
  if (USE_MOCK_API) {
    let data = [...mockDb.orders];
    if (params?.outletId) data = data.filter((order) => order.outletId === params.outletId);
    const status = params?.status ?? "active";
    if (status === "active") data = data.filter((order) => ACTIVE_STATUSES.includes(order.orderStatus!));
    else if (status !== "all") data = data.filter((order) => order.orderStatus === status);
    if (params?.orderType) data = data.filter((order) => order.orderType === params.orderType);
    if (params?.from) data = data.filter((order) => new Date(order.createdAt) >= new Date(params.from!));
    if (params?.to) data = data.filter((order) => new Date(order.createdAt) <= new Date(params.to!));
    if (params?.search) {
      const query = params.search.toLowerCase();
      data = data.filter(
        (order) =>
          (order.orderNumber ?? "").toLowerCase().includes(query) ||
          (order.customerName ?? "").toLowerCase().includes(query) ||
          (order.notes ?? "").toLowerCase().includes(query) ||
          order.items.some((item) => item.name.toLowerCase().includes(query))
      );
    }
    data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return localPage(data, params?.page ?? 1, params?.pageSize ?? 100);
  }

  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 100;
  const query = new URLSearchParams();
  if (params?.outletId) query.set("outlet_id", params.outletId);
  if (params?.status) query.set("status", params.status);
  if (params?.orderType) query.set("order_type", params.orderType);
  if (params?.search) query.set("q", params.search);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  query.set("page", String(page));
  query.set("per_page", String(pageSize));

  const data = await apiRequest<any>(`/orders?${query.toString()}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    data: items.map(mapSale),
    page: Number(data?.current_page ?? page),
    pageSize: Number(data?.per_page ?? pageSize),
    total: Number(data?.total ?? items.length),
    totalPages: Number(data?.last_page ?? 1),
  };
}

export async function getOrder(id: string): Promise<Transaction> {
  if (USE_MOCK_API) {
    const order = mockFindOrder(id) ?? mockDb.transactions.find((sale) => sale.id === id);
    if (!order) throw new Error("Order not found");
    return order;
  }
  const data = await apiRequest<any>(`/orders/${id}`);
  return mapSale(data);
}

function orderBody(request: CreateOrderRequest | UpdateOrderRequest) {
  return {
    ...("orderType" in request && request.orderType ? { order_type: request.orderType } : {}),
    ...("customerId" in request ? { customer_id: request.customerId ? Number(request.customerId) : null } : {}),
    ...("tableId" in request ? { table_id: request.tableId ? Number(request.tableId) : null } : {}),
    ...("notes" in request ? { notes: request.notes } : {}),
    ...("fulfilment" in request
      ? {
          fulfilment: request.fulfilment
            ? {
                contact_name: request.fulfilment.contactName,
                contact_phone: request.fulfilment.contactPhone,
                address: request.fulfilment.address,
                scheduled_at: request.fulfilment.scheduledAt,
                instructions: request.fulfilment.instructions,
              }
            : null,
        }
      : {}),
    ...("items" in request && request.items
      ? {
          items: request.items.map((item) => ({
            product_id: Number(item.productId),
            product_variant_id: item.variantId ? Number(item.variantId) : null,
            quantity: item.quantity,
            discount_amount: item.discount ?? 0,
            option_ids: item.optionIds?.map(Number) ?? [],
            notes: item.notes,
          })),
        }
      : {}),
  };
}

function mockResolveTable(
  tableId: string | null | undefined,
  outletId: string,
  orderType: OrderType,
  ignoreOrderId?: string
): DiningTable | undefined {
  if (!tableId) return undefined;

  const table = mockDb.diningTables.find(
    (entry) => entry.id === tableId && entry.outletId === outletId
  );
  if (!table) throw new Error("Table not found in this outlet");
  if (orderType !== "dine_in") throw new Error("Tables are only for dine-in orders");
  if (!table.isActive) throw new Error("This table is inactive");

  const conflict = mockActiveOrderForTable(tableId);
  if (conflict && conflict.id !== ignoreOrderId) {
    throw new Error("This table already has an open order");
  }

  return table;
}

export async function createOrder(request: CreateOrderRequest): Promise<Transaction> {
  if (USE_MOCK_API) {
    const table = mockResolveTable(request.tableId, request.outletId, request.orderType);
    const items = mockOrderItems(request.items);
    const totals = mockTotals(items);
    const orderNumber = mockNextOrderNumber(request.outletId, request.orderType);
    const outlet = mockDb.outlets.find((entry) => entry.id === request.outletId);
    const customer = mockDb.customers.find((entry) => entry.id === request.customerId);
    const order: Transaction = {
      id: mockId("ord"),
      receiptNumber: `OPEN-${orderNumber}`,
      outletId: request.outletId,
      outletName: outlet?.name ?? "",
      cashierId: "",
      cashierName: "",
      customerId: customer?.id,
      customerName: customer?.name,
      items,
      ...totals,
      discount: 0,
      paymentStatus: "pending",
      status: "completed",
      payments: [],
      notes: request.notes,
      createdAt: new Date().toISOString(),
      orderNumber,
      orderType: request.orderType,
      orderStatus: "open",
      tableId: table?.id,
      tableName: table?.name,
      fulfilment: request.fulfilment,
    };
    mockDb.orders.unshift(order);
    return order;
  }

  const data = await apiRequest<any>("/orders", {
    method: "POST",
    body: { ...orderBody(request), outlet_id: Number(request.outletId) },
    idempotencyKey: request.idempotencyKey,
  });
  return mapSale(data);
}

export async function updateOrder(id: string, request: UpdateOrderRequest): Promise<Transaction> {
  if (USE_MOCK_API) {
    const order = mockFindOrder(id);
    if (!order) throw new Error("Order not found");
    if (!ACTIVE_STATUSES.includes(order.orderStatus!)) throw new Error("Only open orders can be edited");
    const nextType = request.orderType ?? order.orderType!;
    const fulfilment = request.fulfilment === undefined ? order.fulfilment : request.fulfilment ?? undefined;
    if (nextType === "delivery" && (!fulfilment?.contactPhone || !fulfilment?.address)) {
      throw new Error("Delivery orders need a contact phone and address");
    }

    let tableId = order.tableId;
    let tableName = order.tableName;
    if (request.tableId !== undefined) {
      const table = mockResolveTable(request.tableId, order.outletId, nextType, order.id);
      tableId = table?.id;
      tableName = table?.name;
    } else if (nextType !== "dine_in") {
      // Changing away from dine-in releases the table for other guests.
      tableId = undefined;
      tableName = undefined;
    }

    if (request.items) {
      const items = mockOrderItems(request.items);
      order.items = items;
      Object.assign(order, mockTotals(items));
    }
    if (request.notes !== undefined) order.notes = request.notes || undefined;
    if (request.customerId !== undefined) {
      order.customerId = request.customerId ?? undefined;
      order.customerName = mockDb.customers.find((entry) => entry.id === request.customerId)?.name;
    }
    order.orderType = nextType;
    order.tableId = tableId;
    order.tableName = tableName;
    order.fulfilment = fulfilment;
    return order;
  }

  const data = await apiRequest<any>(`/orders/${id}`, { method: "PUT", body: orderBody(request) });
  return mapSale(data);
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<Transaction> {
  if (USE_MOCK_API) {
    const order = mockFindOrder(id);
    if (!order) throw new Error("Order not found");
    if (!ACTIVE_STATUSES.includes(order.orderStatus!)) throw new Error("Order is no longer active");
    if (status === order.orderStatus) return order;
    if (ORDER_STATUS_RANK[status] <= ORDER_STATUS_RANK[order.orderStatus!]) {
      throw new Error("Orders can only move forward through the kitchen");
    }
    const now = new Date().toISOString();
    order.orderStatus = status;
    if (status === "in_kitchen") {
      order.firedAt = order.firedAt ?? now;
      mockFireOrder(order);
    }
    if (status === "ready") {
      order.readyAt = now;
      mockSyncTicketsFromOrder(order, "ready");
    }
    if (status === "served") {
      order.servedAt = now;
      mockSyncTicketsFromOrder(order, "served");
    }
    return order;
  }

  const data = await apiRequest<any>(`/orders/${id}/status`, { method: "POST", body: { status } });
  return mapSale(data);
}

export async function checkoutOrder(
  id: string,
  options?: { paymentMethod?: string }
): Promise<Transaction> {
  const paymentMethod = options?.paymentMethod ?? "cash";

  if (USE_MOCK_API) {
    const order = mockFindOrder(id);
    if (!order) throw new Error("Order not found");
    if (!ACTIVE_STATUSES.includes(order.orderStatus!)) throw new Error("Only open orders can be checked out");
    if (!order.items.length) throw new Error("Add at least one item before checkout");

    const now = new Date();
    const sequence = mockDb.transactions.length + 1;
    const receiptNumber = `R-${format(now, "yyyyMMdd")}-${String(sequence).padStart(4, "0")}`;

    order.items.forEach((item) => {
      if (!item.productId) return;
      adjustMockStock(item.productId, order.outletId, -item.quantity);
      mockDb.movements.unshift({
        id: mockId("m"),
        productId: item.productId,
        productName: item.name,
        outletId: order.outletId,
        type: "sale",
        quantity: -item.quantity,
        reason: `Sale ${receiptNumber}`,
        createdAt: now.toISOString(),
        createdBy: order.cashierName,
      });
      consumeMockIngredients(
        item.productId,
        undefined,
        item.quantity,
        order.outletId,
        order.id,
        receiptNumber
      );
    });

    mockSyncTicketsFromOrder(order, "served");

    order.receiptNumber = receiptNumber;
    order.orderStatus = "completed";
    order.servedAt = order.servedAt ?? now.toISOString();
    order.status = "completed";
    order.paymentStatus = "paid";
    order.payments = [
      {
        id: mockId("pay"),
        method: paymentMethod,
        amount: order.total,
        status: "success",
        createdAt: now.toISOString(),
      },
    ];

    mockDb.orders = mockDb.orders.filter((entry) => entry.id !== order.id);
    mockDb.transactions = [order, ...mockDb.transactions];
    return order;
  }

  const checkedOut = mapSale(
    await apiRequest<any>(`/orders/${id}/checkout`, { method: "POST" })
  );

  let paymentFailed = false;
  try {
    await apiRequest<any>("/payments", {
      method: "POST",
      body: {
        sale_id: Number(id),
        method: paymentMethod.toLowerCase(),
        amount: checkedOut.total,
        idempotency_key: `order-${id}-payment`,
      },
    });
  } catch {
    paymentFailed = true;
  }

  const full = mapSale(await apiRequest<any>(`/orders/${id}`));
  if (paymentFailed) full.paymentStatus = "pending";
  return full;
}

export async function cancelOrder(id: string, reason: string): Promise<Transaction> {
  if (USE_MOCK_API) {
    const order = mockFindOrder(id);
    if (!order) throw new Error("Order not found");
    if (!ACTIVE_STATUSES.includes(order.orderStatus!)) throw new Error("Only open orders can be cancelled");
    mockVoidTicketsForOrder(order.id);
    order.orderStatus = "cancelled";
    order.status = "voided";
    order.notes = order.notes ? `${order.notes} · Cancelled: ${reason}` : `Cancelled: ${reason}`;
    return order;
  }

  const data = await apiRequest<any>(`/orders/${id}/cancel`, { method: "POST", body: { reason } });
  return mapSale(data);
}

export type { OrderStatus, OrderType };
