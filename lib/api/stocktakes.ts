import { apiRequest, USE_MOCK_API } from "./client";
import { adjustMockStock, mockDb, mockId, mockProduct } from "./mock-db";
import type { Stocktake, StocktakeItem, StocktakeStatus } from "./types";

type Raw = Record<string, any>;

const STATUSES: StocktakeStatus[] = ["draft", "in_progress", "completed", "cancelled"];

function mapItem(raw: Raw): StocktakeItem {
  return {
    id: String(raw.id ?? ""),
    productId: String(raw.product_id ?? ""),
    productName: raw.product?.name ?? undefined,
    sku: raw.product?.sku ?? undefined,
    expectedQuantity: Number(raw.expected_quantity ?? 0),
    countedQuantity: Number(raw.counted_quantity ?? 0),
  };
}

function mapStocktake(raw: Raw): Stocktake {
  return {
    id: String(raw.id ?? ""),
    outletId: String(raw.outlet_id ?? ""),
    outletName: raw.outlet?.name ?? undefined,
    status: STATUSES.includes(raw.status) ? raw.status : "draft",
    notes: raw.notes ?? null,
    createdAt: raw.created_at ?? "",
    completedAt: raw.completed_at ?? null,
    items: Array.isArray(raw.items) ? raw.items.map(mapItem) : [],
  };
}

export async function listStocktakes(): Promise<Stocktake[]> {
  if (USE_MOCK_API) {
    return [...mockDb.stocktakes]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((stocktake) => ({ ...stocktake, items: stocktake.items.map((item) => ({ ...item })) }));
  }
  const data = await apiRequest<any>("/stocktakes");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map(mapStocktake);
}

export async function getStocktake(id: string): Promise<Stocktake> {
  if (USE_MOCK_API) {
    const stocktake = mockDb.stocktakes.find((item) => item.id === id);
    if (!stocktake) throw new Error("Stocktake not found");
    return { ...stocktake, items: stocktake.items.map((item) => ({ ...item })) };
  }
  return mapStocktake(await apiRequest<Raw>(`/stocktakes/${id}`));
}

export async function createStocktake(input: { outletId: string; notes?: string }): Promise<Stocktake> {
  if (USE_MOCK_API) {
    const stocktake: Stocktake = {
      id: mockId("stk"),
      outletId: input.outletId,
      status: "draft",
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      items: mockDb.products
        .filter((product) => product.trackInventory !== false)
        .map((product) => ({
          id: mockId("stki"),
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          expectedQuantity: product.stockByOutlet[input.outletId] ?? 0,
          countedQuantity: 0,
        })),
    };
    mockDb.stocktakes = [stocktake, ...mockDb.stocktakes];
    return { ...stocktake, items: stocktake.items.map((item) => ({ ...item })) };
  }
  return mapStocktake(
    await apiRequest<Raw>("/stocktakes", {
      method: "POST",
      body: { outlet_id: Number(input.outletId), notes: input.notes },
    })
  );
}

export async function saveStocktakeCounts(
  id: string,
  input: { items: { id: string; countedQuantity: number }[]; notes?: string }
): Promise<Stocktake> {
  if (USE_MOCK_API) {
    const stocktake = mockDb.stocktakes.find((item) => item.id === id);
    if (!stocktake) throw new Error("Stocktake not found");
    if (stocktake.status !== "draft" && stocktake.status !== "in_progress") {
      throw new Error("This stocktake is closed");
    }
    input.items.forEach((row) => {
      const item = stocktake.items.find((entry) => entry.id === row.id);
      if (item) item.countedQuantity = row.countedQuantity;
    });
    if (input.notes !== undefined) stocktake.notes = input.notes || null;
    stocktake.status = "in_progress";
    return { ...stocktake, items: stocktake.items.map((item) => ({ ...item })) };
  }
  return mapStocktake(
    await apiRequest<Raw>(`/stocktakes/${id}`, {
      method: "PUT",
      body: {
        notes: input.notes,
        items: input.items.map((row) => ({ id: Number(row.id), counted_quantity: row.countedQuantity })),
      },
    })
  );
}

async function postCounts(id: string, path: "post" | "cancel"): Promise<Stocktake> {
  if (USE_MOCK_API) {
    const stocktake = mockDb.stocktakes.find((item) => item.id === id);
    if (!stocktake) throw new Error("Stocktake not found");
    if (stocktake.status !== "draft" && stocktake.status !== "in_progress") {
      throw new Error("This stocktake is closed");
    }
    if (path === "cancel") {
      stocktake.status = "cancelled";
      return { ...stocktake, items: stocktake.items.map((item) => ({ ...item })) };
    }
    stocktake.items.forEach((item) => {
      const product = mockProduct(item.productId);
      const current = product?.stockByOutlet[stocktake.outletId] ?? 0;
      const delta = item.countedQuantity - current;
      item.expectedQuantity = current;
      if (!delta) return;
      adjustMockStock(item.productId, stocktake.outletId, delta);
      mockDb.movements.unshift({
        id: mockId("m"),
        productId: item.productId,
        productName: item.productName ?? "",
        outletId: stocktake.outletId,
        type: "adjustment",
        quantity: delta,
        reason: `Stocktake ${stocktake.id}`,
        balanceAfter: product?.stockByOutlet[stocktake.outletId] ?? 0,
        createdAt: new Date().toISOString(),
        createdBy: "",
      });
    });
    stocktake.status = "completed";
    stocktake.completedAt = new Date().toISOString();
    return { ...stocktake, items: stocktake.items.map((item) => ({ ...item })) };
  }
  const raw = await apiRequest<Raw>(`/stocktakes/${id}/${path}`, { method: "POST" });
  return mapStocktake(raw);
}

export function postStocktake(id: string): Promise<Stocktake> {
  return postCounts(id, "post");
}

export function cancelStocktake(id: string): Promise<Stocktake> {
  return postCounts(id, "cancel");
}
