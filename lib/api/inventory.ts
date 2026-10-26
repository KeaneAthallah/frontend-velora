import { apiRequest, USE_MOCK_API } from "./client";
import { mockMovements, mockProducts } from "./mock-data";
import type { InventoryMovement, Paginated } from "./types";

export type StockRow = { productId: string; name: string; sku: string; stock: number };

let movements = [...mockMovements];

export async function listMovements(params?: { page?: number; pageSize?: number }): Promise<Paginated<InventoryMovement>> {
  if (USE_MOCK_API) {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    return { data: movements.slice(start, start + pageSize), page, pageSize, total: movements.length, totalPages: Math.ceil(movements.length / pageSize) };
  }
  const data = await apiRequest<any>("/inventory/movements?per_page=100");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    data: items.map((m: any) => ({
      id: String(m.id),
      productId: String(m.product_id),
      productName: m.product?.name ?? "",
      outletId: String(m.outlet_id),
      type: (m.type === "adjustment" ? "adjustment" : m.type) as any,
      quantity: Number(m.quantity),
      reason: m.reason ?? "",
      createdAt: m.created_at ?? new Date().toISOString(),
      createdBy: m.actor_id ? String(m.actor_id) : "",
    })),
    page: Number(data?.current_page ?? 1),
    pageSize: Number(data?.per_page ?? 100),
    total: Number(data?.total ?? items.length),
    totalPages: Number(data?.last_page ?? 1),
  };
}

export async function adjustStock(input: { productId: string; outletId: string; quantity: number; reason: string }): Promise<void> {
  if (USE_MOCK_API) {
    movements = [
      { id: `m${Date.now()}`, productId: input.productId, productName: mockProducts.find((p) => p.id === input.productId)?.name ?? "", outletId: input.outletId, type: "adjustment", quantity: input.quantity, reason: input.reason, createdAt: new Date().toISOString(), createdBy: "Kendra Admin" },
      ...movements,
    ];
    return;
  }
  await apiRequest<void>("/inventory/adjust", { method: "POST", body: { product_id: Number(input.productId), quantity: input.quantity, reason: input.reason } });
}

export async function stockByOutlet(outletId: string): Promise<StockRow[]> {
  if (USE_MOCK_API) {
    return mockProducts.map((p) => ({ productId: p.id, name: p.name, sku: p.sku, stock: p.stockByOutlet[outletId] ?? 0 }));
  }
  const data = await apiRequest<any>("/inventory/balances?per_page=100");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map((b: any) => ({
    productId: String(b.product_id),
    name: b.product?.name ?? "",
    sku: b.product?.sku ?? "",
    stock: Number(b.quantity ?? 0),
  }));
}
