import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId, mockLinePrice } from "./mock-db";
import type {
  Customer,
  Promotion,
  PromotionInput,
  PromotionPreview,
  Transaction,
} from "./types";

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function dateValue(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function normalizePromotion(promotion: any): Promotion {
  return {
    id: String(promotion.id),
    name: promotion.name ?? "",
    code: promotion.code ?? undefined,
    description: promotion.description ?? undefined,
    type: promotion.type === "fixed" ? "fixed" : "percentage",
    value: Number(promotion.value ?? 0),
    minSpend: promotion.min_spend != null ? Number(promotion.min_spend) : undefined,
    maxDiscount: promotion.max_discount != null ? Number(promotion.max_discount) : undefined,
    usageLimit: promotion.usage_limit != null ? Number(promotion.usage_limit) : undefined,
    usageCount: Number(promotion.usage_count ?? 0),
    perCustomerLimit: promotion.per_customer_limit != null ? Number(promotion.per_customer_limit) : undefined,
    startsAt: promotion.starts_at ?? undefined,
    endsAt: promotion.ends_at ?? undefined,
    active: promotion.is_active !== false,
    createdAt: promotion.created_at ?? undefined,
  };
}

function promotionBody(input: PromotionInput) {
  return {
    name: input.name,
    code: input.code ? input.code.toUpperCase() : null,
    description: input.description || null,
    type: input.type,
    value: input.value,
    min_spend: input.minSpend ?? null,
    max_discount: input.maxDiscount ?? null,
    usage_limit: input.usageLimit ?? null,
    per_customer_limit: input.perCustomerLimit ?? null,
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    is_active: input.active,
  };
}

export async function listPromotions(params?: { activeOnly?: boolean; search?: string }): Promise<Promotion[]> {
  if (USE_MOCK_API) {
    let data = [...mockDb.promotions];
    if (params?.activeOnly) data = data.filter((promotion) => mockPromotionLive(promotion));
    if (params?.search) {
      const query = params.search.toLowerCase();
      data = data.filter(
        (promotion) =>
          promotion.name.toLowerCase().includes(query) || (promotion.code ?? "").toLowerCase().includes(query)
      );
    }
    return data.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  }

  const query = new URLSearchParams();
  if (params?.activeOnly) query.set("active_only", "1");
  if (params?.search) query.set("q", params.search);
  const data = await apiRequest<any>(`/promotions${query.toString() ? `?${query.toString()}` : ""}`);
  return (Array.isArray(data) ? data : []).map(normalizePromotion);
}

export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  if (USE_MOCK_API) {
    const code = input.code ? input.code.trim().toUpperCase() : undefined;
    if (code && mockDb.promotions.some((promotion) => promotion.code === code)) {
      throw new Error("A promotion with this code already exists");
    }
    const promotion: Promotion = {
      id: mockId("pr"),
      name: input.name,
      code,
      description: input.description,
      type: input.type,
      value: input.value,
      minSpend: input.minSpend ?? undefined,
      maxDiscount: input.maxDiscount ?? undefined,
      usageLimit: input.usageLimit ?? undefined,
      usageCount: 0,
      perCustomerLimit: input.perCustomerLimit ?? undefined,
      startsAt: input.startsAt ?? undefined,
      endsAt: input.endsAt ?? undefined,
      active: input.active,
      createdAt: new Date().toISOString(),
    };
    mockDb.promotions = [promotion, ...mockDb.promotions];
    return promotion;
  }
  const data = await apiRequest<any>("/promotions", { method: "POST", body: promotionBody(input) });
  return normalizePromotion(data);
}

