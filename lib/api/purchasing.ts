import { format } from "date-fns";
import { apiRequest, USE_MOCK_API } from "./client";
import { adjustMockStock, mockDb, mockId } from "./mock-db";
import type { Paginated, PurchaseOrder, Supplier } from "./types";

export type SupplierInput = {
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
};

function mapSupplier(supplier: any): Supplier {
  return {
    id: String(supplier.id),
    name: supplier.name ?? "",
    contact: supplier.contact_person ?? "",
    email: supplier.email ?? "",
    phone: supplier.phone ?? "",
    address: supplier.address ?? undefined,
  };
}

export async function listSuppliers(search?: string): Promise<Supplier[]> {
  if (USE_MOCK_API) {
    let data = mockDb.suppliers.map((supplier) => ({ ...supplier }));
    if (search) {
      const query = search.toLowerCase();
      data = data.filter(
        (supplier) =>
          supplier.name.toLowerCase().includes(query) ||
          supplier.contact.toLowerCase().includes(query) ||
          supplier.email.toLowerCase().includes(query)
      );
    }
    return data;
  }
  const data = await apiRequest<any>("/suppliers?per_page=50");
  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  const mapped = items.map(mapSupplier);
  if (!search) return mapped;
  const query = search.toLowerCase();
  return mapped.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(query) ||
      supplier.contact.toLowerCase().includes(query) ||
      supplier.email.toLowerCase().includes(query)
  );
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  if (USE_MOCK_API) {
    const supplier: Supplier = {
      id: mockId("s"),
      name: input.name,
      contact: input.contact ?? "",
      email: input.email ?? "",
      phone: input.phone ?? "",
      address: input.address,
    };
    mockDb.suppliers = [supplier, ...mockDb.suppliers];
    return supplier;
  }
  const data = await apiRequest<any>("/suppliers", {
    method: "POST",
    body: {
      name: input.name,
      contact_person: input.contact || null,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
    },
  });
  return mapSupplier(data);
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>): Promise<Supplier> {
  if (USE_MOCK_API) {
    const index = mockDb.suppliers.findIndex((supplier) => supplier.id === id);
    if (index < 0) throw new Error("Supplier not found");
    mockDb.suppliers[index] = { ...mockDb.suppliers[index], ...input };
    return { ...mockDb.suppliers[index] };
  }
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.contact !== undefined) body.contact_person = input.contact || null;
  if (input.email !== undefined) body.email = input.email || null;
  if (input.phone !== undefined) body.phone = input.phone || null;
  if (input.address !== undefined) body.address = input.address || null;
  const data = await apiRequest<any>(`/suppliers/${id}`, { method: "PUT", body });
  return mapSupplier(data);
}

export async function deleteSupplier(id: string): Promise<void> {
  if (USE_MOCK_API) {
    mockDb.suppliers = mockDb.suppliers.filter((supplier) => supplier.id !== id);
    return;
  }
  await apiRequest<void>(`/suppliers/${id}`, { method: "DELETE" });
}

const poStatuses: Record<string, PurchaseOrder["status"]> = {
  draft: "draft",
  submitted: "approved",
  approved: "approved",
  partially_received: "partial",
  completed: "received",
  cancelled: "cancelled",
};

function mapPurchaseOrder(order: any): PurchaseOrder {
  const items = (order.items ?? []).map((item: any) => ({
    id: String(item.id),
    productId: String(item.product_id),
    productName: item.product?.name ?? item.product_name ?? "",
    quantity: Number(item.quantity ?? 0),
    receivedQuantity: Number(item.received_quantity ?? 0),
    cost: Number(item.unit_cost ?? 0),
  }));
  return {
    id: String(order.id),
    number: order.po_number ?? `PO-${order.id}`,
    supplierId: String(order.supplier_id),
    supplierName: order.supplier?.name ?? "",
    outletId: String(order.outlet_id ?? ""),
    outletName: order.outlet?.name ?? "",
    status: poStatuses[order.status] ?? "draft",
    items,
    total: Number(order.total ?? order.total_amount ?? 0),
    expectedAt: order.expected_at ?? undefined,
    createdAt: order.created_at ?? new Date().toISOString(),
    approvedAt: order.approved_at ?? undefined,
    receivedAt: order.received_at ?? undefined,
  };
}

export async function listPurchaseOrders(params?: {
  search?: string;
  status?: string;
  outletId?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<PurchaseOrder>> {
  if (USE_MOCK_API) {
    let data = mockDb.purchaseOrders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({ ...item })),
    }));
    if (params?.outletId) {
      data = data.filter((order) => order.outletId === params.outletId);
    }
    if (params?.status && params.status !== "all") {
      data = data.filter((order) => order.status === params.status);
    }
    if (params?.search) {
      const query = params.search.toLowerCase();
      data = data.filter(
        (order) =>
          order.number.toLowerCase().includes(query) ||
          order.supplierName.toLowerCase().includes(query)
      );
    }
    data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    return {
      data: data.slice(start, start + pageSize),
      page,
      pageSize,
      total: data.length,
      totalPages: Math.max(1, Math.ceil(data.length / pageSize)),
    };
  }

  const query = new URLSearchParams();
  query.set("page", String(params?.page ?? 1));
  query.set("per_page", String(params?.pageSize ?? 20));
  if (params?.search) query.set("q", params.search);
  if (params?.outletId) query.set("outlet_id", params.outletId);
  const backendStatus: Record<string, string> = {
    approved: "approved",
    received: "completed",
    partial: "partially_received",
  };
  if (params?.status && params.status !== "all") {
    query.set("status", backendStatus[params.status] ?? params.status);
  }
  const data = await apiRequest<any>(`/purchase-orders?${query.toString()}`);
  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    data: items.map(mapPurchaseOrder),
    page: Number(data?.current_page ?? params?.page ?? 1),
    pageSize: Number(data?.per_page ?? params?.pageSize ?? 20),
    total: Number(data?.total ?? items.length),
    totalPages: Number(data?.last_page ?? 1),
  };
}

