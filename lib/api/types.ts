export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
};

export type Business = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  address?: string;
};

export type Outlet = {
  id: string;
  businessId: string;
  name: string;
  address?: string;
  code?: string;
  phone?: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  categoryId: string;
  categoryName: string;
  price: number;
  cost: number;
  taxRate: number;
  stockByOutlet: Record<string, number>;
  active: boolean;
  trackInventory?: boolean;
  unit?: string;
  imageUrl?: string;
  variants?: { id: string; name: string; price: number; sku: string }[];
};

export type Category = { id: string; name: string; productCount: number };

export type ModifierOption = {
  id: string;
  groupId: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  available: boolean;
  unavailableReason?: string;
  productId?: string;
  productVariantId?: string;
};

export type ModifierGroup = {
  id: string;
  name: string;
  kind: "modifier" | "combo";
  selectionType: "single" | "multiple";
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  sortOrder: number;
  options: ModifierOption[];
};

export type MenuProduct = Product & {
  available: boolean;
  unavailableReason?: string;
  isCombo?: boolean;
  daypartIds: string[];
  modifierGroups: ModifierGroup[];
};

export type MenuResponse = {
  outlet: { id: string; name: string };
  generatedAt: string;
  products: MenuProduct[];
};

export type Daypart = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: number[];
  isActive: boolean;
  productCount: number;
};

export type Ingredient = {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  costPerUnit: number;
  reorderLevel: number;
  trackInventory: boolean;
  active: boolean;
  quantity: number;
  stockValue: number;
  lowStock: boolean;
};

export type IngredientMovement = {
  id: string;
  ingredientId: string;
  ingredientName?: string;
  outletId: string;
  type: "adjustment" | "purchase" | "consumption" | "void" | "wastage" | "expired" | string;
  quantity: number;
  unitCost?: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  actorName?: string;
  createdAt: string;
};

export type RecipeLine = {
  id?: string;
  productVariantId?: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  unitCost: number;
  quantity: number;
  wastePercent: number;
  effectiveQuantity: number;
  lineCost: number;
  notes?: string;
};

export type RecipeProduct = Product & {
  recipeItems: RecipeLine[];
  recipeCost: number;
  variantCosts: Record<string, number>;
};

export type RecipeItemInput = {
  ingredientId: string;
  quantity: number;
  wastePercent?: number;
  notes?: string;
};

export type CartItem = {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  lineTotal: number;
};

export type CheckoutRequest = {
  outletId: string;
  cashierId: string;
  customerId?: string;
  items: { productId: string; variantId?: string; quantity: number; discount?: number; optionIds?: string[]; notes?: string }[];
  cartDiscount?: number;
  notes?: string;
  idempotencyKey: string;
  promotionCode?: string;
  redeemPoints?: number;
};

export type Payment = {
  id: string;
  method: string;
  amount: number;
  status: string;
  reference?: string;
  createdAt: string;
};

export type PaymentInput = {
  method: string;
  amount: number;
  reference?: string;
};

export type RefundStatus = "pending" | "approved" | "rejected" | "completed";

export type Refund = {
  id: string;
  saleId: string;
  paymentId?: string;
  amount: number;
  reason?: string;
  status: RefundStatus;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
  sale?: {
    id: string;
    receiptNumber: string;
    orderNumber?: string;
    total: number;
    status: string;
  };
  payment?: {
    id: string;
    method: string;
    amount: number;
    status: string;
  };
};

export type OrderType = "dine_in" | "takeaway" | "delivery" | "pickup";

export type OrderStatus = "open" | "in_kitchen" | "ready" | "served" | "completed" | "cancelled";

export type OrderFulfilment = {
  contactName?: string;
  contactPhone?: string;
  address?: string;
  scheduledAt?: string;
  instructions?: string;
};

export type OrderItemInput = {
  productId: string;
  variantId?: string;
  quantity: number;
  discount?: number;
  optionIds?: string[];
  notes?: string;
};

export type CreateOrderRequest = {
  outletId: string;
  orderType: OrderType;
  customerId?: string;
  tableId?: string;
  notes?: string;
  fulfilment?: OrderFulfilment;
  items: OrderItemInput[];
  idempotencyKey?: string;
  promotionCode?: string;
  redeemPoints?: number;
};

