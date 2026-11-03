import { apiRequest, USE_MOCK_API } from "./client";
import { adjustMockStock, mockDb, mockId, mockProduct } from "./mock-db";
import type { StockTransfer, StockTransferItem, StockTransferStatus } from "./types";

type Raw = Record<string, any>;

export type StockTransferInput = {
  fromOutletId: string;
  toOutletId: string;
  notes?: string;
  items: { productId: string; quantity: number }[];
};

const STATUSES: StockTransferStatus[] = ["draft", "approved", "in_transit", "completed", "cancelled"];

function mapItem(raw: Raw, productName?: string): StockTransferItem {
  return {
    id: String(raw.id ?? ""),
    productId: String(raw.product_id ?? ""),
    productName: raw.product?.name ?? productName,
    quantity: Number(raw.quantity ?? 0),
  };
}

function mapTransfer(raw: Raw): StockTransfer {
  return {
    id: String(raw.id ?? ""),
    fromOutletId: String(raw.from_outlet_id ?? ""),
    toOutletId: String(raw.to_outlet_id ?? ""),
    status: STATUSES.includes(raw.status) ? raw.status : "draft",
    notes: raw.notes ?? null,
    createdAt: raw.created_at ?? "",
    completedAt: raw.completed_at ?? null,
    items: Array.isArray(raw.items) ? raw.items.map((item: Raw) => mapItem(item)) : [],
  };
}

export async function listStockTransfers(): Promise<StockTransfer[]> {
  if (USE_MOCK_API) {
    return [...mockDb.stockTransfers]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((transfer) => ({ ...transfer, items: transfer.items.map((item) => ({ ...item })) }));
  }
  const data = await apiRequest<any>("/stock-transfers");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map(mapTransfer);
}

export async function createStockTransfer(input: StockTransferInput): Promise<StockTransfer> {
  if (!input.items.length) throw new Error("Add at least one product");
  if (input.fromOutletId === input.toOutletId) throw new Error("Choose two different outlets");

  if (USE_MOCK_API) {
    const transfer: StockTransfer = {
      id: mockId("st"),
      fromOutletId: input.fromOutletId,
      toOutletId: input.toOutletId,
      status: "draft",
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      items: input.items.map((item) => ({
        id: mockId("sti"),
        productId: item.productId,
        productName: mockProduct(item.productId)?.name,
        quantity: item.quantity,
      })),
    };
    mockDb.stockTransfers = [transfer, ...mockDb.stockTransfers];
    return { ...transfer, items: transfer.items.map((item) => ({ ...item })) };
  }

  const data = await apiRequest<Raw>("/stock-transfers", {
    method: "POST",
    body: {
      from_outlet_id: Number(input.fromOutletId),
      to_outlet_id: Number(input.toOutletId),
      notes: input.notes,
      items: input.items.map((item) => ({
        product_id: Number(item.productId),
        quantity: item.quantity,
      })),
    },
  });
  return mapTransfer(data);
}

export async function completeStockTransfer(id: string): Promise<StockTransfer> {
  if (USE_MOCK_API) {
    const transfer = mockDb.stockTransfers.find((item) => item.id === id);
    if (!transfer) throw new Error("Transfer not found");
    if (transfer.status !== "draft") throw new Error("Only draft transfers can be completed");

    transfer.items.forEach((item) => {
      adjustMockStock(item.productId, transfer.fromOutletId, -item.quantity);
      adjustMockStock(item.productId, transfer.toOutletId, item.quantity);
      const product = mockProduct(item.productId);
      mockDb.movements.unshift(
        {
          id: mockId("m"),
          productId: item.productId,
          productName: product?.name ?? "",
          outletId: transfer.fromOutletId,
          type: "transfer_out",
          quantity: -item.quantity,
          reason: `Transfer ${transfer.id}`,
          balanceAfter: product?.stockByOutlet[transfer.fromOutletId] ?? 0,
          createdAt: new Date().toISOString(),
          createdBy: "",
        },
        {
          id: mockId("m"),
          productId: item.productId,
          productName: product?.name ?? "",
          outletId: transfer.toOutletId,
          type: "transfer_in",
          quantity: item.quantity,
          reason: `Transfer ${transfer.id}`,
          balanceAfter: product?.stockByOutlet[transfer.toOutletId] ?? 0,
          createdAt: new Date().toISOString(),
          createdBy: "",
        }
      );
    });

    transfer.status = "completed";
    transfer.completedAt = new Date().toISOString();
    return { ...transfer, items: transfer.items.map((item) => ({ ...item })) };
  }

  const data = await apiRequest<Raw>(`/stock-transfers/${id}/complete`, { method: "POST" });
  return mapTransfer(data);
}

export async function getStockTransfer(id: string): Promise<StockTransfer> {
  if (USE_MOCK_API) {
    const transfer = mockDb.stockTransfers.find((item) => item.id === id);
    if (!transfer) throw new Error("Transfer not found");
    return { ...transfer, items: transfer.items.map((item) => ({ ...item })) };
  }
  return mapTransfer(await apiRequest<Raw>(`/stock-transfers/${id}`));
}
