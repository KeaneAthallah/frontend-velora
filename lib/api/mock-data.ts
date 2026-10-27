import { format } from "date-fns";
import type {
  Business,
  Category,
  Customer,
  Employee,
  InventoryMovement,
  Outlet,
  PaymentMethod,
  Product,
  PurchaseOrder,
  Role,
  Session,
  Supplier,
  TaxRate,
  Transaction,
  User,
} from "./types";

/* A deterministic, relative-to-today fixture set for local development and
   visual verification. It is only read when NEXT_PUBLIC_USE_MOCK_API is on. */

const anchor = new Date();
const dayStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());

function daysAgo(days: number, hour = 12, minute = 0) {
  const date = new Date(dayStart);
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seeded(20261027);
const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

export const mockTaxRate = 11;

export const mockUser: User = { id: "u1", name: "Kendra Admin", email: "admin@velora.test" };

export const mockBusiness: Business = {
  id: "b1",
  name: "Velora Coffee",
  currency: "IDR",
  timezone: "Asia/Jakarta",
  address: "Jl. Jenderal Sudirman No. 21, Jakarta Selatan",
};

export const mockOutlets: Outlet[] = [
  { id: "o1", businessId: "b1", name: "Sudirman", code: "SDM", address: "Jl. Jenderal Sudirman No. 21", phone: "+62 21 555 0112" },
  { id: "o2", businessId: "b1", name: "Kemang", code: "KMG", address: "Jl. Kemang Raya No. 8", phone: "+62 21 555 0187" },
];

export const mockCategories: Category[] = [
  { id: "c1", name: "Coffee", productCount: 6 },
  { id: "c2", name: "Tea", productCount: 3 },
  { id: "c3", name: "Pastry", productCount: 4 },
  { id: "c4", name: "Merchandise", productCount: 2 },
  { id: "c5", name: "Beans", productCount: 2 },
];

export const mockProducts: Product[] = [
  { id: "p1", name: "Espresso", sku: "COF-ESP-01", barcode: "899123456001", categoryId: "c1", categoryName: "Coffee", price: 25000, cost: 7800, taxRate: mockTaxRate, stockByOutlet: { o1: 128, o2: 54 }, active: true, trackInventory: true, unit: "cup" },
  { id: "p2", name: "Cappuccino", sku: "COF-CAP-01", barcode: "899123456002", categoryId: "c1", categoryName: "Coffee", price: 35000, cost: 11200, taxRate: mockTaxRate, stockByOutlet: { o1: 86, o2: 38 }, active: true, trackInventory: true, unit: "cup" },
  { id: "p3", name: "Caffè Latte", sku: "COF-LAT-01", barcode: "899123456003", categoryId: "c1", categoryName: "Coffee", price: 38000, cost: 12400, taxRate: mockTaxRate, stockByOutlet: { o1: 72, o2: 31 }, active: true, trackInventory: true, unit: "cup" },
  { id: "p4", name: "Americano", sku: "COF-AMR-01", barcode: "899123456004", categoryId: "c1", categoryName: "Coffee", price: 28000, cost: 8200, taxRate: mockTaxRate, stockByOutlet: { o1: 94, o2: 42 }, active: true, trackInventory: true, unit: "cup" },
  { id: "p5", name: "Cold Brew", sku: "COF-CLB-01", barcode: "899123456005", categoryId: "c1", categoryName: "Coffee", price: 42000, cost: 13600, taxRate: mockTaxRate, stockByOutlet: { o1: 46, o2: 18 }, active: true, trackInventory: true, unit: "bottle" },
  { id: "p6", name: "Single-Origin Ethiopia Guji Natural Filter — 250g", sku: "BEAN-ETH-GUJI-250", barcode: "899123456006", categoryId: "c5", categoryName: "Beans", price: 145000, cost: 88000, taxRate: mockTaxRate, stockByOutlet: { o1: 22, o2: 8 }, active: true, trackInventory: true, unit: "bag" },
  { id: "p7", name: "Green Tea", sku: "TEA-GRN-01", barcode: "899123456007", categoryId: "c2", categoryName: "Tea", price: 22000, cost: 6200, taxRate: mockTaxRate, stockByOutlet: { o1: 58, o2: 26 }, active: true, trackInventory: true, unit: "cup" },
  { id: "p8", name: "Matcha Latte", sku: "TEA-MAT-01", barcode: "899123456008", categoryId: "c2", categoryName: "Tea", price: 40000, cost: 14800, taxRate: mockTaxRate, stockByOutlet: { o1: 31, o2: 9 }, active: true, trackInventory: true, unit: "cup" },
  { id: "p9", name: "Jasmine Silver Needle", sku: "TEA-JSN-01", categoryId: "c2", categoryName: "Tea", price: 45000, cost: 17200, taxRate: mockTaxRate, stockByOutlet: { o1: 17, o2: 0 }, active: true, trackInventory: true, unit: "cup" },
  { id: "p10", name: "Butter Croissant", sku: "PST-CRO-01", barcode: "899123456010", categoryId: "c3", categoryName: "Pastry", price: 30000, cost: 10800, taxRate: mockTaxRate, stockByOutlet: { o1: 24, o2: 11 }, active: true, trackInventory: true, unit: "piece" },
  { id: "p11", name: "Pain au Chocolat", sku: "PST-PAC-01", categoryId: "c3", categoryName: "Pastry", price: 32000, cost: 11600, taxRate: mockTaxRate, stockByOutlet: { o1: 19, o2: 8 }, active: true, trackInventory: true, unit: "piece" },
  { id: "p12", name: "Almond Danish", sku: "PST-ALM-01", categoryId: "c3", categoryName: "Pastry", price: 34000, cost: 12600, taxRate: mockTaxRate, stockByOutlet: { o1: 4, o2: 6 }, active: true, trackInventory: true, unit: "piece" },
  { id: "p13", name: "Blueberry Muffin", sku: "PST-MUF-01", categoryId: "c3", categoryName: "Pastry", price: 25000, cost: 9200, taxRate: mockTaxRate, stockByOutlet: { o1: 28, o2: 14 }, active: true, trackInventory: true, unit: "piece" },
  { id: "p14", name: "Canvas Tote Bag", sku: "MER-TOT-01", categoryId: "c4", categoryName: "Merchandise", price: 75000, cost: 31000, taxRate: mockTaxRate, stockByOutlet: { o1: 14, o2: 5 }, active: true, trackInventory: true, unit: "piece" },
  { id: "p15", name: "Ceramic Cup 240ml", sku: "MER-CUP-240", categoryId: "c4", categoryName: "Merchandise", price: 120000, cost: 54000, taxRate: mockTaxRate, stockByOutlet: { o1: 8, o2: 3 }, active: true, trackInventory: true, unit: "piece" },
  { id: "p16", name: "House Blend — 250g", sku: "BEAN-HSE-250", categoryId: "c5", categoryName: "Beans", price: 95000, cost: 57000, taxRate: mockTaxRate, stockByOutlet: { o1: 36, o2: 16 }, active: true, trackInventory: true, unit: "bag" },
];

export const mockPaymentMethods: PaymentMethod[] = [
  { id: "pm1", name: "Cash", type: "cash", active: true },
  { id: "pm2", name: "QRIS", type: "qris", active: true },
  { id: "pm3", name: "Debit Card", type: "debit_card", active: true },
  { id: "pm4", name: "Credit Card", type: "credit_card", active: true },
];

export const mockTaxRates: TaxRate[] = [
  { id: "tr1", name: "PPN", rate: 11, type: "exclusive", isDefault: true, isActive: true },
  { id: "tr2", name: "Zero-rated", rate: 0, type: "exclusive", isDefault: false, isActive: false },
];

export const mockCustomers: Customer[] = [
  { id: "cu1", name: "Raden Ayu Kartika Sari Wulandari Putri", phone: "+62 812 7000 1188", email: "kartika.wulandari@example.co.id", address: "Kebayoran Baru, Jakarta Selatan", loyaltyNumber: "VLR-0001188", loyaltyPoints: 486, createdAt: daysAgo(210, 10, 15) },
  { id: "cu2", name: "Dimas Pratama", phone: "+62 811 2044 909", email: "dimas.pratama@example.com", address: "Menteng, Jakarta Pusat", loyaltyNumber: "VLR-0002091", loyaltyPoints: 212, createdAt: daysAgo(164, 14, 30) },
  { id: "cu3", name: "Sarah Lim", phone: "+62 813 8801 4455", email: "sarah.lim@example.com", address: "Kemang, Jakarta Selatan", loyaltyNumber: "VLR-0003310", loyaltyPoints: 92, createdAt: daysAgo(121, 9, 5) },
  { id: "cu4", name: "Adi Nugroho", phone: "+62 856 9920 3344", email: "adi.nugroho@example.com", address: "Tebet, Jakarta Selatan", loyaltyNumber: "VLR-0003877", loyaltyPoints: 640, createdAt: daysAgo(98, 16, 45) },
  { id: "cu5", name: "Maya Kusuma", phone: "+62 878 1100 2277", email: "maya.kusuma@example.com", address: "Senopati, Jakarta Selatan", loyaltyNumber: "VLR-0004412", loyaltyPoints: 38, createdAt: daysAgo(73, 11, 20) },
  { id: "cu6", name: "Joshua Tanuwijaya", phone: "+62 821 4550 7788", email: "joshua.t@example.com", address: "Pondok Indah, Jakarta Selatan", loyaltyNumber: "VLR-0005190", loyaltyPoints: 154, createdAt: daysAgo(52, 13, 10) },
  { id: "cu7", name: "Nadia Rahman", phone: "+62 812 8833 0091", email: "nadia.rahman@example.com", address: "Bintaro, Tangerang Selatan", loyaltyNumber: "VLR-0005821", loyaltyPoints: 66, createdAt: daysAgo(31, 10, 0) },
  { id: "cu8", name: "Felix Wijaya", phone: "+62 858 7722 1166", email: "felix.wijaya@example.com", address: "PIK, Jakarta Utara", loyaltyNumber: "VLR-0006034", loyaltyPoints: 20, createdAt: daysAgo(12, 17, 35) },
  { id: "cu9", name: "Anindya Putri", phone: "+62 811 3300 5522", email: "anindya.putri@example.com", address: "Cipete, Jakarta Selatan", loyaltyNumber: "VLR-0006198", loyaltyPoints: 12, createdAt: daysAgo(5, 12, 5) },
];

export const mockSuppliers: Supplier[] = [
  { id: "s1", name: "Bean Supply Co", contact: "Rudi Hartono", email: "orders@beansupply.id", phone: "+62 812 1111 2222", address: "Jl. Raya Bogor KM 21, Jakarta Timur" },
  { id: "s2", name: "Pastry House", contact: "Sari Dewi", email: "sari@pastryhouse.id", phone: "+62 813 3333 4444", address: "Jl. Kemang Selatan No. 4, Jakarta Selatan" },
  { id: "s3", name: "Nusantara Dairy", contact: "Bayu Santoso", email: "bayu@nusantaradairy.id", phone: "+62 857 8888 9900", address: "Bandung, Jawa Barat" },
  { id: "s4", name: "Paper & Print", contact: "Mira Lestari", email: "hello@paperandprint.id", phone: "+62 878 3200 1100", address: "Jl. Cikini Raya No. 12, Jakarta Pusat" },
];

export const mockRoles: Role[] = [
  {
    id: "r1",
    slug: "owner",
    name: "Owner",
    description: "Full access to every outlet, report, and setting.",
    permissions: ["*"],
  },
  {
    id: "r2",
    slug: "manager",
    name: "Manager",
    description: "Runs day-to-day operations across assigned outlets.",
    permissions: ["sales.view", "sales.create", "sales.void", "products.view", "products.manage", "inventory.view", "inventory.adjust", "purchasing.view", "purchasing.manage", "customers.view", "customers.manage", "suppliers.view", "suppliers.manage", "reports.view", "employees.view"],
  },
  {
    id: "r3",
    slug: "cashier",
    name: "Cashier",
    description: "Sells and looks up products. No reports or settings.",
    permissions: ["sales.view", "sales.create", "products.view", "customers.view"],
  },
];

export const mockEmployees: Employee[] = [
  { id: "e1", userId: "u1", name: "Kendra Admin", email: "admin@velora.test", role: "Owner", roleId: "r1", outlets: ["o1", "o2"], active: true, status: "active", joinedAt: daysAgo(365, 9, 0) },
  { id: "e2", userId: "u2", name: "Budi Kasir", email: "budi@velora.test", role: "Cashier", roleId: "r3", outlets: ["o1"], active: true, status: "active", joinedAt: daysAgo(145, 9, 0) },
  { id: "e3", userId: "u3", name: "Ani Kasir", email: "ani@velora.test", role: "Cashier", roleId: "r3", outlets: ["o1", "o2"], active: true, status: "active", joinedAt: daysAgo(112, 9, 0) },
  { id: "e4", userId: "u4", name: "Sari Wulandari", email: "sari@velora.test", role: "Manager", roleId: "r2", outlets: ["o1", "o2"], active: true, status: "active", joinedAt: daysAgo(88, 9, 0) },
  { id: "e5", userId: "u5", name: "Dimas Prakoso", email: "dimas@velora.test", role: "Cashier", roleId: "r3", outlets: ["o2"], active: false, status: "invited", joinedAt: daysAgo(3, 9, 0) },
];

function poItems(entries: [string, number][]) {
  return entries.map(([productId, quantity], index) => {
    const product = mockProducts.find((item) => item.id === productId)!;
    return { id: `poi-${productId}-${index}`, productId, productName: product.name, quantity, cost: product.cost };
  });
}

export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: "po1",
    number: "PO-2026-0042",
    supplierId: "s1",
    supplierName: "Bean Supply Co",
    outletId: "o1",
    outletName: "Sudirman",
    status: "approved",
    items: poItems([["p16", 60], ["p6", 24]]),
    total: 60 * 57000 + 24 * 88000,
    expectedAt: daysAgo(-2, 10, 0),
    createdAt: daysAgo(2, 9, 15),
    approvedAt: daysAgo(2, 10, 0),
  },
  {
    id: "po2",
    number: "PO-2026-0040",
    supplierId: "s2",
    supplierName: "Pastry House",
    outletId: "o2",
    outletName: "Kemang",
    status: "partial",
    items: poItems([["p10", 40], ["p11", 30], ["p12", 20]]),
    total: 40 * 10800 + 30 * 11600 + 20 * 12600,
    expectedAt: daysAgo(0, 8, 0),
    createdAt: daysAgo(5, 15, 20),
    approvedAt: daysAgo(5, 16, 0),
  },
  {
    id: "po3",
    number: "PO-2026-0039",
    supplierId: "s3",
    supplierName: "Nusantara Dairy",
    outletId: "o1",
    outletName: "Sudirman",
    status: "received",
    items: poItems([["p1", 100], ["p2", 80], ["p3", 80]]),
    total: 100 * 7800 + 80 * 11200 + 80 * 12400,
    expectedAt: daysAgo(9, 9, 0),
    createdAt: daysAgo(12, 11, 0),
    approvedAt: daysAgo(12, 11, 30),
    receivedAt: daysAgo(9, 9, 15),
  },
  {
    id: "po4",
    number: "PO-2026-0043",
    supplierId: "s4",
    supplierName: "Paper & Print",
    outletId: "o1",
    outletName: "Sudirman",
    status: "draft",
    items: poItems([["p14", 20]]),
    total: 20 * 31000,
    expectedAt: daysAgo(-6, 9, 0),
    createdAt: daysAgo(0, 14, 10),
  },
  {
    id: "po5",
    number: "PO-2026-0038",
    supplierId: "s1",
    supplierName: "Bean Supply Co",
    outletId: "o2",
    outletName: "Kemang",
    status: "cancelled",
    items: poItems([["p6", 12]]),
    total: 12 * 88000,
    createdAt: daysAgo(18, 10, 0),
  },
];