export async function createPurchaseOrder(input: {
  supplierId: string;
  outletId: string;
  expectedAt?: string;
  notes?: string;
  items: { productId: string; quantity: number; unitCost: number }[];
}): Promise<PurchaseOrder> {
  if (USE_MOCK_API) {
    const supplier = mockDb.suppliers.find((item) => item.id === input.supplierId);
    const outlet = mockDb.outlets.find((item) => item.id === input.outletId);
    const items = input.items.map((item, index) => {
      const product = mockDb.products.find((entry) => entry.id === item.productId);
      return {
        id: mockId(`poi-${index}`),
        productId: item.productId,
        productName: product?.name ?? "",
        quantity: item.quantity,
        receivedQuantity: 0,
        cost: item.unitCost,
      };
    });
    const order: PurchaseOrder = {
      id: mockId("po"),
      number: `PO-${format(new Date(), "yyyy")}-${String(mockDb.purchaseOrders.length + 44).padStart(4, "0")}`,
      supplierId: input.supplierId,
      supplierName: supplier?.name ?? "",
      outletId: input.outletId,
      outletName: outlet?.name ?? "",
      status: "draft",
      items,
      total: items.reduce((sum, item) => sum + item.quantity * item.cost, 0),
      expectedAt: input.expectedAt,
      createdAt: new Date().toISOString(),
    };
    mockDb.purchaseOrders = [order, ...mockDb.purchaseOrders];
    return order;
  }
  const data = await apiRequest<any>("/purchase-orders", {
    method: "POST",
    body: {
      supplier_id: Number(input.supplierId),
      outlet_id: Number(input.outletId),
      expected_at: input.expectedAt || null,
      notes: input.notes || null,
      items: input.items.map((item) => ({
        product_id: Number(item.productId),
        quantity: item.quantity,
        unit_cost: item.unitCost,
      })),
    },
  });
  return mapPurchaseOrder(data);
}

export async function approvePurchaseOrder(id: string): Promise<void> {
  if (USE_MOCK_API) {
    const order = mockDb.purchaseOrders.find((item) => item.id === id);
    if (!order) throw new Error("Purchase order not found");
    if (order.status !== "draft") throw new Error("Only draft orders can be approved");
    order.status = "approved";
    order.approvedAt = new Date().toISOString();
    return;
  }
  await apiRequest<void>(`/purchase-orders/${id}/approve`, { method: "POST" });
}

export async function cancelPurchaseOrder(id: string): Promise<void> {
  if (USE_MOCK_API) {
    const order = mockDb.purchaseOrders.find((item) => item.id === id);
    if (!order) throw new Error("Purchase order not found");
    if (order.status !== "draft") throw new Error("Only draft orders can be cancelled");
    order.status = "cancelled";
    return;
  }
  await apiRequest<void>(`/purchase-orders/${id}`, { method: "PUT", body: { status: "cancelled" } });
}

export async function receivePurchaseOrder(
  id: string,
  items: { itemId: string; quantity: number; unitCost?: number }[],
  outletId: string
): Promise<void> {
  if (USE_MOCK_API) {
    const order = mockDb.purchaseOrders.find((item) => item.id === id);
    if (!order) throw new Error("Purchase order not found");
    items.forEach((entry) => {
      const item = order.items.find((line) => line.id === entry.itemId);
      if (!item) return;
      const received = (item.receivedQuantity ?? 0) + entry.quantity;
      item.receivedQuantity = received;
      item.cost = entry.unitCost ?? item.cost;
      adjustMockStock(item.productId, outletId, entry.quantity);
      mockDb.movements.unshift({
        id: mockId("m"),
        productId: item.productId,
        productName: item.productName,
        outletId,
        type: "receive",
        quantity: entry.quantity,
        reason: `Receipt against ${order.number}`,
        createdAt: new Date().toISOString(),
        createdBy: "Kendra Admin",
      });
    });
    const complete = order.items.every((item) => (item.receivedQuantity ?? 0) >= item.quantity);
    order.status = complete ? "received" : "partial";
    order.receivedAt = new Date().toISOString();
    return;
  }
  await apiRequest<void>(`/purchase-orders/${id}/receive`, {
    method: "POST",
    body: {
      items: items.map((item) => ({
        purchase_order_item_id: Number(item.itemId),
        quantity: item.quantity,
        unit_cost: item.unitCost,
      })),
    },
  });
}
