import { format } from "date-fns";
import { apiRequest, USE_MOCK_API } from "./client";
import { adjustMockStock, consumeMockIngredients, mockDb, mockId, mockLinePrice, mockNextOrderNumber, mockProduct, reverseMockIngredients } from "./mock-db";
import { buildPaymentBatch, mockRecordPayments, normalizeRefund } from "./payments";
import { mockFinalizeDiscounts, mockQuoteCart, mockReverseDiscounts } from "./promotions";
import { mockActiveOrderForTable } from "./tables";
import type { OrderFulfilment, OrderType, Paginated, PaymentInput, Transaction } from "./types";

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
      : sale.status === "partially_refunded"
        ? "partially_refunded"
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
      optionIds: Array.isArray(item.option_ids) ? item.option_ids.map(String) : [],
      notes: item.notes ?? undefined,
    })),
    subtotal: Number(sale.subtotal ?? 0),
    discount: Number(sale.discount_amount ?? 0),
    tax: Number(sale.tax_amount ?? 0),
    total,
    paidAmount: Number(sale.paid_amount ?? 0),
    changeAmount: Number(sale.change_amount ?? 0),
    paymentStatus,
    status,
    payments,
    refunds: Array.isArray(sale.refunds) ? sale.refunds.map(normalizeRefund) : [],
    notes: sale.notes ?? undefined,
    createdAt: sale.created_at ?? new Date().toISOString(),
    orderNumber: sale.order_number ?? undefined,
    orderType: sale.order_type ?? undefined,
    orderStatus: sale.order_status ?? undefined,
    tableId: sale.table_id ? String(sale.table_id) : undefined,
    tableName: sale.table?.name ?? sale.table_name ?? undefined,
    fulfilment: sale.fulfilment
      ? {
          contactName: sale.fulfilment.contact_name ?? undefined,
          contactPhone: sale.fulfilment.contact_phone ?? undefined,
          address: sale.fulfilment.address ?? undefined,
          scheduledAt: sale.fulfilment.scheduled_at ?? undefined,
          instructions: sale.fulfilment.instructions ?? undefined,
        }
      : undefined,
    firedAt: sale.fired_at ?? undefined,
    readyAt: sale.ready_at ?? undefined,
    servedAt: sale.served_at ?? undefined,
    promotionCode: sale.promotion_code ?? undefined,
    promotionName: sale.promotion?.name ?? undefined,
    promotionDiscount: Number(sale.promotion_discount ?? 0),
    loyaltyDiscount: Number(sale.loyalty_discount ?? 0),
    loyaltyPointsRedeemed: Number(sale.loyalty_points_redeemed ?? 0),
    loyaltyPointsEarned: Number(sale.loyalty_points_earned ?? 0),
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
    reverseMockIngredients(transaction.id, reason);
    mockReverseDiscounts(transaction);
    return;
  }
  await apiRequest<void>(`/sales/${id}/void`, { method: "POST", body: { reason } });
}

