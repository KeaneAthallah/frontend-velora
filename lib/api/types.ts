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
  items: { productId: string; variantId?: string; quantity: number; discount?: number; optionIds?: string[] }[];
  cartDiscount?: number;
  notes?: string;
  idempotencyKey: string;
};

export type Payment = {
  id: string;
  method: string;
  amount: number;
  status: string;
  reference?: string;
  createdAt: string;
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
  notes?: string;
  fulfilment?: OrderFulfilment;
  items: OrderItemInput[];
  idempotencyKey?: string;
};

export type UpdateOrderRequest = {
  orderType?: OrderType;
  customerId?: string | null;
  notes?: string;
  fulfilment?: OrderFulfilment | null;
  items?: OrderItemInput[];
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
  paymentStatus: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  status: "completed" | "voided" | "refunded";
  payments: Payment[];
  notes?: string;
  createdAt: string;
  orderNumber?: string;
  orderType?: OrderType;
  orderStatus?: OrderStatus;
  fulfilment?: OrderFulfilment;
  firedAt?: string;
  readyAt?: string;
  servedAt?: string;
};

export type PaymentMethod = { id: string; name: string; type: string; active: boolean };

export type InventoryMovement = {
  id: string;
  productId: string;
  productName: string;
  outletId: string;
  type: "adjustment" | "transfer" | "receive" | "sale" | "return" | "void" | "damaged" | "missing" | "expired" | "write_off";
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
  notes?: string;
  createdAt: string;
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

export type Permission = string;
export type Session = { user: User; business: Business; outlet: Outlet; permissions: Permission[] };

export type ListParams = { page?: number; pageSize?: number; search?: string };
