import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type {
  Paginated,
  Payment,
  PaymentInput,
  PaymentMethod,
  Refund,
  RefundItem,
  RefundStatus,
} from "./types";

export type PaymentMethodInput = {
  name: string;
  code?: string;
  type?: string;
  requiresReference?: boolean;
  isActive?: boolean;
  sortOrder?: number;
};

export type RefundListParams = {
  status?: RefundStatus | "";
  saleId?: string;
  paymentId?: string;
  page?: number;
  pageSize?: number;
};

export const PAYMENT_METHOD_TYPES = [
  "cash",
  "qris",
  "debit_card",
  "credit_card",
  "ewallet",
  "transfer",
  "other",
] as const;

export function normalizePaymentMethod(raw: any): PaymentMethod {
  return {
    id: String(raw.id),
    code: raw.code ?? String(raw.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    name: raw.name ?? "Payment method",
    type: raw.type ?? "other",
    requiresReference: Boolean(raw.requires_reference ?? raw.requiresReference ?? false),
    active: Boolean(raw.is_active ?? raw.active ?? true),
    sortOrder: Number(raw.sort_order ?? raw.sortOrder ?? 0),
    settings: raw.settings ?? undefined,
  };
}

export function normalizeRefund(raw: any): Refund {
  const sale = raw.sale
    ? {
        id: String(raw.sale.id),
        receiptNumber: raw.sale.receipt_number ?? raw.sale.receiptNumber ?? "",
        orderNumber: raw.sale.order_number ?? undefined,
        total: Number(raw.sale.total ?? 0),
        status: raw.sale.status ?? "",
      }
    : undefined;
  const payment = raw.payment
    ? {
        id: String(raw.payment.id),
        method: raw.payment.method ?? "",
        amount: Number(raw.payment.amount ?? 0),
        status: raw.payment.status ?? "",
      }
    : undefined;

  return {
    id: String(raw.id),
    saleId: String(raw.sale_id ?? raw.saleId ?? sale?.id ?? ""),
    paymentId: raw.payment_id ?? raw.paymentId ? String(raw.payment_id ?? raw.paymentId) : undefined,
    amount: Number(raw.amount ?? 0),
    reason: raw.reason ?? undefined,
    status: (raw.status ?? "pending") as RefundStatus,
    items: (raw.items ?? []).map((item: any) => ({
      id: String(item.id),
      saleItemId: String(item.sale_item_id ?? item.saleItemId ?? ""),
      quantity: Number(item.quantity ?? 0),
      reason: item.reason ?? undefined,
      productName: item.sale_item?.product_name ?? item.saleItem?.productName ?? undefined,
      sku: item.sale_item?.sku ?? item.saleItem?.sku ?? undefined,
    })),
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
    approvedAt: raw.approved_at ?? raw.approvedAt ?? undefined,
    completedAt: raw.completed_at ?? raw.completedAt ?? undefined,
    sale,
    payment,
  };
}

function sortMethods(methods: PaymentMethod[]) {
  return methods
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}

/**
 * Make a payment batch sum to the authoritative sale total.
 *
 * The register prices the cart before checkout, but the API is the source of
 * truth: tax is rounded per line server-side, so a displayed total can differ
 * by a fraction of a rupiah. The cash line (or the largest line) absorbs the
 * difference instead of the sale failing on a one-cent mismatch.
 */
export function fitPaymentsToTotal(total: number, lines: PaymentInput[]): PaymentInput[] {
  const rows = lines
    .filter((line) => Number.isFinite(line.amount))
    .map((line) => ({ ...line, amount: round4(line.amount) }));
  if (rows.length === 0) return rows;

  const sum = round4(rows.reduce((acc, line) => acc + line.amount, 0));
  const delta = round4(total - sum);
  if (Math.abs(delta) < 0.0001) return rows;

  const cashIndex = rows.findIndex((line) => line.method === "cash");
  const largest = rows.reduce((best, line, index) => (line.amount > rows[best].amount ? index : best), 0);
  const largestNonCash = rows.reduce(
    (best, line, index) => (line.method !== "cash" && (best < 0 || line.amount > rows[best].amount) ? index : best),
    -1
  );

  if (delta > 0) {
    // Underpaid: raise the cash tender (or the largest line) to cover it.
    const index = cashIndex >= 0 ? cashIndex : largest;
    rows[index] = { ...rows[index], amount: round4(rows[index].amount + delta) };
    return rows;
  }

  // Overpaid: shrink a non-cash line so the cash tender stays as entered.
  if (largestNonCash >= 0) {
    const adjusted = round4(rows[largestNonCash].amount + delta);
    if (adjusted > 0) {
      rows[largestNonCash] = { ...rows[largestNonCash], amount: adjusted };
      return rows;
    }
  }

  // A cash payment can legitimately overpay: the server returns the change.
  if (cashIndex >= 0) return rows;

  // No cash and the overpayment cannot be absorbed: scale to the real total.
  const scaled = rows.map((line) => ({ ...line, amount: round4((line.amount / sum) * total) }));
  const residual = round4(total - scaled.reduce((acc, line) => acc + line.amount, 0));
  if (Math.abs(residual) >= 0.0001) {
    scaled[0] = { ...scaled[0], amount: round4(scaled[0].amount + residual) };
  }
  return scaled;
}

/** Build the batch sent to the API, falling back to one line for the total. */
export function buildPaymentBatch(
  total: number,
  lines: PaymentInput[] | undefined,
  fallbackMethod = "cash"
): PaymentInput[] {
  const source = (lines ?? []).filter((line) => line.method && line.amount > 0);
  if (source.length === 0) {
    return [{ method: fallbackMethod, amount: round4(total) }];
  }
  return fitPaymentsToTotal(total, source);
}

/**
 * Mock equivalent of PaymentService::recordPayments(). Applies the same rules:
 * the batch must cover the total and change only comes back from cash.
 */
export function mockRecordPayments(
  total: number,
  lines: PaymentInput[]
): { payments: Payment[]; paid: number; change: number } {
  const batch = fitPaymentsToTotal(total, lines);
  if (batch.length === 0) throw new Error("Add at least one payment");

  const paid = round4(batch.reduce((acc, line) => acc + line.amount, 0));
  if (paid + 0.0001 < total) throw new Error("Payment does not cover the total");

  const change = round4(Math.max(0, paid - total));
  if (change > 0) {
    const cash = round4(
      batch
        .filter((line) => {
          const method = mockDb.paymentMethods.find((entry) => entry.code === line.method);
          return line.method === "cash" || method?.type === "cash";
        })
        .reduce((acc, line) => acc + line.amount, 0)
    );
    if (cash <= 0) throw new Error("Overpayment needs a cash payment method");
    if (change > cash + 0.0001) throw new Error("Change cannot exceed the cash tendered");
  }

  const now = new Date().toISOString();
  const payments = batch.map<Payment>((line) => ({
    id: mockId("pay"),
    method: line.method,
    amount: round4(line.amount),
    status: "completed",
    reference: line.reference,
    createdAt: now,
  }));

  return { payments, paid, change };
}

export async function listPaymentMethods(params?: { active?: boolean }): Promise<PaymentMethod[]> {
  if (USE_MOCK_API) {
    const methods = params?.active
      ? mockDb.paymentMethods.filter((method) => method.active)
      : mockDb.paymentMethods;
    return sortMethods(methods.map((method) => ({ ...method })));
  }

  const data = await apiRequest<any>(`/payment-methods${params?.active ? "?active=1" : ""}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map(normalizePaymentMethod);
}

export async function createPaymentMethod(input: PaymentMethodInput): Promise<PaymentMethod> {
  if (USE_MOCK_API) {
    const code = (input.code?.trim() || input.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32);
    if (!code) throw new Error("Give the payment method a code");
    if (mockDb.paymentMethods.some((method) => method.code === code)) {
      throw new Error("A payment method with this code already exists");
    }
    const method: PaymentMethod = {
      id: mockId("pm"),
      code,
      name: input.name.trim(),
      type: input.type ?? "other",
      requiresReference: input.requiresReference ?? false,
      active: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    };
    mockDb.paymentMethods = [...mockDb.paymentMethods, method];
    return { ...method };
  }

  const data = await apiRequest<any>("/payment-methods", {
    method: "POST",
    body: {
      name: input.name,
      code: input.code,
      type: input.type,
      requires_reference: input.requiresReference,
      is_active: input.isActive,
      sort_order: input.sortOrder,
    },
  });
  return normalizePaymentMethod(data);
}

export async function updatePaymentMethod(
  id: string,
  input: Partial<PaymentMethodInput>
): Promise<PaymentMethod> {
  if (USE_MOCK_API) {
    const method = mockDb.paymentMethods.find((entry) => entry.id === id);
    if (!method) throw new Error("Payment method not found");
    Object.assign(method, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.requiresReference !== undefined ? { requiresReference: input.requiresReference } : {}),
      ...(input.isActive !== undefined ? { active: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    });
    return { ...method };
  }

  const data = await apiRequest<any>(`/payment-methods/${id}`, {
    method: "PUT",
    body: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.requiresReference !== undefined
        ? { requires_reference: input.requiresReference }
        : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
    },
  });
  return normalizePaymentMethod(data);
}

export async function deletePaymentMethod(id: string): Promise<void> {
  if (USE_MOCK_API) {
    const method = mockDb.paymentMethods.find((entry) => entry.id === id);
    if (!method) throw new Error("Payment method not found");
    const used = [...mockDb.transactions, ...mockDb.orders].some((sale) =>
      sale.payments.some(
        (payment) => payment.method === method.code || payment.method === method.name
      )
    );
    if (used) {
      throw new Error("This payment method has payments and cannot be deleted. Deactivate it instead.");
    }
    mockDb.paymentMethods = mockDb.paymentMethods.filter((entry) => entry.id !== id);
    return;
  }

  await apiRequest<void>(`/payment-methods/${id}`, { method: "DELETE" });
}

function mockFindPayment(paymentId: string) {
  for (const sale of [...mockDb.transactions, ...mockDb.orders]) {
    const payment = sale.payments.find((entry) => entry.id === paymentId);
    if (payment) return { sale, payment };
  }
  return null;
}

function mockRefundedAmount(paymentId: string) {
  return mockDb.refunds
    .filter(
      (refund) =>
        refund.paymentId === paymentId &&
        ["pending", "approved", "completed"].includes(refund.status)
    )
    .reduce((sum, refund) => sum + refund.amount, 0);
}

export async function listRefunds(params?: RefundListParams): Promise<Paginated<Refund>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 50;

  if (USE_MOCK_API) {
    let refunds = [...mockDb.refunds];
    if (params?.status) refunds = refunds.filter((refund) => refund.status === params.status);
    if (params?.saleId) refunds = refunds.filter((refund) => refund.saleId === params.saleId);
    if (params?.paymentId) refunds = refunds.filter((refund) => refund.paymentId === params.paymentId);
    refunds.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const start = (page - 1) * pageSize;
    return {
      data: refunds.slice(start, start + pageSize).map((refund) => ({ ...refund })),
      page,
      pageSize,
      total: refunds.length,
      totalPages: Math.max(1, Math.ceil(refunds.length / pageSize)),
    };
  }

  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.saleId) query.set("sale_id", params.saleId);
  if (params?.paymentId) query.set("payment_id", params.paymentId);
  query.set("page", String(page));
  query.set("per_page", String(pageSize));

  const data = await apiRequest<any>(`/refunds?${query.toString()}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    data: items.map(normalizeRefund),
    page: Number(data?.current_page ?? page),
    pageSize: Number(data?.per_page ?? pageSize),
    total: Number(data?.total ?? items.length),
    totalPages: Number(data?.last_page ?? 1),
  };
}

export type RefundRequest = {
  /** Omit when `items` are given: the API prices the returned lines. */
  amount?: number;
  reason?: string;
  items?: { saleItemId: string; quantity: number; reason?: string }[];
};

export async function requestRefund(paymentId: string, input: RefundRequest): Promise<Refund> {
  if (USE_MOCK_API) {
    const found = mockFindPayment(paymentId);
    if (!found) throw new Error("Payment not found");

    const lines: RefundItem[] = (input.items ?? []).map((line) => {
      const item = found.sale.items.find((entry) => entry.saleItemId === line.saleItemId);
      if (!item) throw new Error("That item is not on this sale.");

      // Pending refunds already reserve their quantities.
      const returned = mockDb.refunds
        .filter((refund) => ["pending", "approved", "completed"].includes(refund.status))
        .flatMap((refund) => refund.items ?? [])
        .filter((refundItem) => refundItem.saleItemId === line.saleItemId)
        .reduce((sum, refundItem) => sum + refundItem.quantity, 0);

      if (returned + line.quantity > item.quantity + 0.0001) {
        throw new Error(`Refunding more of ${item.name} than was sold`);
      }

      return {
        id: mockId("rfi"),
        saleItemId: line.saleItemId,
        quantity: line.quantity,
        reason: line.reason,
        productName: item.name,
        sku: item.sku,
      };
    });

    const priced = lines.reduce((sum, line) => {
      const item = found.sale.items.find((entry) => entry.saleItemId === line.saleItemId)!;
      return sum + (item.lineTotal * line.quantity) / item.quantity;
    }, 0);
    const amount = round4(input.amount ?? priced);

    const refundable = found.payment.amount - mockRefundedAmount(paymentId);
    if (amount <= 0) throw new Error("Enter a refund amount greater than zero.");
    if (amount > refundable + 0.0001) throw new Error("Refund exceeds the refundable amount");

    const refund: Refund = {
      id: mockId("rf"),
      saleId: found.sale.id,
      paymentId,
      amount,
      reason: input.reason,
      status: "pending",
      items: lines,
      createdAt: new Date().toISOString(),
      sale: {
        id: found.sale.id,
        receiptNumber: found.sale.receiptNumber,
        orderNumber: found.sale.orderNumber,
        total: found.sale.total,
        status: found.sale.status,
      },
      payment: {
        id: found.payment.id,
        method: found.payment.method,
        amount: found.payment.amount,
        status: found.payment.status,
      },
    };
    mockDb.refunds = [refund, ...mockDb.refunds];
    return { ...refund };
  }

  const data = await apiRequest<any>(`/payments/${paymentId}/refund`, {
    method: "POST",
    body: {
      amount: input.amount,
      reason: input.reason,
      items: input.items?.length
        ? input.items.map((line) => ({
            sale_item_id: line.saleItemId,
            quantity: line.quantity,
            reason: line.reason,
          }))
        : undefined,
    },
  });
  return normalizeRefund(data);
}

function mockApplyRefund(refund: Refund, status: RefundStatus) {
  refund.status = status;
  if (status === "completed") {
    refund.approvedAt = refund.approvedAt ?? new Date().toISOString();
    refund.completedAt = refund.completedAt ?? new Date().toISOString();
  }

  if (status !== "completed" || !refund.paymentId) return;

  const found = mockFindPayment(refund.paymentId);
  if (!found) return;

  const totalRefunded = mockDb.refunds
    .filter(
      (entry) =>
        entry.paymentId === refund.paymentId &&
        (entry.status === "approved" || entry.status === "completed")
    )
    .reduce((sum, entry) => sum + entry.amount, 0);

  found.payment.status = totalRefunded >= found.payment.amount ? "refunded" : "partially_refunded";
  const saleRefunded = mockDb.refunds
    .filter(
      (entry) =>
        entry.saleId === found.sale.id &&
        (entry.status === "approved" || entry.status === "completed")
    )
    .reduce((sum, entry) => sum + entry.amount, 0);

  found.sale.paymentStatus = saleRefunded >= found.sale.total ? "refunded" : "partially_refunded";
  if (saleRefunded >= found.sale.total) found.sale.status = "refunded";
}

export async function approveRefund(id: string): Promise<Refund> {
  if (USE_MOCK_API) {
    const refund = mockDb.refunds.find((entry) => entry.id === id);
    if (!refund) throw new Error("Refund not found");
    if (refund.status !== "pending") throw new Error("This refund is not pending");
    mockApplyRefund(refund, "completed");
    return { ...refund };
  }

  const data = await apiRequest<any>(`/refunds/${id}/approve`, { method: "POST" });
  return normalizeRefund(data);
}

export async function rejectRefund(id: string): Promise<Refund> {
  if (USE_MOCK_API) {
    const refund = mockDb.refunds.find((entry) => entry.id === id);
    if (!refund) throw new Error("Refund not found");
    if (refund.status !== "pending") throw new Error("This refund is not pending");
    refund.status = "rejected";
    return { ...refund };
  }

  const data = await apiRequest<any>(`/refunds/${id}/reject`, { method: "POST" });
  return normalizeRefund(data);
}
