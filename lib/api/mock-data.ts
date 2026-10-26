import type {
  Business,
  Category,
  Employee,
  InventoryMovement,
  Outlet,
  PaymentMethod,
  Product,
  PurchaseOrder,
  Role,
  Session,
  Supplier,
  Transaction,
  User,
} from "./types";

const now = () => new Date().toISOString();

export const mockUser: User = { id: "u1", name: "Kendra Admin", email: "admin@velora.test" };

export const mockBusiness: Business = {
  id: "b1",
  name: "Velora Coffee",
  currency: "IDR",
  timezone: "Asia/Jakarta",
};

export const mockOutlets: Outlet[] = [
  { id: "o1", businessId: "b1", name: "Outlet Pusat", address: "Jl. Sudirman 1" },
  { id: "o2", businessId: "b1", name: "Outlet Selatan", address: "Jl. Gatot Subroto 2" },
];

export const mockCategories: Category[] = [
  { id: "c1", name: "Coffee", productCount: 4 },
  { id: "c2", name: "Tea", productCount: 2 },
  { id: "c3", name: "Pastry", productCount: 3 },
  { id: "c4", name: "Merchandise", productCount: 1 },
];

export const mockProducts: Product[] = [
  { id: "p1", name: "Espresso", sku: "ESP-001", barcode: "899123456001", categoryId: "c1", categoryName: "Coffee", price: 25000, cost: 8000, taxRate: 0.1, stockByOutlet: { o1: 120, o2: 45 }, active: true },
  { id: "p2", name: "Cappuccino", sku: "CAP-001", barcode: "899123456002", categoryId: "c1", categoryName: "Coffee", price: 35000, cost: 12000, taxRate: 0.1, stockByOutlet: { o1: 80, o2: 30 }, active: true },
  { id: "p3", name: "Latte", sku: "LAT-001", barcode: "899123456003", categoryId: "c1", categoryName: "Coffee", price: 38000, cost: 13000, taxRate: 0.1, stockByOutlet: { o1: 60, o2: 20 }, active: true },
  { id: "p4", name: "Americano", sku: "AMR-001", categoryId: "c1", categoryName: "Coffee", price: 28000, cost: 9000, taxRate: 0.1, stockByOutlet: { o1: 90, o2: 40 }, active: true },
  { id: "p5", name: "Green Tea", sku: "GTE-001", categoryId: "c2", categoryName: "Tea", price: 22000, cost: 6000, taxRate: 0.1, stockByOutlet: { o1: 50, o2: 25 }, active: true },
  { id: "p6", name: "Matcha Latte", sku: "MAT-001", categoryId: "c2", categoryName: "Tea", price: 40000, cost: 15000, taxRate: 0.1, stockByOutlet: { o1: 35, o2: 12 }, active: true },
  { id: "p7", name: "Croissant", sku: "CRO-001", categoryId: "c3", categoryName: "Pastry", price: 30000, cost: 12000, taxRate: 0.1, stockByOutlet: { o1: 25, o2: 10 }, active: true },
  { id: "p8", name: "Muffin", sku: "MUF-001", categoryId: "c3", categoryName: "Pastry", price: 25000, cost: 10000, taxRate: 0.1, stockByOutlet: { o1: 40, o2: 15 }, active: true },
  { id: "p9", name: "Tote Bag", sku: "TOT-001", categoryId: "c4", categoryName: "Merchandise", price: 75000, cost: 30000, taxRate: 0.1, stockByOutlet: { o1: 15, o2: 5 }, active: true },
];

export const mockPaymentMethods: PaymentMethod[] = [
  { id: "pm1", name: "Cash", type: "cash", active: true },
  { id: "pm2", name: "QRIS", type: "qris", active: true },
  { id: "pm3", name: "Debit Card", type: "card", active: true },
  { id: "pm4", name: "Credit Card", type: "card", active: true },
];

export const mockSuppliers: Supplier[] = [
  { id: "s1", name: "Bean Supply Co", contact: "Rudi", email: "rudi@beansupply.id", phone: "0812-1111-2222" },
  { id: "s2", name: "Pastry House", contact: "Sari", email: "sari@pastryhouse.id", phone: "0813-3333-4444" },
];

export const mockEmployees: Employee[] = [
  { id: "e1", name: "Kendra Admin", email: "admin@velora.test", role: "owner", outlets: ["o1", "o2"], active: true },
  { id: "e2", name: "Budi Kasir", email: "budi@velora.test", role: "cashier", outlets: ["o1"], active: true },
  { id: "e3", name: "Ani Kasir", email: "ani@velora.test", role: "cashier", outlets: ["o2"], active: true },
];

export const mockRoles: Role[] = [
  { id: "r1", name: "owner", permissions: ["*"] },
  { id: "r2", name: "cashier", permissions: ["pos.sale", "transactions.view", "products.view"] },
  { id: "r3", name: "manager", permissions: ["pos.sale", "products.*", "inventory.*", "reports.view"] },
];

export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: "po1",
    number: "PO-0001",
    supplierId: "s1",
    supplierName: "Bean Supply Co",
    outletId: "o1",
    status: "approved",
    items: [
      { productId: "p1", productName: "Espresso", quantity: 50, cost: 8000 },
      { productId: "p2", productName: "Cappuccino", quantity: 30, cost: 12000 },
    ],
    total: 760000,
    createdAt: "2026-10-20T09:00:00.000Z",
  },
];

export const mockMovements: InventoryMovement[] = [
  { id: "m1", productId: "p1", productName: "Espresso", outletId: "o1", type: "receive", quantity: 50, reason: "PO-0001 received", createdAt: "2026-10-20T10:00:00.000Z", createdBy: "Kendra Admin" },
  { id: "m2", productId: "p2", productName: "Cappuccino", outletId: "o1", type: "adjustment", quantity: -5, reason: "Spillage", createdAt: "2026-10-21T11:00:00.000Z", createdBy: "Budi Kasir" },
];

const t1: Transaction = {
  id: "tx1",
  receiptNumber: "R-0001",
  outletId: "o1",
  outletName: "Outlet Pusat",
  cashierId: "e2",
  cashierName: "Budi Kasir",
  items: [
    { name: "Cappuccino", sku: "CAP-001", quantity: 2, unitPrice: 35000, discount: 0, lineTotal: 70000 },
    { name: "Croissant", sku: "CRO-001", quantity: 1, unitPrice: 30000, discount: 0, lineTotal: 30000 },
  ],
  subtotal: 100000,
  discount: 0,
  tax: 10000,
  total: 110000,
  paymentStatus: "paid",
  status: "completed",
  payments: [{ id: "pay1", method: "Cash", amount: 110000, status: "success", createdAt: "2026-10-26T08:30:00.000Z" }],
  createdAt: "2026-10-26T08:30:00.000Z",
};

export const mockTransactions: Transaction[] = [t1];

export const mockSession: Session = {
  user: mockUser,
  business: mockBusiness,
  outlet: mockOutlets[0],
  permissions: ["*"],
};

export { now };