export type UpdateOrderRequest = {
  orderType?: OrderType;
  customerId?: string | null;
  tableId?: string | null;
  notes?: string;
  fulfilment?: OrderFulfilment | null;
  items?: OrderItemInput[];
  promotionCode?: string | null;
  redeemPoints?: number | null;
};

export type TableStatus = "available" | "reserved" | "cleaning" | "occupied";

export type TableShape = "round" | "square" | "rect";

export type FloorArea = {
  id: string;
  outletId: string;
  name: string;
  sortOrder: number;
};

export type DiningTable = {
  id: string;
  outletId: string;
  outletName?: string;
  name: string;
  seats: number;
  shape: TableShape;
  positionX: number;
  positionY: number;
  status: TableStatus;
  manualStatus: Exclude<TableStatus, "occupied">;
  occupied: boolean;
  isActive: boolean;
  notes?: string;
  area?: { id: string; name: string } | null;
  activeOrder?: {
    id: string;
    orderNumber?: string;
    orderStatus: OrderStatus;
    total: number;
    itemsCount: number;
    createdAt: string;
  } | null;
};

export type FloorPlan = {
  areas: FloorArea[];
  tables: DiningTable[];
};

export type KitchenStationKind = "kitchen" | "bar" | "pastry" | "cold" | "expediter";

export type KitchenStation = {
  id: string;
  outletId: string;
  name: string;
  code: string;
  kind: KitchenStationKind;
  printerName?: string;
  printerTarget?: string;
  copies: number;
  autoPrint: boolean;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  categories: { id: string; name: string }[];
};

export type KitchenTicketStatus = "queued" | "preparing" | "ready" | "served" | "voided";

export type KitchenTicketItem = {
  saleItemId?: string;
  productId?: string;
  name: string;
  quantity: string;
  notes?: string;
  modifiers: string[];
};

export type KitchenTicket = {
  id: string;
  ticketNumber: string;
  status: KitchenTicketStatus;
  note?: string;
  items: KitchenTicketItem[];
  printedAt?: string;
  printCount: number;
  startedAt?: string;
  readyAt?: string;
  servedAt?: string;
  createdAt: string;
  text?: string;
  station: {
    id: string;
    name: string;
    code: string;
    kind: KitchenStationKind;
    printerName?: string;
    printerTarget?: string;
    copies: number;
    autoPrint: boolean;
  };
  sale: {
    id: string;
    orderNumber?: string;
    orderType?: OrderType;
    orderStatus?: OrderStatus;
    table?: string;
    notes?: string;
  };
};

export type KitchenBoard = {
  tickets: KitchenTicket[];
  counts: Record<KitchenTicketStatus, number>;
};

export type Transaction = {
  id: string;
  receiptNumber: string;
  outletId: string;
  outletName: string;
  cashierId: string;
  cashierName: string;
  customerId?: string;
  customerName?: string;
  items: {
    productId?: string;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
    optionIds?: string[];
    notes?: string;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount?: number;
  changeAmount?: number;
  paymentStatus: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  status: "completed" | "voided" | "refunded";
  payments: Payment[];
  refunds?: Refund[];
  notes?: string;
  createdAt: string;
  orderNumber?: string;
  orderType?: OrderType;
  orderStatus?: OrderStatus;
  tableId?: string;
  tableName?: string;
  fulfilment?: OrderFulfilment;
  firedAt?: string;
  readyAt?: string;
  servedAt?: string;
  promotionCode?: string;
  promotionName?: string;
  promotionDiscount?: number;
  loyaltyDiscount?: number;
  loyaltyPointsRedeemed?: number;
  loyaltyPointsEarned?: number;
  channelId?: string;
  channelName?: string;
  channelOrderRef?: string;
  channelStatus?: ChannelOrderStatus;
  channelCommission?: number;
  channelCommissionPercent?: number;
};

export type PaymentMethod = {
  id: string;
  code: string;
  name: string;
  type: string;
  requiresReference: boolean;
  active: boolean;
  sortOrder: number;
  settings?: Record<string, unknown>;
};

export type InventoryMovement = {
  id: string;
  productId: string;
  productName: string;
  outletId: string;
  type: "adjustment" | "transfer" | "transfer_out" | "transfer_in" | "receive" | "sale" | "return" | "void" | "damaged" | "missing" | "expired" | "write_off";
  quantity: number;
  reason: string;
  balanceAfter?: number;
  createdAt: string;
  createdBy: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  loyaltyNumber?: string;
  loyaltyPoints: number;
  totalSpent?: number;
  visitsCount?: number;
  lastVisitAt?: string;
  loyaltyJoinedAt?: string;
  notes?: string;
  createdAt: string;
};

export type PromotionType = "percentage" | "fixed";

export type Promotion = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  type: PromotionType;
  value: number;
  minSpend?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageCount: number;
  perCustomerLimit?: number;
  startsAt?: string;
  endsAt?: string;
  active: boolean;
  createdAt?: string;
};

