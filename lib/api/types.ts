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
  items: { productId: string; variantId?: string; quantity: number; discount?: number }[];
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
