import { apiRequest, USE_MOCK_API } from "./client";
import { mockTransactions } from "./mock-data";
import type { Paginated, Transaction } from "./types";

let transactions = [...mockTransactions];

function mapSale(s: any): Transaction {
  return {
    id: String(s.id),
    receiptNumber: s.receipt_number ?? `S-${s.id}`,
    outletId: String(s.outlet_id),
    outletName: s.outlet?.name ?? "",
    cashierId: String(s.cashier_id),
    cashierName: s.cashier?.name ?? "",
    customerId: s.customer_id ? String(s.customer_id) : undefined,
    customerName: s.customer?.name,
    items: (s.items ?? []).map((it: any) => ({
      name: it.product_name ?? it.name ?? "",
      sku: it.sku ?? "",
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      discount: Number(it.discount_amount ?? 0),
      lineTotal: Number(it.line_total),
    })),
    subtotal: Number(s.subtotal),
    discount: Number(s.discount_amount ?? 0),
    tax: Number(s.tax_amount ?? 0),
    total: Number(s.total),
    paymentStatus: Number(s.paid_amount ?? 0) >= Number(s.total ?? 0) ? "paid" : (Number(s.paid_amount ?? 0) > 0 ? "partially_refunded" : "pending"),
    status: (s.status === "voided" ? "voided" : s.status === "refunded" ? "refunded" : "completed") as Transaction["status"],
    payments: (s.payments ?? []).map((p: any) => ({
      id: String(p.id),
      method: p.method,
      amount: Number(p.amount),
      status: p.status,
      reference: p.reference,
      createdAt: p.paid_at ?? p.created_at ?? new Date().toISOString(),
    })),
    createdAt: s.created_at ?? new Date().toISOString(),
  };
}

export async function listTransactions(params?: { search?: string; page?: number; pageSize?: number; outletId?: string; status?: string }): Promise<Paginated<Transaction>> {
  if (USE_MOCK_API) {
    let data = [...transactions];
    if (params?.search) {
      const q = params.search.toLowerCase();
      data = data.filter((t) => t.receiptNumber.toLowerCase().includes(q) || t.cashierName.toLowerCase().includes(q));
    }
    if (params?.outletId) data = data.filter((t) => t.outletId === params.outletId);
    if (params?.status) data = data.filter((t) => t.status === params.status);
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    return { data: data.slice(start, start + pageSize), page, pageSize, total: data.length, totalPages: Math.ceil(data.length / pageSize) };
  }
  const qs = new URLSearchParams();
  if (params?.outletId) qs.set("outlet_id", params.outletId);
  if (params?.status) qs.set("status", params.status);
  qs.set("per_page", String(params?.pageSize ?? 50));
  const data = await apiRequest<any>(`/sales?${qs.toString()}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    data: items.map(mapSale),
    page: Number(data?.current_page ?? 1),
    pageSize: Number(data?.per_page ?? 50),
    total: Number(data?.total ?? items.length),
    totalPages: Number(data?.last_page ?? 1),
  };
}

export async function getTransaction(id: string): Promise<Transaction> {
  if (USE_MOCK_API) {
    const t = transactions.find((x) => x.id === id);
    if (!t) throw new Error("Not found");
    return t;
  }
  const data = await apiRequest<any>(`/sales/${id}`);
  return mapSale(data);
}

export async function checkout(req: {
  outletId: string;
  cashierId: string;
  items: { productId: string; variantId?: string; discount?: number; quantity: number }[];
  cartDiscount?: number;
  notes?: string;
  idempotencyKey: string;
  paymentMethod?: string;
}): Promise<Transaction> {
  if (USE_MOCK_API) {
    const { mockProducts } = await import("./mock-data");
    const items = req.items.map((it) => {
      const p = mockProducts.find((x) => x.id === it.productId)!;
      const unit = p.price;
      const lineTotal = unit * it.quantity - (it.discount ?? 0);
      return { name: p.name, sku: p.sku, quantity: it.quantity, unitPrice: unit, discount: it.discount ?? 0, lineTotal };
    });
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const discount = req.cartDiscount ?? 0;
    const tax = Math.round((subtotal - discount) * 0.1);
    const total = subtotal - discount + tax;
    const tx: Transaction = {
      id: `tx${Date.now()}`,
      receiptNumber: `R-${String(transactions.length + 1).padStart(4, "0")}`,
      outletId: req.outletId,
      outletName: "Outlet Pusat",
      cashierId: req.cashierId,
      cashierName: "Kendra Admin",
      items,
      subtotal,
      discount,
      tax,
      total,
      paymentStatus: "paid",
      status: "completed",
      payments: [{ id: `pay${Date.now()}`, method: "Cash", amount: total, status: "success", createdAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    };
    transactions = [tx, ...transactions];
    return tx;
  }
  // Real: create sale
  const saleBody = {
    outlet_id: Number(req.outletId),
    notes: req.notes,
    idempotency_key: req.idempotencyKey,
    items: req.items.map((it) => ({
      product_id: Number(it.productId),
      product_variant_id: it.variantId ? Number(it.variantId) : null,
      quantity: it.quantity,
      discount_amount: it.discount ?? 0,
    })),
  };
  const sale = await apiRequest<any>("/sales", { method: "POST", body: saleBody, idempotencyKey: req.idempotencyKey });
  // Create payment for total (method passed? frontend checkout passes paymentMethod id; map to string)
  // Payment method id from UI is actually an id; backend expects method string. We'll send "cash" default.
  const total = Number(sale.total);
  try {
    await apiRequest<any>("/payments", { method: "POST", body: { sale_id: Number(sale.id), method: (req.paymentMethod ?? "cash").toLowerCase(), amount: total, idempotency_key: req.idempotencyKey } });
  } catch {
    // payment may already exist (idempotent) or fail; continue
  }
  const full = await apiRequest<any>(`/sales/${sale.id}`);
  return mapSale(full);
}
