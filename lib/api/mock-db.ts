import {
  mockBusiness,
  mockCategories,
  mockCustomers,
  mockDayparts,
  mockEmployees,
  mockMenuAvailability,
  mockModifierAssignments,
  mockModifierCategoryAssignments,
  mockModifierGroups,
  mockMovements,
  mockOutlets,
  mockPaymentMethods,
  mockProductDayparts,
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
  Daypart,
  Employee,
  InventoryMovement,
  ModifierGroup,
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

function cloneGroup(group: ModifierGroup): ModifierGroup {
  return { ...group, options: group.options.map((option) => ({ ...option })) };
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
  modifierGroups: ModifierGroup[];
  modifierAssignments: Record<string, string[]>;
  modifierCategoryAssignments: Record<string, string[]>;
  dayparts: Daypart[];
  productDayparts: Record<string, string[]>;
  menuAvailability: Record<string, { available: boolean; reason?: string }>;
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
  modifierGroups: mockModifierGroups.map(cloneGroup),
  modifierAssignments: Object.fromEntries(
    Object.entries(mockModifierAssignments).map(([productId, ids]) => [productId, [...ids]])
  ),
  modifierCategoryAssignments: Object.fromEntries(
    Object.entries(mockModifierCategoryAssignments).map(([categoryId, ids]) => [categoryId, [...ids]])
  ),
  dayparts: mockDayparts.map((daypart) => ({ ...daypart, days: [...daypart.days] })),
  productDayparts: Object.fromEntries(
    Object.entries(mockProductDayparts).map(([productId, ids]) => [productId, [...ids]])
  ),
  menuAvailability: { ...mockMenuAvailability },
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

export function mockGroupsForProduct(productId: string): ModifierGroup[] {
  const product = mockProduct(productId);
  const ids = new Set<string>([
    ...(mockDb.modifierAssignments[productId] ?? []),
    ...(product ? mockDb.modifierCategoryAssignments[product.categoryId] ?? [] : []),
  ]);

  return [...ids]
    .map((id) => mockDb.modifierGroups.find((group) => group.id === id))
    .filter((group): group is ModifierGroup => Boolean(group))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map(cloneGroup);
}

export function mockAvailability(outletId: string, productId: string) {
  return mockDb.menuAvailability[`${outletId}:${productId}`];
}

/** Price of a product plus the selected option deltas, mirroring the server. */
export function mockLinePrice(productId: string, optionIds: string[] = []) {
  const product = mockProduct(productId);
  if (!product) return 0;
  const selected = new Set(optionIds);
  const delta = mockGroupsForProduct(productId)
    .flatMap((group) => group.options)
    .filter((option) => selected.has(option.id))
    .reduce((sum, option) => sum + option.priceDelta, 0);
  return product.price + delta;
}
