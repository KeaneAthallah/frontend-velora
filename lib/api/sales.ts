import { format } from "date-fns";
import { apiRequest, USE_MOCK_API } from "./client";
import { adjustMockStock, mockDb, mockId, mockLinePrice, mockProduct } from "./mock-db";
import type { Paginated, Transaction } from "./types";

export function mapSale(sale: any): Transaction {
  const payments = (sale.payments ?? []).map((payment: any) => ({
    id: String(payment.id),
    method: payment.method ?? "Cash",
    amount: Number(payment.amount ?? 0),
    status: payment.status ?? "completed",
    reference: payment.reference,
    createdAt: payment.paid_at ?? payment.created_at ?? new Date().toISOString(),
  }));

  const paid = Number(sale.paid_amount ?? 0);
  const total = Number(sale.total ?? 0);
  const paymentStatus: Transaction["paymentStatus"] =
    sale.status === "refunded"
      ? "refunded"
      : paid >= total && total > 0
        ? "paid"
        : paid > 0
          ? "partially_refunded"
          : "pending";
  const status: Transaction["status"] =
    sale.status === "voided" ? "voided" : sale.status === "refunded" ? "refunded" : "completed";

  return {
    id: String(sale.id),
    receiptNumber: sale.receipt_number ?? `S-${sale.id}`,
    outletId: String(sale.outlet_id),
    outletName: sale.outlet?.name ?? "",
    cashierId: String(sale.cashier_id ?? ""),
    cashierName: sale.cashier?.name ?? "",
    customerId: sale.customer_id ? String(sale.customer_id) : undefined,
    customerName: sale.customer?.name,
    items: (sale.items ?? []).map((item: any) => ({
      productId: item.product_id ? String(item.product_id) : undefined,
      name: item.product_name ?? item.name ?? "",
      sku: item.sku ?? "",
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unit_price ?? 0),
      discount: Number(item.discount_amount ?? 0),
      lineTotal: Number(item.line_total ?? 0),
    })),
    subtotal: Number(sale.subtotal ?? 0),
    discount: Number(sale.discount_amount ?? 0),
    tax: Number(sale.tax_amount ?? 0),
    total,
    paymentStatus,
    status,
    payments,
    notes: sale.notes ?? undefined,
    createdAt: sale.created_at ?? new Date().toISOString(),
  };
}