/* -------------------------------------------------------------------------- */
/* Transaction ledger                                                         */
/* -------------------------------------------------------------------------- */

const purchaseWeights: Record<string, number> = {
  p1: 5,
  p2: 8,
  p3: 7,
  p4: 5,
  p5: 3,
  p6: 1,
  p7: 3,
  p8: 4,
  p9: 1,
  p10: 5,
  p11: 3,
  p12: 2,
  p13: 3,
  p14: 1,
  p15: 1,
  p16: 2,
};

const weightedProducts = Object.entries(purchaseWeights).flatMap(([id, weight]) => Array.from({ length: weight }, () => id));
const methods = ["Cash", "Cash", "Cash", "Cash", "QRIS", "QRIS", "QRIS", "Debit Card", "Credit Card"];
const cashiers = [
  { id: "u2", name: "Budi Kasir" },
  { id: "u3", name: "Ani Kasir" },
  { id: "u1", name: "Kendra Admin" },
  { id: "u4", name: "Sari Wulandari" },
];

function makeTransaction(at: Date, sequence: number): Transaction {
  const outlet = rand() < 0.62 ? mockOutlets[0] : mockOutlets[1];
  const cashier = pick(cashiers);
  const itemCount = between(1, 4);
  const chosen = new Set<string>();
  while (chosen.size < itemCount) chosen.add(pick(weightedProducts));

  const items = Array.from(chosen).map((productId) => {
    const product = mockProducts.find((item) => item.id === productId)!;
    const quantity = between(1, 3);
    return {
      productId,
      name: product.name,
      sku: product.sku,
      quantity,
      unitPrice: product.price,
      discount: 0,
      lineTotal: product.price * quantity,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const discount = rand() < 0.12 ? Math.round(subtotal * 0.05) : 0;
  const tax = Math.round((subtotal - discount) * (mockTaxRate / 100));
  const total = subtotal - discount + tax;
  const method = pick(methods);
  const customer = rand() < 0.32 ? pick(mockCustomers) : null;
  const isOld = at.getTime() < Date.now() - 2 * 86_400_000;
  const status: Transaction["status"] = isOld && rand() < 0.035 ? (rand() < 0.5 ? "voided" : "refunded") : "completed";

  return {
    id: `tx-${String(sequence).padStart(5, "0")}`,
    receiptNumber: `R-${format(at, "yyyyMMdd")}-${String(sequence).padStart(4, "0")}`,
    outletId: outlet.id,
    outletName: outlet.name,
    cashierId: cashier.id,
    cashierName: cashier.name,
    customerId: customer?.id,
    customerName: customer?.name,
    items,
    subtotal,
    discount,
    tax,
    total,
    paymentStatus: status === "refunded" ? "refunded" : status === "voided" ? "refunded" : "paid",
    status,
    payments: [
      {
        id: `pay-${String(sequence).padStart(5, "0")}`,
        method,
        amount: total,
        status: status === "completed" ? "success" : "refunded",
        reference: method === "Cash" ? undefined : `${method.slice(0, 2).toUpperCase()}${String(900000 + sequence)}`,
        createdAt: at.toISOString(),
      },
    ],
    createdAt: at.toISOString(),
  };
}

const generated: Transaction[] = [];
let sequence = 1;
for (let days = 89; days >= 0; days -= 1) {
  const count = days === 0 ? 6 : rand() < 0.12 ? 0 : between(1, 2);
  for (let index = 0; index < count; index += 1) {
    const hour = days === 0 ? 8 + index : between(8, 19);
    const minute = days === 0 ? 20 + index * 7 : between(0, 59);
    const at = new Date(dayStart);
    at.setDate(at.getDate() - days);
    at.setHours(hour, minute, 0, 0);
    generated.push(makeTransaction(at, sequence));
    sequence += 1;
  }
}

generated.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
export const mockTransactions: Transaction[] = generated;

export const mockMovements: InventoryMovement[] = [
  { id: "m1", productId: "p1", productName: "Espresso", outletId: "o1", type: "receive", quantity: 100, reason: "PO-2026-0039 received", balanceAfter: 128, createdAt: daysAgo(9, 9, 15), createdBy: "Sari Wulandari" },
  { id: "m2", productId: "p2", productName: "Cappuccino", outletId: "o1", type: "receive", quantity: 80, reason: "PO-2026-0039 received", balanceAfter: 86, createdAt: daysAgo(9, 9, 17), createdBy: "Sari Wulandari" },
  { id: "m3", productId: "p12", productName: "Almond Danish", outletId: "o1", type: "adjustment", quantity: -2, reason: "Damaged in transit", balanceAfter: 4, createdAt: daysAgo(6, 11, 0), createdBy: "Budi Kasir" },
  { id: "m4", productId: "p9", productName: "Jasmine Silver Needle", outletId: "o2", type: "adjustment", quantity: -4, reason: "Spillage during service", balanceAfter: 0, createdAt: daysAgo(4, 15, 20), createdBy: "Ani Kasir" },
  { id: "m5", productId: "p10", productName: "Butter Croissant", outletId: "o2", type: "receive", quantity: 40, reason: "PO-2026-0040 partially received", balanceAfter: 11, createdAt: daysAgo(0, 8, 20), createdBy: "Sari Wulandari" },
  { id: "m6", productId: "p6", productName: "Single-Origin Ethiopia Guji Natural Filter — 250g", outletId: "o1", type: "adjustment", quantity: -1, reason: "Stock count correction", balanceAfter: 22, createdAt: daysAgo(1, 18, 10), createdBy: "Kendra Admin" },
  ...mockTransactions.slice(-6).flatMap((tx, index) =>
    tx.items.map((item, itemIndex) => ({
      id: `m-sale-${index}-${itemIndex}`,
      productId: item.productId ?? "p1",
      productName: item.name,
      outletId: tx.outletId,
      type: "sale" as const,
      quantity: -item.quantity,
      reason: `Sale ${tx.receiptNumber}`,
      createdAt: tx.createdAt,
      createdBy: tx.cashierName,
    }))
  ),
];

export const mockSession: Session = {
  user: mockUser,
  business: mockBusiness,
  outlet: mockOutlets[0],
  permissions: ["*"],
};

export const now = () => new Date().toISOString();
