import type {
  Customer,
  Employee,
  InventoryMovement,
  Product,
  PurchaseOrder,
  Supplier,
  Transaction,
} from "./types";

type MockStore = typeof import("./mock-db").mockDb;

const longName = "Aleksandra Wiśniewska-Kowalczyk";
const longEmail = "bartholomew.fitzgerald@northwind-industries-holdings.example.com";
const longProduct =
  "Limited Edition Barrel-Aged Vanilla Bean Cold Brew Concentrate — 1 Litre Bottle";
const longAddress =
  "Jl. Jenderal Sudirman Kaveling 52-53, Lot 8, Level 12, Unit 1204, Jakarta Selatan 12190, Indonesia";

function isoDaysAgo(days: number, hour = 9, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function worstCustomer(): Customer {
  return {
    id: "cu-worst-emoji",
    name: "🙂",
    phone: "+62 812 3456 7890 ext. 1042",
    email: "",
    address: longAddress,
    loyaltyNumber: "VLR-0000000000000000000000000000000001",
    loyaltyPoints: 1_284_000,
    notes: "Allergic to dairy. Prefers oat milk. Corporate account with monthly invoicing.",
    createdAt: isoDaysAgo(2, 10, 30),
  };
}

function worstProduct(): Product {
  return {
    id: "p-worst-long",
    name: longProduct,
    sku: "BEV-CB-VAN-BARREL-AGED-1L",
    categoryId: "c-worst",
    categoryName: "Single-Origin Reserve & Limited Seasonal Releases",
    price: 1_250_000,
    cost: 987_650,
    taxRate: 11,
    stockByOutlet: { o1: 1, o2: 0 },
    active: true,
    trackInventory: true,
    unit: "bottle",
  };
}

function worstSupplier(): Supplier {
  return {
    id: "s-worst-long",
    name: "Northwind Industries Holdings — Coffee, Tea & Dry Goods Distribution (Indonesia)",
    contact: "Bartholomew Fitzgerald-Montgomery",
    email: longEmail,
    phone: "+62 21 555 0100 ext. 9987",
    address: longAddress,
  };
}

function worstEmployees(): Employee[] {
  return Array.from({ length: 55 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      id: `e-worst-${number}`,
      userId: `u-worst-${number}`,
      name: index === 0 ? longName : `Staff Member ${number}`,
      email:
        index === 0
          ? longEmail
          : `staff.member.${number}@northwind-industries-holdings.example.com`,
      role: index % 4 === 0 ? "Assistant Store Manager — Opening Shift & Inventory Control" : "Cashier",
      roleId: index % 4 === 0 ? "r2" : "r3",
      outlets: ["o1"],
      active: index % 7 !== 0,
      status: index % 7 === 0 ? "inactive" : "active",
      joinedAt: isoDaysAgo(index + 3, 9, 0),
    };
  });
}

function worstPo(store: MockStore): PurchaseOrder {
  const template = store.purchaseOrders[0];
  const items = Array.from({ length: 9 }, (_, index) => ({
    id: `po-worst-line-${index + 1}`,
    productId: index === 0 ? "p-worst-long" : `p${(index % 16) + 1}`,
    productName: index === 0 ? longProduct : store.products[index % store.products.length]?.name ?? "Product",
    quantity: index === 0 ? 128_400 : (index + 1) * 12,
    receivedQuantity: index === 0 ? 64_200 : 0,
    cost: index === 0 ? 987_650 : (index + 1) * 7_800,
  }));
  return {
    ...(template ?? {
      id: "po-worst",
      number: "PO-2026-9999",
      supplierId: "s-worst-long",
      outletId: "o1",
      status: "partial",
      createdAt: isoDaysAgo(1),
    }),
    id: "po-worst",
    number: "PO-2026-9999",
    supplierName: "Northwind Industries Holdings — Coffee, Tea & Dry Goods Distribution (Indonesia)",
    status: "partial",
    items,
    total: items.reduce((sum, item) => sum + item.quantity * item.cost, 0),
    expectedAt: isoDaysAgo(-12),
    createdAt: isoDaysAgo(1),
    approvedAt: isoDaysAgo(1),
  };
}

