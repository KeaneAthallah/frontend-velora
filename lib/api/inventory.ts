import { apiRequest, USE_MOCK_API } from "./client";
import { adjustMockStock, mockDb, mockId, mockProduct } from "./mock-db";
import type { InventoryMovement, Paginated } from "./types";

export type StockRow = { productId: string; name: string; sku: string; stock: number };

const movementLabels: Record<string, InventoryMovement["type"]> = {
  adjustment: "adjustment",
  damaged: "damaged",
  missing: "missing",
  expired: "expired",
  write_off: "write_off",
  transfer: "transfer",
  receipt: "receive",
  receive: "receive",
  sale: "sale",
  return: "return",
  void: "void",
};

export async function listMovements(params?: {
  page?: number;
  pageSize?: number;
  productId?: string;
}): Promise<Paginated<InventoryMovement>> {
  if (USE_MOCK_API) {
    let data = [...mockDb.movements];
    if (params?.productId) data = data.filter((movement) => movement.productId === params.productId);
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
  if (params?.productId) query.set("product_id", params.productId);
  query.set("page", String(params?.page ?? 1));
  query.set("per_page", String(params?.pageSize ?? 20));
  const data = await apiRequest<any>(`/inventory/movements?${query.toString()}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    data: items.map((movement: any) => ({
      id: String(movement.id),
      productId: String(movement.product_id),
      productName: movement.product?.name ?? "",
      outletId: String(movement.outlet_id),
      type: movementLabels[movement.type] ?? "adjustment",
      quantity: Number(movement.quantity),
      reason: movement.reason ?? "",
      balanceAfter: movement.balance_after !== undefined ? Number(movement.balance_after) : undefined,
      createdAt: movement.created_at ?? new Date().toISOString(),
      createdBy: "",
    })),
    page: Number(data?.current_page ?? params?.page ?? 1),
    pageSize: Number(data?.per_page ?? params?.pageSize ?? 20),
    total: Number(data?.total ?? items.length),
    totalPages: Number(data?.last_page ?? 1),
  };
}

export async function adjustStock(input: {
  productId: string;
  outletId: string;
  quantity: number;
  reason: string;
  type?: InventoryMovement["type"];
}): Promise<void> {
  if (!input.quantity) throw new Error("Enter a quantity other than zero");
  if (!input.reason.trim()) throw new Error("A reason is required");
  if (USE_MOCK_API) {
    const product = mockProduct(input.productId);
    if (!product) throw new Error("Product not found");
    adjustMockStock(input.productId, input.outletId, input.quantity);
    mockDb.movements.unshift({
      id: mockId("m"),
      productId: input.productId,
      productName: product.name,
      outletId: input.outletId,
      type: input.type ?? "adjustment",
      quantity: input.quantity,
      reason: input.reason.trim(),
      balanceAfter: product.stockByOutlet[input.outletId] ?? 0,
      createdAt: new Date().toISOString(),
      createdBy: "Kendra Admin",
    });
    return;
  }
  await apiRequest<void>("/inventory/adjust", {
    method: "POST",
    body: {
      product_id: Number(input.productId),
      quantity: input.quantity,
      reason: input.reason.trim(),
      type: input.type ?? "adjustment",
    },
  });
}

export async function stockByOutlet(outletId: string): Promise<StockRow[]> {
  if (USE_MOCK_API) {
    return mockDb.products.map((product) => ({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      stock: product.stockByOutlet[outletId] ?? 0,
    }));
  }
  const data = await apiRequest<any>(`/inventory/balances?outlet_id=${encodeURIComponent(outletId)}&per_page=100`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map((balance: any) => ({
    productId: String(balance.product_id),
    name: balance.product?.name ?? "",
    sku: balance.product?.sku ?? "",
    stock: Number(balance.quantity ?? 0),
  }));
}