export type PromotionInput = {
  name: string;
  code?: string | null;
  description?: string;
  type: PromotionType;
  value: number;
  minSpend?: number | null;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  active: boolean;
};

export type PromotionPreview = {
  subtotal: number;
  discount: number;
  promotionDiscount: number;
  promotionName?: string;
  promotionCode?: string;
  loyaltyDiscount: number;
  loyaltyPointsRedeemed: number;
  tax: number;
  total: number;
};

export type LoyaltyProgram = {
  isActive: boolean;
  pointsPerAmount: number;
  redeemValue: number;
  minRedeemPoints: number;
};

export type LoyaltyTransaction = {
  id: string;
  customerId: string;
  saleId?: string;
  type: "earn" | "redeem" | "adjust" | "reverse";
  points: number;
  balanceAfter: number;
  reason?: string;
  createdAt: string;
};

export type CustomerProfile = Customer & {
  sales: Transaction[];
  loyaltyTransactions: LoyaltyTransaction[];
  promotionsUsed: number;
};

export type Supplier = {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address?: string;
};

export type PurchaseOrderItem = {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  receivedQuantity?: number;
  cost: number;
};

export type PurchaseOrder = {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  outletId: string;
  outletName?: string;
  status: "draft" | "approved" | "received" | "partial" | "cancelled";
  items: PurchaseOrderItem[];
  total: number;
  expectedAt?: string;
  createdAt: string;
  approvedAt?: string;
  receivedAt?: string;
};

export type Employee = {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: string;
  roleId?: string;
  roleSlug?: string;
  outlets: string[];
  active: boolean;
  status?: string;
  joinedAt?: string;
};

export type Role = { id: string; slug?: string; name: string; permissions: string[]; description?: string };

export type TaxRate = {
  id: string;
  name: string;
  rate: number;
  type: "inclusive" | "exclusive";
  isDefault: boolean;
  isActive: boolean;
};

export type MetricSet = {
  grossSales: number;
  netSales: number;
  transactions: number;
  avgTransaction: number;
  refunds: number;
  discounts: number;
  tax: number;
  itemsSold: number;
};

export type TrendPoint = {
  date: string;
  label: string;
  fullLabel: string;
  value: number;
  orders: number;
};

export type DashboardMetrics = {
  period: { key: string; from: string; to: string; label: string; comparisonLabel: string };
  current: MetricSet;
  previous: MetricSet | null;
  changes: {
    netSales: number | null;
    transactions: number | null;
    avgTransaction: number | null;
    itemsSold: number | null;
  };
  trend: TrendPoint[];
  previousTrend: { date: string; value: number }[];
  daily: DailySalesRow[];
  trendComplete: boolean;
  refundsComplete: boolean;
  topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
  salesByPayment: { method: string; amount: number; count: number }[];
  salesByCategory: { name: string; revenue: number; quantity: number }[];
  lowStock: { productId: string; name: string; outlet: string; stock: number; threshold: number }[];
  recentTransactions: Transaction[];
  lowStockThreshold: number;
};

export type DailySalesRow = {
  date: string;
  label: string;
  orders: number;
  grossSales: number;
  discounts: number;
  tax: number;
  netSales: number;
  itemsSold: number;
};

export type Paginated<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ChannelKind = "own_web" | "marketplace" | "whatsapp" | "phone" | "custom";

export type ChannelOrderStatus =
  | "received"
  | "accepted"
  | "ready"
  | "dispatched"
  | "completed"
  | "rejected"
  | "cancelled";