export async function updatePromotion(id: string, input: PromotionInput): Promise<Promotion> {
  if (USE_MOCK_API) {
    const index = mockDb.promotions.findIndex((promotion) => promotion.id === id);
    if (index < 0) throw new Error("Promotion not found");
    const code = input.code ? input.code.trim().toUpperCase() : undefined;
    if (code && mockDb.promotions.some((promotion) => promotion.code === code && promotion.id !== id)) {
      throw new Error("A promotion with this code already exists");
    }
    mockDb.promotions[index] = {
      ...mockDb.promotions[index],
      name: input.name,
      code,
      description: input.description,
      type: input.type,
      value: input.value,
      minSpend: input.minSpend ?? undefined,
      maxDiscount: input.maxDiscount ?? undefined,
      usageLimit: input.usageLimit ?? undefined,
      perCustomerLimit: input.perCustomerLimit ?? undefined,
      startsAt: input.startsAt ?? undefined,
      endsAt: input.endsAt ?? undefined,
      active: input.active,
    };
    return { ...mockDb.promotions[index] };
  }
  const data = await apiRequest<any>(`/promotions/${id}`, { method: "PUT", body: promotionBody(input) });
  return normalizePromotion(data);
}

export async function deletePromotion(id: string): Promise<void> {
  if (USE_MOCK_API) {
    if (mockDb.promotionRedemptions.some((redemption) => redemption.promotionId === id)) {
      throw new Error("This promotion has been redeemed and cannot be deleted. Deactivate it instead.");
    }
    mockDb.promotions = mockDb.promotions.filter((promotion) => promotion.id !== id);
    return;
  }
  await apiRequest<void>(`/promotions/${id}`, { method: "DELETE" });
}

export type PromotionQuoteInput = {
  outletId?: string;
  promotionCode?: string;
  customerId?: string;
  redeemPoints?: number;
  items: { productId: string; quantity: number; discount?: number; optionIds?: string[]; notes?: string }[];
};

/**
 * Prices a cart with a promotion and loyalty redemption without writing anything.
 * The POS uses it so the cashier sees the real discount before charging.
 */
