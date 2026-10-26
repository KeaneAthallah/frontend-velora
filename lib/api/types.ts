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
};

export type Outlet = {
  id: string;
  businessId: string;
  name: string;
  address?: string;
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

export type Transaction = {
  id: string;
  receiptNumber: string;
  outletId: string;
  outletName: string;
  cashierId: string;
  cashierName: string;
  customerId?: string;
  customerName?: string;
  items: { name: string; sku: string; quantity: number; unitPrice: number; discount: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentStatus: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  status: "completed" | "voided" | "refunded";
  payments: { id: string; method: string; amount: number; status: string; reference?: string; createdAt: string }[];
  createdAt: string;
};

export type PaymentMethod = { id: string; name: string; type: string; active: boolean };

export type InventoryMovement = {
  id: string;
  productId: string;
  productName: string;
  outletId: string;
  type: "adjustment" | "transfer" | "receive" | "sale" | "return";
  quantity: number;
  reason: string;
  createdAt: string;
  createdBy: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
};

export type PurchaseOrder = {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  outletId: string;
  status: "draft" | "approved" | "received" | "partial" | "cancelled";
  items: { productId: string; productName: string; quantity: number; cost: number }[];
  total: number;
  createdAt: string;
};

export type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  outlets: string[];
  active: boolean;
};

export type Role = { id: string; name: string; permissions: string[] };

export type DashboardMetrics = {
  grossSales: number;
  netSales: number;
  transactions: number;
  avgTransaction: number;
  refunds: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  salesByPayment: { method: string; amount: number }[];
  lowStock: { productId: string; name: string; outlet: string; stock: number }[];
  recentTransactions: Transaction[];
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
