import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb } from "./mock-db";
import type { InventoryMovement, Product } from "./types";

type StockTransferItem = {
  product_id: string;
  product_variant_id?: string;
  quantity: number;
};

type StockTransferFormValues = {
  from_outlet_id: string;
  to_outlet_id: string;
  notes?: string;
  items: StockTransferItem[];
};

type StockTransfer = {
  id: string;
  business_id: string;
  from_outlet_id: string;
  to_outlet_id: string;
  status: "draft" | "approved" | "in_transit" | "completed";
  notes?: string;
  created_at: string;
  items: StockTransferItem[];
};

type StockTransferCreateResponse = {
  transfer: StockTransfer;
};

type StockTransferCompleteResponse = {
  transfer: StockTransfer;
};

type StockTransferListResponse = {
  success: boolean;
  message: string;
  data: {
    transfers: StockTransfer[];
    current_page: number;
    total: number;
  };
};

export async function listStockTransfers(businessId: string): Promise<StockTransfer[]> {
  if (USE_MOCK_API) {
    return mockDb.stockTransfers ?? [];
  }
  const res = await apiRequest<{ transfers: StockTransfer[] }>(`/stock-transfers?business_id=${businessId}`);
  return res.transfers;
}

export async function createStockTransfer(
  businessId: string,
  form: StockTransferFormValues
): Promise<StockTransfer> {
  if (USE_MOCK_API) {
    const transfer: StockTransfer = {
      id: mockId("st"),
      business_id: businessId,
      from_outlet_id: form.from_outlet_id,
      to_outlet_id: form.to_outlet_id,
      status: "draft",
      notes: form.notes,
      created_at: new Date().toISOString(),
      items: form.items.map((item) => ({ ...item })),
    };
    mockDb.stockTransfers = mockDb.stockTransfers ?? [];
    mockDb.stockTransfers.push(transfer);
    return transfer;
  }
  const res = await apiRequest<StockTransferCreateResponse>(
    `/stock-transfers`,
    {
      method: "POST",
      body: {
        ...form,
        from_outlet_id: form.from_outlet_id,
        to_outlet_id: form.to_outlet_id,
        notes: form.notes,
        items: form.items,
      },
    }
  );
  return res.transfer;
}

export async function completeStockTransfer(
  businessId: string,
  transferId: string
): Promise<StockTransfer> {
  if (USE_MOCK_API) {
    const transfer = mockDb.stockTransfers?.find((t) => t.id === transferId);
    if (!transfer) throw new Error("Transfer not found");
    if (transfer.status !== "draft") throw new Error("Transfer not in draft state");

    // Mock: move stock between outlets
    for (const item of transfer.items) {
      const product = mockDb.products.find((p) => p.id === item.product_id);
      if (!product) continue;

      // Decrement from from_outlet
      product.stockByOutlet = {
        ...product.stockByOutlet,
        [transfer.from_outlet_id]: Math.max(
          0,
          product.stockByOutlet[transfer.from_outlet_id] ?? 0 - item.quantity
        ),
      };

      // Increment to to_outlet
      product.stockByOutlet = {
        ...product.stockByOutlet,
        [transfer.to_outlet_id]: Math.max(
          0,
          product.stockByOutlet[transfer.to_outlet_id] ?? 0 + item.quantity
        ),
      };

      // Log movements
      mockDb.movements = mockDb.movements ?? [];
      mockDb.movements.unshift({
        id: mockId("mvt"),
        outletId: transfer.from_outlet_id,
        productId: item.product_id,
        productName: item.product_variant_id ? `Variant ${item.product_variant_id}` : item.product_id,
        type: "transfer_out" as const,
        quantity: item.quantity,
        reason: "Stock transfer out",
        balanceAfter: (product.stockByOutlet[transfer.from_outlet_id] ?? 0),
        createdAt: new Date().toISOString(),
        createdBy: "",
      });
      mockDb.movements.unshift({
        id: mockId("mvt"),
        outletId: transfer.to_outlet_id,
        productId: item.product_id,
        productName: item.product_variant_id ? `Variant ${item.product_variant_id}` : item.product_id,
        type: "transfer_in" as const,
        quantity: item.quantity,
        reason: "Stock transfer in",
        balanceAfter: (product.stockByOutlet[transfer.to_outlet_id] ?? 0),
        createdAt: new Date().toISOString(),
        createdBy: "",
      });
    }

    transfer.status = "completed";
    transfer.completed_at = new Date().toISOString();
    return transfer;
  }
  const res = await apiRequest<StockTransferCompleteResponse>(
    `/stock-transfers/${transferId}/complete`,
    { method: "POST" }
  );
  return res.transfer;
}

export async function getStockTransfer(
  businessId: string,
  transferId: string
): Promise<StockTransfer> {
  if (USE_MOCK_API) {
    return mockDb.stockTransfers?.find((t) => t.id === transferId) ?? {
      id: transferId,
      business_id: businessId,
      from_outlet_id: "",
      to_outlet_id: "",
      status: "draft",
      completed_at: undefined,
      notes: undefined,
      created_at: new Date().toISOString(),
      items: [],
    };
  }
  const res = await apiRequest<{ transfer: StockTransfer }>(
    `/stock-transfers/${transferId}?business_id=${businessId}`
  );
  return res.transfer;
}


// Mock data helpers
export function mockId(prefix: string) {
  let counter = 0;
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}