export type SalesChannel = {
  id: string;
  name: string;
  code: string;
  kind: ChannelKind;
  outletId?: string;
  commissionPercent: number;
  paymentMethodCode?: string;
  autoAccept: boolean;
  prepBufferMinutes: number;
  active: boolean;
  webhookUrl?: string;
  webhookToken?: string;
  hasCredentials: boolean;
  mappingsCount?: number;
  salesCount?: number;
  lastOrderAt?: string;
  settings?: Record<string, unknown>;
};

export type SalesChannelInput = {
  name: string;
  code?: string;
  kind: ChannelKind;
  outletId?: string | null;
  commissionPercent: number;
  paymentMethodCode?: string | null;
  autoAccept: boolean;
  prepBufferMinutes: number;
  active: boolean;
};

export type ChannelCredentials = { webhookUrl?: string; secret: string };

export type ChannelMapping = {
  id: string;
  externalItemId: string;
  externalVariantId?: string;
  productId: string;
  productVariantId?: string;
  productName?: string;
  variantName?: string;
  optionMap: Record<string, string>;
  active: boolean;
};

export type ChannelEventType =
  | "order.accepted"
  | "order.rejected"
  | "order.ready"
  | "order.dispatched"
  | "order.completed"
  | "order.cancelled"
  | "menu.pushed";

export type ChannelEvent = {
  id: string;
  type: ChannelEventType;
  status: "pending" | "sent" | "failed";
  saleId?: string;
  attempts: number;
  lastError?: string;
  sentAt?: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type ChannelSummaryRow = {
  channelId: string;
  code: string;
  name: string;
  kind: ChannelKind;
  active: boolean;
  commissionPercent: number;
  orders: number;
  openOrders: number;
  gross: number;
  commission: number;
  net: number;
};

export type ChannelMenuSnapshot = {
  generatedAt: string;
  items: {
    externalItemId: string;
    externalVariantId?: string;
    productId: string;
    name: string;
    price: number;
    available: boolean;
    availabilityReason?: string;
    options: { externalOptionId: string; name: string; priceDelta: number; available: boolean }[];
  }[];
};

export type Permission = string;
export type Session = { user: User; business: Business; outlet: Outlet; permissions: Permission[]; subscription?: SubscriptionSummary; isPlatformAdmin?: boolean };

export type ListParams = { page?: number; pageSize?: number; search?: string };

// ───────────────────────────────────────────────────────────────────
// Subscription & billing types
// ───────────────────────────────────────────────────────────────────

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "expired" | "suspended";
export type BillingPeriod = "monthly" | "yearly";

export type PlanInfo = {
  slug: string;
  name: string;
  isTrial: boolean;
};

export type SubscriptionSummary = {
  status: SubscriptionStatus;
  rawStatus: SubscriptionStatus;
  isActive: boolean;
  billingPeriod: BillingPeriod;
  plan: PlanInfo | null;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
  endsAt: string | null;
  daysRemaining: number;
  graceEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  features: Record<string, unknown>;
  limits: Record<string, number | null>;
  trialReminders: number[];
};

export type UsageLevel = "ok" | "warning" | "critical" | "reached" | "unlimited";

export type SubscriptionUsage = {
  metric: string;
  label: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  percent: number;
  level: UsageLevel;
  unlimited: boolean;
};

export type PlanApi = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isPublic: boolean;
  isActive: boolean;
  isTrial: boolean;
  trialDays: number;
  currency: string;
  prices: { monthly: number; yearly: number };
  limits: Record<string, number | null>;
  features: Record<string, unknown>;
};

export type ComparisonFeature = { key: string; label: string; plans: Record<string, boolean> };
export type ComparisonGroup = { group: string; features: ComparisonFeature[] };
export type LimitRow = { metric: string; label: string; plans: Record<string, number | null> };

export type PricingPayload = {
  currency: string;
  trialDays: number;
  plans: PlanApi[];
  comparison: ComparisonGroup[];
  limits: LimitRow[];
};

export type PaymentProvider = { name: string; label: string; sandbox: boolean };

export type CheckoutResult = {
  invoice: SubscriptionInvoice;
  payment: SubscriptionPayment;
  checkout: {
    provider: string;
    status: string;
    redirectUrl: string | null;
    instructions: string | null;
    reference: string | null;
  };
};