function worstTransaction(store: MockStore): Transaction {
  const template = store.transactions[0];
  const total = 1_250_000_000;
  return {
    ...(template ?? {
      id: "tx-worst",
      receiptNumber: "R-20261027-9999",
      outletId: "o1",
      cashierId: "u1",
      createdAt: isoDaysAgo(0),
      status: "completed",
      paymentStatus: "paid",
    }),
    id: "tx-worst",
    receiptNumber: "R-20261027-9999",
    outletId: "o1",
    outletName: "Sudirman Flagship & Roastery — Jakarta Selatan",
    cashierId: "u2",
    cashierName: longName,
    customerId: "cu-worst-emoji",
    customerName: "🙂",
    items: [
      {
        productId: "p-worst-long",
        name: longProduct,
        sku: "BEV-CB-VAN-BARREL-AGED-1L",
        quantity: 1,
        unitPrice: total,
        discount: 0,
        lineTotal: total,
      },
    ],
    subtotal: total,
    discount: 0,
    tax: 0,
    total,
    paymentStatus: "paid",
    status: "completed",
    payments: [
      {
        id: "pay-worst",
        method: "Credit card",
        amount: total,
        status: "completed",
        reference: "NW-998877665544332211",
        createdAt: isoDaysAgo(0),
      },
    ],
    notes:
      "Corporate catering order for a 250-person offsite. Deliver to loading dock B. Contact reception on arrival.",
    createdAt: isoDaysAgo(0, 8, 45),
  };
}

/** Adds a realistic adversarial dataset to the mock store without touching
 * production records. Used only by the dev-only mock fixture toggle. */
export function applyWorstCase(store: MockStore) {
  store.business.name = "Velora Coffee Roasters & Provisions — Sudirman Flagship";
  store.business.address = longAddress;

  if (store.outlets[0]) {
    store.outlets[0].name = "Sudirman Flagship & Roastery";
    store.outlets[0].address = longAddress;
  }

  if (store.customers[0]) {
    store.customers[0].name = longName;
    store.customers[0].email = longEmail;
    store.customers[0].address = longAddress;
    store.customers[0].phone = "+62 812 3456 7890 ext. 1042";
  }
  if (store.customers[1]) {
    store.customers[1].name = "Jo";
    store.customers[1].email = "jo@example.com";
    store.customers[1].loyaltyPoints = 0;
    store.customers[1].loyaltyNumber = undefined;
  }
  if (store.customers[2]) {
    store.customers[2].name = "Mohammad Abdul-Rahman bin Iskandar Montgomery III";
    store.customers[2].email =
      "analytics.and.operations@subdomain.northwind-industries-holdings.example.com";
  }
  store.customers.unshift(worstCustomer());

  if (store.products[0]) store.products[0].name = "Espresso — Single Origin, Honey Process, Limited Reserve 2026";
  if (store.products[1]) store.products[1].name = "Cappuccino with Extra Long Descriptive Name for the Seasonal Menu";
  store.categories.unshift({
    id: "c-worst",
    name: "Single-Origin Reserve & Limited Seasonal Releases",
    productCount: 1,
  });
  store.products.unshift(worstProduct());
  if (store.products[2]) {
    store.products[2].barcode = undefined;
    store.products[2].imageUrl = undefined;
  }

  store.suppliers.unshift(worstSupplier());

  if (store.employees[0]) {
    store.employees[0].name = "Kendra Admin — Group Operations Director";
    store.employees[0].email = longEmail;
  }
  if (store.employees[1]) {
    store.employees[1].name = longName;
    store.employees[1].email = longEmail;
  }
  if (store.employees[2]) {
    store.employees[2].name = "Jo";
    store.employees[2].email = "jo@velora.test";
    store.employees[2].status = "invited";
    store.employees[2].active = false;
  }
  store.employees.push(...worstEmployees());

  if (store.taxRates[0]) {
    store.taxRates[0].name = "Value Added Tax (PPN) for imported roasted coffee beans and equipment";
  }

  store.transactions.unshift(worstTransaction(store));
  store.purchaseOrders.unshift(worstPo(store));

  if (store.movements[0]) {
    store.movements[0].productName = longProduct;
    store.movements[0].quantity = 128_400;
    store.movements[0].reason =
      "Opening balance for the limited seasonal release received against a multi-outlet transfer";
    store.movements[0].createdBy = longName;
  }
  const extraMovements: InventoryMovement[] = Array.from({ length: 24 }, (_, index) => ({
    id: `m-worst-${index + 1}`,
    productId: "p-worst-long",
    productName: longProduct,
    outletId: index % 2 === 0 ? "o1" : "o2",
    type: index % 3 === 0 ? "adjustment" : "receive",
    quantity: index % 3 === 0 ? -(index + 1) : 128_400,
    reason: index % 3 === 0 ? "Count correction after a full physical inventory" : "Seasonal release receipt",
    balanceAfter: 128_400 - index,
    createdAt: isoDaysAgo(index, 9, index),
    createdBy: index % 2 === 0 ? "Jo" : longName,
  }));
  store.movements.unshift(...extraMovements);
}