function filterBySearch(transactions: Transaction[], search: string) {
  const query = search.toLowerCase();
  return transactions.filter(
    (transaction) =>
      transaction.receiptNumber.toLowerCase().includes(query) ||
      transaction.cashierName.toLowerCase().includes(query) ||
      (transaction.customerName ?? "").toLowerCase().includes(query) ||
      transaction.outletName.toLowerCase().includes(query) ||
      transaction.items.some((item) => item.name.toLowerCase().includes(query))
  );
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

export async function listTransactions(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
  outletId?: string;
  status?: string;
  from?: string;
  to?: string;
}): Promise<Paginated<Transaction>> {
  if (USE_MOCK_API) {
    let data = [...mockDb.transactions];
    if (params?.outletId) data = data.filter((transaction) => transaction.outletId === params.outletId);
    if (params?.status) data = data.filter((transaction) => transaction.status === params.status);
    if (params?.from) data = data.filter((transaction) => new Date(transaction.createdAt) >= new Date(params.from!));
    if (params?.to) data = data.filter((transaction) => new Date(transaction.createdAt) <= new Date(params.to!));
    if (params?.search) data = filterBySearch(data, params.search);
    data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return localPage(data, params?.page ?? 1, params?.pageSize ?? 20);
  }

  const pageSize = params?.pageSize ?? 50;
  const page = params?.page ?? 1;
  const query = new URLSearchParams();
  if (params?.outletId) query.set("outlet_id", params.outletId);
  if (params?.status) query.set("status", params.status);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  query.set("page", String(page));
  query.set("per_page", String(pageSize));

  // The API does not expose free-text search. Scan recent pages and filter
  // locally rather than silently ignoring the query.
  if (params?.search) {
    const first = await apiRequest<any>(`/sales?${query.toString()}`);
    const pageCount = Math.min(Number(first?.last_page ?? 1), 6);
    let items = [...(first?.data ?? [])];
    if (pageCount > 1) {
      const rest = await Promise.all(
        Array.from({ length: pageCount - 1 }, (_, index) => {
          const nextQuery = new URLSearchParams(query);
          nextQuery.set("page", String(index + 2));
          return apiRequest<any>(`/sales?${nextQuery.toString()}`);
        })
      );
      rest.forEach((result) => {
        items = items.concat(result?.data ?? []);
      });
    }
    const mapped = filterBySearch(items.map(mapSale), params.search);
    return localPage(mapped, page, pageSize);
  }

  const data = await apiRequest<any>(`/sales?${query.toString()}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    data: items.map(mapSale),
    page: Number(data?.current_page ?? page),
    pageSize: Number(data?.per_page ?? pageSize),
    total: Number(data?.total ?? items.length),
    totalPages: Number(data?.last_page ?? 1),
  };
}

export async function getTransaction(id: string): Promise<Transaction> {
  if (USE_MOCK_API) {
    const transaction = mockDb.transactions.find((item) => item.id === id);
    if (!transaction) throw new Error("Transaction not found");
    return transaction;
  }
  const data = await apiRequest<any>(`/sales/${id}`);
  return mapSale(data);
}

export async function voidTransaction(id: string, reason: string): Promise<void> {
  if (USE_MOCK_API) {
    const transaction = mockDb.transactions.find((item) => item.id === id);
    if (!transaction) throw new Error("Transaction not found");
    if (transaction.status !== "completed") throw new Error("Only completed sales can be voided");
    transaction.status = "voided";
    transaction.paymentStatus = "refunded";
    transaction.payments = transaction.payments.map((payment) => ({ ...payment, status: "refunded" }));
    transaction.items.forEach((item) => {
      if (!item.productId) return;
      adjustMockStock(item.productId, transaction.outletId, item.quantity);
      mockDb.movements.unshift({
        id: mockId("m"),
        productId: item.productId,
        productName: item.name,
        outletId: transaction.outletId,
        type: "void",
        quantity: item.quantity,
        reason,
        createdAt: new Date().toISOString(),
        createdBy: transaction.cashierName,
      });
    });
    return;
  }
  await apiRequest<void>(`/sales/${id}/void`, { method: "POST", body: { reason } });
}

export async function checkout(request: {
  outletId: string;
  cashierId: string;
  customerId?: string;
  items: { productId: string; variantId?: string; discount?: number; quantity: number; optionIds?: string[] }[];
  cartDiscount?: number;
  notes?: string;
  idempotencyKey: string;
  paymentMethod?: string;
}): Promise<Transaction> {
  if (USE_MOCK_API) {
    const taxRate = mockDb.taxRates.find((rate) => rate.isDefault && rate.isActive);
    const rate = taxRate?.rate ?? 0;
    const inclusive = taxRate?.type === "inclusive";
    const items = request.items.map((item) => {
      const product = mockProduct(item.productId);
      if (!product) throw new Error("Product not found");
      const unitPrice = mockLinePrice(item.productId, item.optionIds ?? []);
      const lineTotal = unitPrice * item.quantity - (item.discount ?? 0);
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice,
        discount: item.discount ?? 0,
        lineTotal,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discount = request.cartDiscount ?? 0;
    const afterDiscount = subtotal - discount;
    const tax = inclusive
      ? Math.round(afterDiscount - afterDiscount / (1 + rate / 100))
      : Math.round(afterDiscount * (rate / 100));
    const total = inclusive ? afterDiscount : afterDiscount + tax;
    const outlet = mockDb.outlets.find((item) => item.id === request.outletId);
    const cashier = mockDb.employees.find((employee) => employee.userId === request.cashierId) ?? mockDb.employees[0];
    const customer = mockDb.customers.find((item) => item.id === request.customerId);
    const method = request.paymentMethod ?? "Cash";
    const now = new Date();
    const sequence = mockDb.transactions.length + 1;
    const transaction: Transaction = {
      id: mockId("tx"),
      receiptNumber: `R-${format(now, "yyyyMMdd")}-${String(sequence).padStart(4, "0")}`,
      outletId: request.outletId,
      outletName: outlet?.name ?? "",
      cashierId: request.cashierId,
      cashierName: cashier?.name ?? "Cashier",
      customerId: customer?.id,
      customerName: customer?.name,
      items,
      subtotal,
      discount,
      tax,
      total,
      paymentStatus: "paid",
      status: "completed",
      payments: [
        {
          id: mockId("pay"),
          method,
          amount: total,
          status: "success",
          createdAt: now.toISOString(),
        },
      ],
      notes: request.notes,
      createdAt: now.toISOString(),
    };
    mockDb.transactions = [transaction, ...mockDb.transactions];
    items.forEach((item) => {
      adjustMockStock(item.productId, request.outletId, -item.quantity);
      mockDb.movements.unshift({
        id: mockId("m"),
        productId: item.productId,
        productName: item.name,
        outletId: request.outletId,
        type: "sale",
        quantity: -item.quantity,
        reason: `Sale ${transaction.receiptNumber}`,
        createdAt: now.toISOString(),
        createdBy: transaction.cashierName,
      });
    });
    return transaction;
  }

  const saleBody = {
    outlet_id: Number(request.outletId),
    customer_id: request.customerId ? Number(request.customerId) : null,
    notes: request.notes,
    idempotency_key: request.idempotencyKey,
    items: request.items.map((item) => ({
      product_id: Number(item.productId),
      product_variant_id: item.variantId ? Number(item.variantId) : null,
      quantity: item.quantity,
      discount_amount: item.discount ?? 0,
      option_ids: item.optionIds?.map(Number) ?? [],
    })),
  };
  const sale = await apiRequest<any>("/sales", {
    method: "POST",
    body: saleBody,
    idempotencyKey: request.idempotencyKey,
  });

  let paymentFailed = false;
  try {
    await apiRequest<any>("/payments", {
      method: "POST",
      body: {
        sale_id: Number(sale.id),
        method: (request.paymentMethod ?? "cash").toLowerCase(),
        amount: Number(sale.total),
        idempotency_key: `${request.idempotencyKey}-payment`,
      },
    });
  } catch {
    paymentFailed = true;
  }

  const full = await apiRequest<any>(`/sales/${sale.id}`);
  const mapped = mapSale(full);
  if (paymentFailed) {
    mapped.paymentStatus = "pending";
  }
  return mapped;
}
