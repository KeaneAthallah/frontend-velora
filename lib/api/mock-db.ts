import {
  mockBusiness,
  mockCategories,
  mockCustomers,
  mockEmployees,
  mockMovements,
  mockOutlets,
  mockPaymentMethods,
  mockProducts,
  mockPurchaseOrders,
  mockRoles,
  mockSuppliers,
  mockTaxRates,
  mockTransactions,
} from "./mock-data";
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
  Supplier,
  TaxRate,
  Transaction,
} from "./types";
import { applyWorstCase } from "./mock-worst-case";

function cloneProduct(product: Product): Product {
  return { ...product, stockByOutlet: { ...product.stockByOutlet } };
}

/* Mutable in-memory store used only by the mock API. Keeping it separate from
   the seed data means writes made in one screen are visible in the next. */
export const mockDb: {
  business: Business;
  outlets: Outlet[];
  categories: Category[];
  products: Product[];
  paymentMethods: PaymentMethod[];
  taxRates: TaxRate[];
  customers: Customer[];
  suppliers: Supplier[];
  roles: Role[];
  employees: Employee[];
  purchaseOrders: PurchaseOrder[];
  transactions: Transaction[];
  movements: InventoryMovement[];
} = {
  business: { ...mockBusiness },
  outlets: mockOutlets.map((outlet) => ({ ...outlet })),
  categories: mockCategories.map((category) => ({ ...category })),
  products: mockProducts.map(cloneProduct),
  paymentMethods: mockPaymentMethods.map((method) => ({ ...method })),
  taxRates: mockTaxRates.map((rate) => ({ ...rate })),
  customers: mockCustomers.map((customer) => ({ ...customer })),
  suppliers: mockSuppliers.map((supplier) => ({ ...supplier })),
  roles: mockRoles.map((role) => ({ ...role, permissions: [...role.permissions] })),
  employees: mockEmployees.map((employee) => ({ ...employee, outlets: [...employee.outlets] })),
  purchaseOrders: mockPurchaseOrders.map((order) => ({
    ...order,
    items: order.items.map((item) => ({ ...item })),
  })),
  transactions: mockTransactions.map((transaction) => ({
    ...transaction,
    items: transaction.items.map((item) => ({ ...item })),
    payments: transaction.payments.map((payment) => ({ ...payment })),
  })),
  movements: mockMovements.map((movement) => ({ ...movement })),
};

// Development-only fixture used by the mock data toggle. `data=worst` swaps
// the seed for adversarial values without touching any real API data.
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("data") === "worst") {
  applyWorstCase(mockDb);
}

let counter = 0;
export function mockId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function mockProduct(id: string) {
  return mockDb.products.find((product) => product.id === id);
}

export function adjustMockStock(productId: string, outletId: string, delta: number) {
  const product = mockProduct(productId);
  if (!product) return;
  product.stockByOutlet = {
    ...product.stockByOutlet,
    [outletId]: Math.max(0, (product.stockByOutlet[outletId] ?? 0) + delta),
  };
}