export type SubscriptionDetail = {
  businessId: string;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    rawStatus: SubscriptionStatus;
    isActive: boolean;
    billingPeriod: BillingPeriod;
    trialStartsAt: string | null;
    trialEndsAt: string | null;
    trialDaysRemaining: number;
    startsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    endsAt: string | null;
    daysRemaining: number;
    graceEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    nextBillingDate: string | null;
    provider: string | null;
    priceAmount: number;
    currency: string;
    pendingPlan: PlanApi | null;
  };
  plan: PlanApi | null;
  usage: SubscriptionUsage[];
  features: Record<string, unknown>;
  availablePlans: PlanApi[];
  openInvoice: SubscriptionInvoice | null;
  trialReminders: number[];
  providerStatus: Record<string, { enabled: boolean; label: string }>;
  canManage?: boolean;
};

export type SubscriptionInvoice = {
  id: string;
  number: string;
  status: string;
  billingPeriod: BillingPeriod;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  lineItems: Array<{ description: string; quantity: number; unitAmount: number; amount: number }>;
  plan: { slug: string; name: string } | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  payments: SubscriptionPayment[];
};

export type SubscriptionPayment = {
  id: string;
  provider: string;
  providerReference: string | null;
  status: string;
  amount: number;
  currency: string;
  method: string | null;
  failureReason: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type SubscriptionHistoryEntry = {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  fromPlan: { slug: string; name: string } | null;
  toPlan: { slug: string; name: string } | null;
  metadata: Record<string, unknown>;
  actor: { id: string; name: string } | null;
  createdAt: string;
};

// Admin types
export type AdminOverview = {
  businesses: number;
  counts: Record<string, number>;
  mrr: number;
  currency: string;
  revenueThisMonth: number;
  revenueAllTime: number;
  planDistribution: Array<{ slug: string; name: string; active: number; monthlyPrice: number; yearlyPrice: number }>;
  recentPayments: Array<{
    id: string;
    business: string | null;
    invoice: string | null;
    provider: string;
    status: string;
    amount: number;
    currency: string;
    createdAt: string;
    paidAt: string | null;
  }>;
  trialDays: number;
  graceDays: number;
};

export type AdminBusinessRow = {
  id: string;
  name: string;
  slug: string;
  businessStatus: string;
  createdAt: string;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    billingPeriod: BillingPeriod;
    plan: string | null;
    planName: string | null;
    trialEndsAt: string | null;
    endsAt: string | null;
    daysRemaining: number;
    cancelAtPeriodEnd: boolean;
    pendingPlan: string | null;
  } | null;
  usage: { products: number; customers: number; outlets: number; users: number; transactionsPerMonth: number };
};

export type AdminBusinessDetail = {
  business: { id: string; name: string; slug: string; status: string; currency: string; createdAt: string };
  snapshot: SubscriptionDetail;
  invoices: SubscriptionInvoice[];
  payments: SubscriptionPayment[];
  history: SubscriptionHistoryEntry[];
};

// ───────────────────────────────────────────────────────────────────
// Cash registers & shifts
// ───────────────────────────────────────────────────────────────────

export type CashRegister = {
  id: string;
  outletId: string;
  name: string;
  code: string;
  status: "active" | "inactive";
};

export type RegisterShift = {
  id: string;
  outletId: string;
  registerId: string;
  registerName?: string;
  cashierId: string;
  cashierName?: string;
  status: "open" | "closed";
  openingCash: number;
  expectedCash: number | null;
  actualCash: number | null;
  difference: number | null;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
};

export type CashMovementType = "in" | "out";

export type CashMovement = {
  id: string;
  shiftId: string;
  type: CashMovementType;
  amount: number;
  reason: string | null;
  createdAt: string;
};

export type StocktakeStatus = "draft" | "in_progress" | "completed" | "cancelled";

export type StocktakeItem = {
  id: string;
  productId: string;
  productName?: string;
  sku?: string;
  expectedQuantity: number;
  countedQuantity: number;
};

export type Stocktake = {
  id: string;
  outletId: string;
  outletName?: string;
  status: StocktakeStatus;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  items: StocktakeItem[];
};

export type StockTransferStatus = "draft" | "approved" | "in_transit" | "completed" | "cancelled";

export type StockTransferItem = {
  id: string;
  productId: string;
  productName?: string;
  quantity: number;
};

export type StockTransfer = {
  id: string;
  fromOutletId: string;
  toOutletId: string;
  status: StockTransferStatus;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  items: StockTransferItem[];
};