export async function previewPromotion(input: PromotionQuoteInput): Promise<PromotionPreview> {
  if (USE_MOCK_API) {
    return mockQuoteCart(input);
  }
  const data = await apiRequest<any>("/promotions/preview", {
    method: "POST",
    body: {
      promotion_code: input.promotionCode?.trim() || null,
      customer_id: input.customerId ? Number(input.customerId) : null,
      redeem_points: input.redeemPoints ?? 0,
      items: input.items.map((item) => ({
        product_id: Number(item.productId),
        quantity: item.quantity,
        discount_amount: item.discount ?? 0,
        option_ids: item.optionIds?.map(Number) ?? [],
        notes: item.notes,
      })),
    },
  });

  return {
    subtotal: Number(data.subtotal ?? 0),
    discount: Number(data.discount_amount ?? 0),
    promotionDiscount: Number(data.promotion_discount ?? 0),
    promotionName: data.promotion?.name ?? undefined,
    promotionCode: data.promotion?.code ?? undefined,
    loyaltyDiscount: Number(data.loyalty_discount ?? 0),
    loyaltyPointsRedeemed: Number(data.loyalty_points_redeemed ?? 0),
    tax: Number(data.tax_amount ?? 0),
    total: Number(data.total ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/* Mock pricing, shared with the mock sale/order checkout paths.      */
/* ------------------------------------------------------------------ */

export function mockPromotionLive(promotion: Promotion, at = new Date()) {
  if (!promotion.active) return false;
  const now = at.getTime();
  if (promotion.startsAt && dateValue(promotion.startsAt) > now) return false;
  if (promotion.endsAt && dateValue(promotion.endsAt) < now) return false;
  return true;
}

function mockPromotionDiscount(promotion: Promotion, base: number, customerId?: string) {
  if (promotion.minSpend != null && base < promotion.minSpend) {
    throw new Error(`This promotion needs a minimum spend of ${promotion.minSpend}`);
  }
  if (promotion.usageLimit != null && promotion.usageCount >= promotion.usageLimit) {
    throw new Error("This promotion has reached its usage limit");
  }
  if (promotion.perCustomerLimit != null) {
    if (!customerId) throw new Error("Select a customer to use this promotion");
    const used = mockDb.promotionRedemptions.filter(
      (redemption) => redemption.promotionId === promotion.id && redemption.customerId === customerId
    ).length;
    if (used >= promotion.perCustomerLimit) throw new Error("This customer has already used this promotion");
  }
  if (base <= 0) return 0;

  let discount = promotion.type === "percentage" ? (base * promotion.value) / 100 : promotion.value;
  if (promotion.maxDiscount != null) discount = Math.min(discount, promotion.maxDiscount);
  discount = Math.min(discount, base);
  return discount > 0 ? money(discount) : 0;
}

function mockResolvePromotion(code: string | undefined, base: number, customerId?: string) {
  const normalized = code?.trim().toUpperCase();

  if (normalized) {
    const promotion = mockDb.promotions.find((entry) => entry.code === normalized && mockPromotionLive(entry));
    if (!promotion) throw new Error(`Promotion code "${normalized}" is not valid for this business`);
    return { promotion, discount: mockPromotionDiscount(promotion, base, customerId) };
  }

  let best: Promotion | null = null;
  let discount = 0;
  for (const promotion of mockDb.promotions.filter((entry) => !entry.code && mockPromotionLive(entry))) {
    try {
      const value = mockPromotionDiscount(promotion, base, customerId);
      if (value > discount) {
        best = promotion;
        discount = value;
      }
    } catch {
      /* Automatic promotions silently skip when the cart does not qualify. */
    }
  }
  return { promotion: best, discount };
}

function mockLoyaltyQuote(points: number, customerId: string | undefined, available: number) {
  if (!points || points <= 0) return { discount: 0, points: 0 };
  if (!customerId) throw new Error("Select a customer before redeeming points");

  const program = mockDb.loyaltyProgram;
  if (!program.isActive) throw new Error("This business does not run a loyalty programme");
  if (points < program.minRedeemPoints) throw new Error(`Redeem at least ${program.minRedeemPoints} points`);

  const customer = mockDb.customers.find((entry) => entry.id === customerId);
  if (!customer) throw new Error("Customer not found");
  if (points > customer.loyaltyPoints) {
    throw new Error(`The customer only has ${customer.loyaltyPoints} points`);
  }

  const discount = money(points * program.redeemValue);
  if (discount > available) throw new Error("Those points are worth more than the order total");

  return { discount, points };
}

export function mockQuoteCart(input: PromotionQuoteInput): PromotionPreview {
  const items = input.items.map((item) => {
    const product = mockDb.products.find((entry) => entry.id === item.productId);
    if (!product) throw new Error("Product not found");
    const unitPrice = mockLinePrice(item.productId, item.optionIds ?? []);
    const lineTotal = unitPrice * item.quantity - (item.discount ?? 0);
    return { unitPrice, quantity: item.quantity, discount: item.discount ?? 0, lineTotal };
  });

  const subtotal = money(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const manualDiscount = money(items.reduce((sum, item) => sum + item.discount, 0));
  const base = Math.max(0, subtotal - manualDiscount);

  const { promotion, discount: promotionDiscount } = mockResolvePromotion(
    input.promotionCode,
    subtotal,
    input.customerId
  );
  const loyalty = mockLoyaltyQuote(input.redeemPoints ?? 0, input.customerId, base - promotionDiscount);

  const taxable = Math.max(0, base - promotionDiscount - loyalty.discount);
  const taxRate = mockDb.taxRates.find((rate) => rate.isDefault && rate.isActive);
  const rate = taxRate?.rate ?? 0;
  const inclusive = taxRate?.type === "inclusive";
  const tax = inclusive ? Math.round(taxable - taxable / (1 + rate / 100)) : Math.round(taxable * (rate / 100));
  const total = money(inclusive ? taxable : taxable + tax);

  return {
    subtotal,
    discount: manualDiscount,
    promotionDiscount,
    promotionName: promotion?.name,
    promotionCode: promotion?.code,
    loyaltyDiscount: loyalty.discount,
    loyaltyPointsRedeemed: loyalty.points,
    tax,
    total,
  };
}

/**
 * Applies the quote to a completed mock sale: records the redemption, spends
 * and earns points, and moves the customer's spend counters.
 */
export function mockFinalizeDiscounts(
  transaction: Transaction,
  quote: PromotionPreview,
  customerId?: string
): number {
  if (quote.promotionCode || quote.promotionDiscount > 0) {
    const promotion = mockDb.promotions.find(
      (entry) =>
        (quote.promotionCode && entry.code === quote.promotionCode) ||
        (!quote.promotionCode && quote.promotionName && entry.name === quote.promotionName)
    );
    if (promotion) {
      promotion.usageCount += 1;
      mockDb.promotionRedemptions.unshift({
        id: mockId("prd"),
        promotionId: promotion.id,
        saleId: transaction.id,
        customerId,
        amount: quote.promotionDiscount,
      });
    }
  }

  const program = mockDb.loyaltyProgram;
  if (!customerId) return 0;

  const customer = mockDb.customers.find((entry) => entry.id === customerId);
  if (!customer) return 0;

  if (quote.loyaltyPointsRedeemed > 0) {
    customer.loyaltyPoints = money(customer.loyaltyPoints - quote.loyaltyPointsRedeemed);
    mockDb.loyaltyTransactions.unshift({
      id: mockId("lt"),
      customerId,
      saleId: transaction.id,
      type: "redeem",
      points: -quote.loyaltyPointsRedeemed,
      balanceAfter: customer.loyaltyPoints,
      reason: `Redeemed on ${transaction.receiptNumber}`,
      createdAt: new Date().toISOString(),
    });
  }

  let earned = 0;
  if (program.isActive) {
    earned = Math.floor(transaction.total * program.pointsPerAmount * 10000) / 10000;
    if (earned > 0) {
      customer.loyaltyPoints = money(customer.loyaltyPoints + earned);
      customer.loyaltyJoinedAt = customer.loyaltyJoinedAt ?? new Date().toISOString();
      mockDb.loyaltyTransactions.unshift({
        id: mockId("lt"),
        customerId,
        saleId: transaction.id,
        type: "earn",
        points: earned,
        balanceAfter: customer.loyaltyPoints,
        reason: `Earned on ${transaction.receiptNumber}`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  customer.totalSpent = money((customer.totalSpent ?? 0) + transaction.total);
  customer.visitsCount = (customer.visitsCount ?? 0) + 1;
  customer.lastVisitAt = new Date().toISOString();

  return earned;
}

/** Undoes a promotion redemption and the points a voided mock sale moved. */
export function mockReverseDiscounts(transaction: Transaction) {
  const redemption = mockDb.promotionRedemptions.find((entry) => entry.saleId === transaction.id);
  if (redemption) {
    const promotion = mockDb.promotions.find((entry) => entry.id === redemption.promotionId);
    if (promotion && promotion.usageCount > 0) promotion.usageCount -= 1;
    mockDb.promotionRedemptions = mockDb.promotionRedemptions.filter((entry) => entry.saleId !== transaction.id);
  }

  const customer = mockDb.customers.find((entry) => entry.id === transaction.customerId);
  if (!customer) return;

  const earned = transaction.loyaltyPointsEarned ?? 0;
  const redeemed = transaction.loyaltyPointsRedeemed ?? 0;

  if (earned > 0) {
    const deduct = Math.min(earned, customer.loyaltyPoints);
    customer.loyaltyPoints = money(customer.loyaltyPoints - deduct);
    mockDb.loyaltyTransactions.unshift({
      id: mockId("lt"),
      customerId: customer.id,
      saleId: transaction.id,
      type: "reverse",
      points: -deduct,
      balanceAfter: customer.loyaltyPoints,
      reason: "Voided sale",
      createdAt: new Date().toISOString(),
    });
  }

  if (redeemed > 0) {
    customer.loyaltyPoints = money(customer.loyaltyPoints + redeemed);
    mockDb.loyaltyTransactions.unshift({
      id: mockId("lt"),
      customerId: customer.id,
      saleId: transaction.id,
      type: "reverse",
      points: redeemed,
      balanceAfter: customer.loyaltyPoints,
      reason: "Redeemed points returned on void",
      createdAt: new Date().toISOString(),
    });
  }

  customer.totalSpent = money(Math.max(0, (customer.totalSpent ?? 0) - transaction.total));
  customer.visitsCount = Math.max(0, (customer.visitsCount ?? 0) - 1);
}

export function mockCustomer(id?: string): Customer | undefined {
  return id ? mockDb.customers.find((entry) => entry.id === id) : undefined;
}