export async function checkout(request: {
  outletId: string;
  cashierId: string;
  customerId?: string;
  items: { productId: string; variantId?: string; discount?: number; quantity: number; optionIds?: string[]; notes?: string }[];
  cartDiscount?: number;
  notes?: string;
  idempotencyKey: string;
  paymentMethod?: string;
  payments?: PaymentInput[];
  orderType?: OrderType;
  tableId?: string;
  fulfilment?: OrderFulfilment;
  promotionCode?: string;
  redeemPoints?: number;
}): Promise<Transaction> {
  const orderType = request.orderType ?? "takeaway";
  if (USE_MOCK_API) {
    const table = request.tableId
      ? mockDb.diningTables.find(
          (entry) => entry.id === request.tableId && entry.outletId === request.outletId
        )
      : undefined;
    if (request.tableId && !table) throw new Error("Table not found in this outlet");
    if (table && orderType !== "dine_in") throw new Error("Tables are only for dine-in orders");
    if (table && !table.isActive) throw new Error("This table is inactive");
    if (request.tableId && mockActiveOrderForTable(request.tableId)) {
      throw new Error("This table already has an open order");
    }

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
        optionIds: item.optionIds ?? [],
        notes: item.notes,
      };
    });
    const quote = mockQuoteCart({
      items: request.items,
      promotionCode: request.promotionCode,
      customerId: request.customerId,
      redeemPoints: request.redeemPoints,
    });
    const subtotal = quote.subtotal;
    const discount = quote.discount;
    const tax = quote.tax;
    const total = quote.total;
    const outlet = mockDb.outlets.find((item) => item.id === request.outletId);
    const cashier = mockDb.employees.find((employee) => employee.userId === request.cashierId) ?? mockDb.employees[0];
    const customer = mockDb.customers.find((item) => item.id === request.customerId);
    const now = new Date();
    const sequence = mockDb.transactions.length + 1;
    const orderNumber = mockNextOrderNumber(request.outletId, orderType, now);
    const batch = buildPaymentBatch(total, request.payments, request.paymentMethod ?? "cash");
    const recorded = mockRecordPayments(total, batch);
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
      paidAmount: recorded.paid,
      changeAmount: recorded.change,
      paymentStatus: "paid",
      status: "completed",
      payments: recorded.payments,
      notes: request.notes,
      createdAt: now.toISOString(),
      orderNumber,
      orderType,
      orderStatus: "completed",
      tableId: table?.id,
      tableName: table?.name,
      fulfilment: request.fulfilment,
      promotionCode: quote.promotionCode,
      promotionName: quote.promotionName,
      promotionDiscount: quote.promotionDiscount,
      loyaltyDiscount: quote.loyaltyDiscount,
      loyaltyPointsRedeemed: quote.loyaltyPointsRedeemed,
      loyaltyPointsEarned: 0,
    };
    transaction.loyaltyPointsEarned = mockFinalizeDiscounts(transaction, quote, customer?.id);
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
    request.items.forEach((item) => {
      consumeMockIngredients(
        item.productId,
        item.variantId,
        item.quantity,
        request.outletId,
        transaction.id,
        transaction.receiptNumber
      );
    });
    return transaction;
  }

  const saleBody = {
    outlet_id: Number(request.outletId),
    customer_id: request.customerId ? Number(request.customerId) : null,
    notes: request.notes,
    idempotency_key: request.idempotencyKey,
    order_type: orderType,
    ...(request.tableId ? { table_id: Number(request.tableId) } : {}),
    ...(request.fulfilment
      ? {
          fulfilment: {
            contact_name: request.fulfilment.contactName,
            contact_phone: request.fulfilment.contactPhone,
            address: request.fulfilment.address,
            scheduled_at: request.fulfilment.scheduledAt,
            instructions: request.fulfilment.instructions,
          },
        }
      : {}),
    ...(request.promotionCode ? { promotion_code: request.promotionCode.trim().toUpperCase() } : {}),
    ...(request.redeemPoints ? { redeem_points: request.redeemPoints } : {}),
    items: request.items.map((item) => ({
      product_id: Number(item.productId),
      product_variant_id: item.variantId ? Number(item.variantId) : null,
      quantity: item.quantity,
      discount_amount: item.discount ?? 0,
      option_ids: item.optionIds?.map(Number) ?? [],
      notes: item.notes,
    })),
  };
  const sale = await apiRequest<any>("/sales", {
    method: "POST",
    body: saleBody,
    idempotencyKey: request.idempotencyKey,
  });

  // The sale total is authoritative (tax is rounded per line server-side), so
  // the payment batch is fitted to it before it is recorded. Keeping this as a
  // second call also means a retry of the same checkout (same idempotency key)
  // resumes where it stopped instead of charging twice.
  const batch = buildPaymentBatch(Number(sale.total), request.payments, request.paymentMethod ?? "cash");
  await apiRequest<any>(`/sales/${sale.id}/payments`, {
    method: "POST",
    body: {
      payments: batch.map((line) => ({
        method: line.method,
        amount: line.amount,
        reference: line.reference,
      })),
      idempotency_key: `${request.idempotencyKey}:payment`,
    },
  });

  const full = await apiRequest<any>(`/sales/${sale.id}`);
  return mapSale({ ...full, promotion: full.promotion ?? sale.promotion });
}
