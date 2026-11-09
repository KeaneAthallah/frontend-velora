import {
  mockBusiness,
  mockCategories,
  mockChannelMappings,
  mockChannels,
  mockCustomers,
  mockDayparts,
  mockDiningTables,
  mockEmployees,
  mockFloorAreas,
  mockIngredientBalances,
  mockIngredientMovements,
  mockIngredients,
  mockKitchenStations,
  mockLoyaltyProgram,
  mockMenuAvailability,
  mockModifierAssignments,
  mockModifierCategoryAssignments,
  mockModifierGroups,
  mockMovements,
  mockOpenOrders,
  mockOutlets,
  mockPaymentMethods,
  mockProductDayparts,
  mockProducts,
  mockPromotions,
  mockPurchaseOrders,
  mockRecipeItems,
  mockRoles,
  mockSuppliers,
  mockTaxRates,
  mockTransactions,
} from "./mock-data";
import type {
  Business,
  CashMovement,
  CashRegister,
  Category,
  ChannelEvent,
  ChannelMapping,
  Customer,
  Daypart,
  DiningTable,
  Employee,
  FloorArea,
  Ingredient,
  IngredientMovement,
  InventoryMovement,
  KitchenStation,
  KitchenTicket,
  LoyaltyProgram,
  LoyaltyTransaction,
  ModifierGroup,
  OrderType,
  Outlet,
  PaymentMethod,
  Product,
  Promotion,
  PurchaseOrder,
  Refund,
  RegisterShift,
  Role,
  SalesChannel,
  Supplier,
  SubscriptionInvoice as TypeSubscriptionInvoice,
  SubscriptionPayment as TypeSubscriptionPayment,
  SubscriptionHistoryEntry as TypeSubscriptionHistoryEntry,
  AdminBusinessRow,
  Stocktake,
  StockTransfer,
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
  promotions: Promotion[];
  promotionRedemptions: { id: string; promotionId: string; saleId: string; customerId?: string; amount: number }[];
  loyaltyProgram: LoyaltyProgram;
  loyaltyTransactions: LoyaltyTransaction[];
  suppliers: Supplier[];
  roles: Role[];
  employees: Employee[];
  purchaseOrders: PurchaseOrder[];
  transactions: Transaction[];
  orders: Transaction[];
  refunds: Refund[];
  movements: InventoryMovement[];
  modifierGroups: ModifierGroup[];
  modifierAssignments: Record<string, string[]>;
  modifierCategoryAssignments: Record<string, string[]>;
  dayparts: Daypart[];
  productDayparts: Record<string, string[]>;
  menuAvailability: Record<string, { available: boolean; reason?: string }>;
  ingredients: Ingredient[];
  recipeItems: {
    id: string;
    productId: string;
    productVariantId?: string;
    ingredientId: string;
    quantity: number;
    wastePercent: number;
    optional?: boolean;
  }[];
  ingredientBalances: Record<string, number>;
  ingredientMovements: IngredientMovement[];
  floorAreas: FloorArea[];
  diningTables: DiningTable[];
  kitchenStations: KitchenStation[];
  kitchenTickets: KitchenTicket[];
  kitchenTicketSeedDone: boolean;
  kitchenTicketCounter: number;
  channels: SalesChannel[];
  channelMappings: ChannelMapping[];
  channelMappingOwners: Record<string, string>;
  channelEvents: ChannelEvent[];
  subscriptionInvoices: TypeSubscriptionInvoice[];
  subscriptionPayments: TypeSubscriptionPayment[];
  subscriptionHistory: TypeSubscriptionHistoryEntry[];
  cashRegisters: CashRegister[];
  registerShifts: RegisterShift[];
  cashMovements: CashMovement[];
  stockTransfers: StockTransfer[];
  stocktakes: Stocktake[];
  adminBusinesses: AdminBusinessRow[];
  allPlans: Array<{ id: string; slug: string; name: string }>;
} = {
  business: { ...mockBusiness },
  outlets: mockOutlets.map((outlet) => ({ ...outlet })),
  categories: mockCategories.map((category) => ({ ...category })),
  products: mockProducts.map(cloneProduct),
  paymentMethods: mockPaymentMethods.map((method) => ({ ...method })),
  taxRates: mockTaxRates.map((rate) => ({ ...rate })),
  customers: mockCustomers.map((customer) => ({ ...customer })),
  promotions: mockPromotions.map((promotion) => ({ ...promotion })),
  promotionRedemptions: [],
  loyaltyProgram: { ...mockLoyaltyProgram },
  loyaltyTransactions: [],
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
  orders: mockOpenOrders.map((order) => ({
    ...order,
    items: order.items.map((item) => ({ ...item })),
    payments: order.payments.map((payment) => ({ ...payment })),
  })),
  refunds: [],
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
  ingredients: mockIngredients.map((ingredient) => ({ ...ingredient })),
  recipeItems: mockRecipeItems.map((item) => ({ ...item })),
  ingredientBalances: { ...mockIngredientBalances },
  ingredientMovements: mockIngredientMovements.map((movement) => ({ ...movement })),
  floorAreas: mockFloorAreas.map((area) => ({ ...area })),
  diningTables: mockDiningTables.map((table) => ({ ...table, area: table.area ? { ...table.area } : null })),
  kitchenStations: mockKitchenStations.map((station) => ({
    ...station,
    categories: station.categories.map((category) => ({ ...category })),
  })),
  kitchenTickets: [],
  kitchenTicketSeedDone: false,
  kitchenTicketCounter: 0,
  channels: mockChannels.map((channel) => ({ ...channel })),
  channelMappings: mockChannelMappings.map((mapping) => ({
    ...mapping,
    optionMap: { ...mapping.optionMap },
  })),
  // Channel mapping rows carry no channel id in the API; the mock keeps the
  // ownership alongside so saving one channel never touches another's menu.
  channelMappingOwners: Object.fromEntries(
    mockChannelMappings.map((mapping) => [
      mapping.id,
      mapping.externalItemId.startsWith("GF-") ? "ch-gofood" : "ch-web",
    ])
  ),
  channelEvents: [],
  subscriptionInvoices: [],
  subscriptionPayments: [],
  subscriptionHistory: [
    {
      id: "1",
      action: "trial_started",
      fromStatus: null,
      toStatus: "trialing",
      fromPlan: null,
      toPlan: { slug: "trial", name: "Free Trial" },
      metadata: { trial_days: 30 },
      actor: null,
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
  ],
  cashRegisters: [
    { id: "reg-1", outletId: mockOutlets[0]?.id ?? "1", name: "Front counter", code: "FRONT", status: "active" },
    { id: "reg-2", outletId: mockOutlets[0]?.id ?? "1", name: "Bar till", code: "BAR", status: "active" },
  ],
  registerShifts: [],
  cashMovements: [],
  stockTransfers: [
    {
      id: "st-1",
      fromOutletId: "o1",
      toOutletId: "o2",
      status: "draft",
      notes: "Restock Kemang for the weekend",
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      completedAt: null,
      items: [
        { id: "sti-1", productId: "p1", productName: "Espresso", quantity: 24 },
        { id: "sti-2", productId: "p10", productName: "Butter Croissant", quantity: 12 },
      ],
    },
    {
      id: "st-2",
      fromOutletId: "o2",
      toOutletId: "o1",
      status: "completed",
      notes: null,
      createdAt: new Date(Date.now() - 26 * 3600000).toISOString(),
      completedAt: new Date(Date.now() - 25 * 3600000).toISOString(),
      items: [{ id: "sti-3", productId: "p9", productName: "Jasmine Silver Needle", quantity: 6 }],
    },
  ],
  stocktakes: [
    {
      id: "stk-1",
      outletId: "o1",
      status: "in_progress",
      notes: "Weekly count — bar",
      createdAt: new Date(Date.now() - 30 * 3600000).toISOString(),
      completedAt: null,
      items: [
        {
          id: "stki-1",
          productId: "p1",
          productName: "Espresso",
          sku: "COF-ESP-01",
          expectedQuantity: 128,
          countedQuantity: 126,
        },
        {
          id: "stki-2",
          productId: "p2",
          productName: "Cappuccino",
          sku: "COF-CAP-01",
          expectedQuantity: 86,
          countedQuantity: 86,
        },
      ],
    },
  ],
  adminBusinesses: [
    {
      id: "b1",
      name: mockBusiness.name,
      slug: "velora-demo",
      businessStatus: "active",
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      subscription: {
        id: "sub-1",
        status: "active",
        billingPeriod: "monthly",
        plan: "basic",
        planName: "Basic",
        trialEndsAt: null,
        endsAt: new Date(Date.now() + 21 * 86400000).toISOString(),
        daysRemaining: 21,
        cancelAtPeriodEnd: false,
        pendingPlan: null,
      },
      usage: { products: 16, customers: 12, outlets: 2, users: 4, transactionsPerMonth: 340 },
    },
    {
      id: "b2",
      name: "Copper & Co",
      slug: "copper-and-co",
      businessStatus: "active",
      createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
      subscription: {
        id: "sub-2",
        status: "trialing",
        billingPeriod: "monthly",
        plan: "trial",
        planName: "Free Trial",
        trialEndsAt: new Date(Date.now() + 4 * 86400000).toISOString(),
        endsAt: new Date(Date.now() + 4 * 86400000).toISOString(),
        daysRemaining: 4,
        cancelAtPeriodEnd: false,
        pendingPlan: null,
      },
      usage: { products: 42, customers: 118, outlets: 1, users: 2, transactionsPerMonth: 96 },
    },
    {
      id: "b3",
      name: "Kopi Kecil",
      slug: "kopi-kecil",
      businessStatus: "active",
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      subscription: {
        id: "sub-3",
        status: "past_due",
        billingPeriod: "yearly",
        plan: "pro",
        planName: "Pro",
        trialEndsAt: null,
        endsAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        daysRemaining: 0,
        cancelAtPeriodEnd: true,
        pendingPlan: null,
      },
      usage: { products: 210, customers: 640, outlets: 3, users: 9, transactionsPerMonth: 1180 },
    },
  ],
  allPlans: [{ id: "1", slug: "trial", name: "Free Trial" }, { id: "2", slug: "basic", name: "Basic" }, { id: "3", slug: "pro", name: "Pro" }],
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

const ORDER_PREFIX: Record<OrderType, string> = {
  dine_in: "DI",
  takeaway: "TA",
  delivery: "DL",
  pickup: "PU",
};

/** Mirrors the backend order-number format: OUTLET-TYPE-YYYYMMDD-###. */
export function mockNextOrderNumber(outletId: string, orderType: OrderType, at = new Date()) {
  const outlet = mockDb.outlets.find((entry) => entry.id === outletId);
  const code = (outlet?.code || outlet?.name || "OUT")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const stamp = (() => {
    const date = new Date(at);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  })();
  const prefix = `${code}-${ORDER_PREFIX[orderType]}-${stamp}-`;
  const used = mockDb.orders.filter((order) => order.orderNumber?.startsWith(prefix)).length;
  return `${prefix}${String(used + 1).padStart(3, "0")}`;
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

export function mockIngredientBalance(outletId: string, ingredientId: string) {
  return mockDb.ingredientBalances[`${outletId}:${ingredientId}`] ?? 0;
}

/** Effective recipe for a product, with variant lines overriding base lines. */
export function mockRecipeLines(productId: string, variantId?: string) {
  const base = mockDb.recipeItems.filter((item) => item.productId === productId && !item.productVariantId);
  const overrides = variantId
    ? mockDb.recipeItems.filter(
        (item) => item.productId === productId && item.productVariantId === variantId
      )
    : [];

  const resolved = new Map<string, (typeof mockDb.recipeItems)[number]>();
  for (const item of base) resolved.set(item.ingredientId, item);
  for (const item of overrides) resolved.set(item.ingredientId, item);

  return [...resolved.values()].map((item) => {
    const ingredient = mockDb.ingredients.find((entry) => entry.id === item.ingredientId);
    const effective = item.quantity * (1 + (item.wastePercent ?? 0) / 100);
    const unitCost = ingredient?.costPerUnit ?? 0;
    return { item, ingredient, effective, lineCost: effective * unitCost };
  });
}

export function mockRecipeCost(productId: string, variantId?: string) {
  return mockRecipeLines(productId, variantId).reduce((sum, line) => sum + line.lineCost, 0);
}

/** Deduct ingredient stock for a mock sale and log movement rows. */
export function consumeMockIngredients(
  productId: string,
  variantId: string | undefined,
  quantity: number,
  outletId: string,
  referenceId: string,
  referenceLabel: string
) {
  for (const line of mockRecipeLines(productId, variantId)) {
    if (!line.ingredient?.trackInventory) continue;
    const key = `${outletId}:${line.ingredient.id}`;
    const consumed = line.effective * quantity;
    const balance = Math.max(0, (mockDb.ingredientBalances[key] ?? 0) - consumed);
    mockDb.ingredientBalances[key] = Number(balance.toFixed(4));
    mockDb.ingredientMovements.unshift({
      id: mockId("im"),
      ingredientId: line.ingredient.id,
      ingredientName: line.ingredient.name,
      outletId,
      type: "consumption",
      quantity: Number((-consumed).toFixed(4)),
      unitCost: line.ingredient.costPerUnit,
      balanceAfter: mockDb.ingredientBalances[key],
      referenceType: "sale",
      referenceId,
      reason: `Sale ${referenceLabel}`,
      createdAt: new Date().toISOString(),
    });
  }
}

/** Restore ingredient stock when a mock sale is voided. */
export function reverseMockIngredients(referenceId: string, reason: string) {
  const consumed = mockDb.ingredientMovements.filter(
    (movement) =>
      movement.referenceType === "sale" &&
      movement.referenceId === referenceId &&
      movement.type === "consumption"
  );

  for (const movement of consumed) {
    const key = `${movement.outletId}:${movement.ingredientId}`;
    const restored = Math.abs(movement.quantity);
    mockDb.ingredientBalances[key] = Number(((mockDb.ingredientBalances[key] ?? 0) + restored).toFixed(4));
    mockDb.ingredientMovements.unshift({
      id: mockId("im"),
      ingredientId: movement.ingredientId,
      ingredientName: movement.ingredientName,
      outletId: movement.outletId,
      type: "void",
      quantity: restored,
      unitCost: movement.unitCost,
      balanceAfter: mockDb.ingredientBalances[key],
      referenceType: "sale",
      referenceId,
      reason,
      createdAt: new Date().toISOString(),
    });
  }
}
