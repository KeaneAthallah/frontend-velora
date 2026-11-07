"use client";

export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Check,
  ChevronRight,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  UserRoundPlus,
  Wallet,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Badge,
  Button,
  ChipButton,
  EmptyState,
  Field,
  InfoTip,
  Input,
  Select,
  Spinner,
} from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { AccessDenied } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { listCategories, listProducts } from "@/lib/api/products";
import { getMenu } from "@/lib/api/menu";
import { listPaymentMethods } from "@/lib/api/payments";
import { previewPromotion } from "@/lib/api/promotions";
import { getLoyaltyProgram } from "@/lib/api/loyalty";
import { listTaxRates } from "@/lib/api/tax";
import { checkout, type CheckoutRequest } from "@/lib/api/sales";
import { isNetworkError } from "@/lib/api/client";
import { enqueueQueuedSale, queuedSaleTotal, type QueuedSale } from "@/lib/offline/queue";
import { useOffline } from "@/lib/offline/provider";
import { checkoutOrder, createOrder, getOrder, updateOrder } from "@/lib/api/orders";
import { listCustomers } from "@/lib/api/customers";
import { stockByOutlet } from "@/lib/api/inventory";
import { getRecipeAvailability } from "@/lib/api/ingredients";
import { listFloorPlan } from "@/lib/api/tables";
import type {
  Customer,
  LoyaltyProgram,
  ModifierGroup,
  OrderFulfilment,
  OrderType,
  Product,
  PromotionPreview,
  TaxRate,
  Transaction,
} from "@/lib/api/types";
import { formatCurrency, formatNumber, formatRelative } from "@/lib/formatting/currency";
import { initials } from "@/components/ui/primitives";
import { useBusiness } from "@/lib/business/context";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useDebouncedValue, useSearchParamState, replaceSearchParam } from "@/lib/use-debounced";

type CartLine = {
  key: string;
  productId: string;
  optionIds: string[];
  optionSummary?: string;
  name: string;
  sku: string;
  unit: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  trackInventory: boolean;
  stock: number;
};

type SplitLine = {
  id: string;
  method: string;
  amount: string;
  reference: string;
};

function lineKey(productId: string, optionIds: string[]) {
  return optionIds.length ? `${productId}|${[...optionIds].sort().join(",")}` : productId;
}

function selectedDelta(groups: ModifierGroup[], optionIds: string[]) {
  const selected = new Set(optionIds);
  return groups
    .flatMap((group) => group.options)
    .filter((option) => selected.has(option.id))
    .reduce((sum, option) => sum + option.priceDelta, 0);
}

function defaultSelection(groups: ModifierGroup[]): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const group of groups) {
    if (group.selectionType === "single") {
      const preferred =
        group.options.find((option) => option.isDefault && option.available) ??
        (group.isRequired ? group.options.find((option) => option.available) : undefined);
      next[group.id] = preferred ? [preferred.id] : [];
    } else {
      next[group.id] = group.options
        .filter((option) => option.isDefault && option.available)
        .map((option) => option.id);
    }
  }
  return next;
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  cash: <Banknote aria-hidden="true" />,
  qris: <QrCode aria-hidden="true" />,
  debit_card: <CreditCard aria-hidden="true" />,
  credit_card: <Wallet aria-hidden="true" />,
  ewallet: <Wallet aria-hidden="true" />,
  transfer: <Banknote aria-hidden="true" />,
};

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: "dine_in", label: "Dine in" },
  { value: "takeaway", label: "Takeaway" },
  { value: "delivery", label: "Delivery" },
  { value: "pickup", label: "Pickup" },
];

const EMPTY_FULFILMENT: OrderFulfilment = {
  contactName: "",
  contactPhone: "",
  address: "",
  instructions: "",
};

/**
 * A checkout that could not reach the API and was stored on the device instead.
 * Carries the queue entry so the caller can confirm what was kept.
 */
class QueuedSaleError extends Error {
  readonly entry: QueuedSale;

  constructor(entry: QueuedSale) {
    super("The sale was saved on this device");
    this.name = "QueuedSaleError";
    this.entry = entry;
  }
}

function cartStorageKey(outletId: string | null) {
  return `velora_pos_cart_${outletId ?? "default"}`;
}

function splitLineId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `split-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readCart(outletId: string | null): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(cartStorageKey(outletId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((line) => line && typeof line.productId === "string" && Number(line.quantity) > 0)
      .map((line) => ({
        key: String(line.key ?? line.productId),
        productId: String(line.productId),
        optionIds: Array.isArray(line.optionIds) ? line.optionIds.map(String) : [],
        optionSummary: typeof line.optionSummary === "string" ? line.optionSummary : undefined,
        name: String(line.name ?? "Product"),
        sku: String(line.sku ?? ""),
        unit: String(line.unit ?? "pcs"),
        basePrice: Number(line.basePrice ?? line.unitPrice ?? 0),
        unitPrice: Number(line.unitPrice ?? 0),
        quantity: Math.max(1, Number(line.quantity ?? 1)),
        trackInventory: line.trackInventory !== false,
        stock: Number(line.stock ?? 0),
      }));
  } catch {
    return [];
  }
}

function productMonogramTone(product: Product): string {
  const cat = (product.categoryName || "").toLowerCase();
  const name = product.name.toLowerCase();
  if (
    cat.includes("tea") ||
    cat.includes("matcha") ||
    cat.includes("cold") ||
    cat.includes("beverage") ||
    cat.includes("juice") ||
    name.includes("tea") ||
    name.includes("matcha")
  ) {
    return "sq--green";
  }
  if (
    cat.includes("food") ||
    cat.includes("pastry") ||
    cat.includes("bakery") ||
    cat.includes("snack") ||
    cat.includes("croissant") ||
    cat.includes("nasi") ||
    cat.includes("mie") ||
    cat.includes("pisang")
  ) {
    return "sq--amber";
  }
  return "sq--purple";
}

export default function SalesPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId, outlet } = useBusiness();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const { online } = useOffline();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [cartLoaded, setCartLoaded] = React.useState(false);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [customerOpen, setCustomerOpen] = React.useState(false);
  const [promoCode, setPromoCode] = React.useState("");
  const [redeemPoints, setRedeemPoints] = React.useState("");
  const [discounts, setDiscounts] = React.useState<{ code: string; points: number } | null>(null);
  const [promoPreview, setPromoPreview] = React.useState<PromotionPreview | null>(null);
  const [promoError, setPromoError] = React.useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState("cash");
  const [payReference, setPayReference] = React.useState("");
  const [splitOpen, setSplitOpen] = React.useState(false);
  const [splitLines, setSplitLines] = React.useState<SplitLine[]>([]);
  const [success, setSuccess] = React.useState<Transaction | null>(null);
  const [queuedSale, setQueuedSale] = React.useState<QueuedSale | null>(null);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [offlineResumeOpen, setOfflineResumeOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [picker, setPicker] = React.useState<{ product: Product; groups: ModifierGroup[] } | null>(null);
  const [orderType, setOrderType] = React.useState<OrderType>("dine_in");
  const [tableId, setTableId] = React.useState("");
  const [fulfilment, setFulfilment] = React.useState<OrderFulfilment>(EMPTY_FULFILMENT);
  const [resumedOrder, setResumedOrder] = React.useState<Transaction | null>(null);
  // On phones the cart becomes a bottom sheet; on wider screens it is always visible.
  const [cartOpen, setCartOpen] = React.useState(false);
  const [orderParam, setOrderParam, orderParamReady] = useSearchParamState("order");
  const [tableParam, setTableParam, tableParamReady] = useSearchParamState("table");

  const searchRef = React.useRef<HTMLInputElement>(null);
  const checkoutKeyRef = React.useRef<string | null>(null);
  const saveKeyRef = React.useRef<string | null>(null);
  const loadedKeyRef = React.useRef<string | null>(null);
  const hydratedOrderRef = React.useRef<string | null>(null);

  const currency = session?.business.currency ?? "IDR";

  React.useEffect(() => {
    if (!cartOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen]);

  React.useEffect(() => {
    const stored = readCart(outletId);
    setCart(stored);
    setCustomer(null);
    loadedKeyRef.current = cartStorageKey(outletId);
    setCartLoaded(true);
  }, [outletId]);

  React.useEffect(() => {
    if (!cartLoaded) return;
    if (resumedOrder) return;
    const key = cartStorageKey(outletId);
    if (loadedKeyRef.current !== key) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(cart));
    } catch {
      /* Private browsing storage may be unavailable; the register still works in memory. */
    }
  }, [cart, cartLoaded, outletId, resumedOrder]);

  React.useEffect(() => {
    checkoutKeyRef.current = null;
  }, [cart, customer?.id]);

  const productsQuery = useQuery({
    queryKey: ["pos-products", outletId],
    queryFn: () => listProducts({ activeOnly: true, pageSize: 200 }),
    enabled: has("sales.create") && Boolean(outletId),
    staleTime: 60_000,
  });

  const stockQuery = useQuery({
    queryKey: ["pos-stock", outletId],
    queryFn: () => stockByOutlet(outletId!),
    enabled: has("sales.create") && Boolean(outletId),
    staleTime: 30_000,
  });

  // Recipe-based cap: how many units this outlet's ingredients can still make.
  // The server refuses an oversell anyway; this keeps the cart honest first.
  const availabilityQuery = useQuery({
    queryKey: ["pos-availability", outletId],
    queryFn: () => getRecipeAvailability(outletId ?? undefined),
    enabled: has("sales.create") && Boolean(outletId),
    staleTime: 30_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
    enabled: has("sales.create"),
    staleTime: 5 * 60_000,
  });

  const menuQuery = useQuery({
    queryKey: ["pos-menu", outletId],
    queryFn: () => getMenu(outletId!),
    enabled: has("sales.create") && has("menu.view") && Boolean(outletId),
    staleTime: 30_000,
  });

  const methodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => listPaymentMethods(),
    enabled: has("sales.create"),
    staleTime: 5 * 60_000,
  });

  const taxQuery = useQuery({
    queryKey: ["tax-rates"],
    queryFn: listTaxRates,
    enabled: has("sales.create"),
    staleTime: 60_000,
  });

  const loyaltyQuery = useQuery({
    queryKey: ["loyalty-program"],
    queryFn: getLoyaltyProgram,
    enabled: has("sales.create") && has("loyalty.view"),
    staleTime: 5 * 60_000,
  });
  const loyalty: LoyaltyProgram | null = loyaltyQuery.data ?? null;

  const tablesQuery = useQuery({
    queryKey: ["floor-plan", outletId, "pos"],
    queryFn: () => listFloorPlan({ outletId: outletId ?? undefined }),
    enabled: has("tables.view") && Boolean(outletId) && orderType === "dine_in",
    staleTime: 15_000,
  });

  React.useEffect(() => {
    if (!tableParamReady || !tableParam) return;
    if (orderParam) return;
    setTableId(tableParam);
    setOrderType("dine_in");
    setTableParam("");
    replaceSearchParam("table", "");
  }, [tableParamReady, tableParam, orderParam, setTableParam]);

  React.useEffect(() => {
    if (orderType !== "dine_in") setTableId("");
  }, [orderType]);

  const resumeQuery = useQuery({
    queryKey: ["pos-order", orderParam],
    queryFn: () => getOrder(orderParam),
    enabled: orderParamReady && Boolean(orderParam) && has("sales.create"),
    staleTime: 0,
    retry: 1,
  });

  React.useEffect(() => {
    const order = resumeQuery.data;
    if (!order || hydratedOrderRef.current === order.id) return;
    hydratedOrderRef.current = order.id;
    setResumedOrder(order);
    setOrderType(order.orderType ?? "dine_in");
    setTableId(order.tableId ?? "");
    setFulfilment({ ...EMPTY_FULFILMENT, ...(order.fulfilment ?? {}) });
    setCustomer(
      order.customerId
        ? {
            id: order.customerId,
            name: order.customerName ?? "Customer",
            phone: "",
            loyaltyPoints: 0,
            createdAt: order.createdAt,
          }
        : null
    );
    setPromoCode(order.promotionCode ?? "");
    setRedeemPoints(order.loyaltyPointsRedeemed ? String(order.loyaltyPointsRedeemed) : "");
    setDiscounts(
      order.promotionCode || order.loyaltyPointsRedeemed
        ? { code: order.promotionCode ?? "", points: order.loyaltyPointsRedeemed ?? 0 }
        : null
    );
    setCart(
      order.items
        .filter((item) => item.productId)
        .map((item) => ({
          key: lineKey(item.productId!, item.optionIds ?? []),
          productId: item.productId!,
          optionIds: item.optionIds ?? [],
          name: item.name,
          sku: item.sku,
          unit: "pcs",
          basePrice: item.unitPrice,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          trackInventory: false,
          stock: Number.MAX_SAFE_INTEGER,
        }))
    );
  }, [resumeQuery.data]);

  const stockMap = React.useMemo(
    () => new Map((stockQuery.data ?? []).map((row) => [row.productId, row.stock])),
    [stockQuery.data]
  );

  const availabilityMap = React.useMemo(
    () => new Map((availabilityQuery.data ?? []).map((row) => [row.productId, row])),
    [availabilityQuery.data]
  );

  /** Units the outlet can still make, or null when no tracked ingredient limits it. */
  const sellableFor = (productId: string): number | null => {
    const row = availabilityMap.get(productId);
    if (!row || row.unlimited || row.sellable === null) return null;
    return row.sellable;
  };

  const products = React.useMemo(() => productsQuery.data?.data ?? [], [productsQuery.data]);

  const menuById = React.useMemo(
    () => new Map((menuQuery.data?.products ?? []).map((product) => [product.id, product])),
    [menuQuery.data]
  );

  React.useEffect(() => {
    if (!productsQuery.data) return;
    const byId = new Map(products.map((product) => [product.id, product]));
    setCart((current) => {
      let changed = false;
      const next = current.map((line) => {
        const product = byId.get(line.productId);
        if (!product) return line;
        const stock = stockMap.has(product.id) ? (stockMap.get(product.id) as number) : line.stock;
        const groups = menuById.get(product.id)?.modifierGroups ?? [];
        const delta = groups.length ? selectedDelta(groups, line.optionIds) : null;
        const basePrice = product.price;
        const unitPrice =
          delta !== null && line.optionIds.length ? basePrice + delta : line.optionIds.length ? line.unitPrice : basePrice;
        if (
          product.name === line.name &&
          unitPrice === line.unitPrice &&
          product.sku === line.sku &&
          stock === line.stock
        ) {
          return line;
        }
        changed = true;
        return {
          ...line,
          name: product.name,
          sku: product.sku,
          unit: product.unit ?? line.unit,
          basePrice,
          unitPrice,
          trackInventory: product.trackInventory !== false,
          stock,
        };
      });
      return changed ? next : current;
    });
  }, [productsQuery.data, products, stockMap, menuById]);

  React.useEffect(() => {
    if (!paymentMethod && methodsQuery.data?.length) {
      setPaymentMethod(methodsQuery.data[0].code);
    }
  }, [methodsQuery.data, paymentMethod]);

  React.useEffect(() => {
    if (!splitLines.length || !methodsQuery.data?.length) return;
    const active = methodsQuery.data.filter((method) => method.active);
    if (!active.length) return;
    setSplitLines((lines) => {
      let changed = false;
      const next = lines.map((line) => {
        if (active.some((method) => method.code === line.method)) return line;
        changed = true;
        return { ...line, method: active[0].code };
      });
      return changed ? next : lines;
    });
  }, [methodsQuery.data, splitLines.length]);

  const taxRate: TaxRate | null = React.useMemo(
    () => taxQuery.data?.find((rate) => rate.isDefault && rate.isActive) ?? null,
    [taxQuery.data]
  );

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return products
      .filter((product) => (category === "all" ? true : product.categoryId === category))
      .filter((product) => {
        if (!query) return true;
        return (
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) ||
          (product.barcode ?? "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, category, search]);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const tax = React.useMemo(() => {
    if (!taxRate) return 0;
    if (taxRate.type === "inclusive") {
      return Math.round(subtotal - subtotal / (1 + taxRate.rate / 100));
    }
    return Math.round(subtotal * (taxRate.rate / 100));
  }, [subtotal, taxRate]);
  const total = taxRate?.type === "exclusive" ? subtotal + tax : subtotal;

  const effectiveTotal = promoPreview?.total ?? total;
  const effectiveTax = promoPreview?.tax ?? tax;
  const promotionDiscount = promoPreview?.promotionDiscount ?? 0;
  const loyaltyDiscount = promoPreview?.loyaltyDiscount ?? 0;

  React.useEffect(() => {
    if (!discounts || !cart.length) {
      setPromoPreview(null);
      setPromoError(null);
      return;
    }

    let cancelled = false;
    previewPromotion({
      items: cart.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        optionIds: line.optionIds,
      })),
      promotionCode: discounts.code || undefined,
      customerId: customer?.id,
      redeemPoints: discounts.points || 0,
    })
      .then((preview) => {
        if (cancelled) return;
        setPromoPreview(preview);
        setPromoError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setPromoPreview(null);
        setPromoError(error instanceof Error ? error.message : "These discounts could not be applied");
      });

    return () => {
      cancelled = true;
    };
  }, [cart, customer?.id, discounts]);

  const clearDiscounts = () => {
    setPromoCode("");
    setRedeemPoints("");
    setDiscounts(null);
    setPromoPreview(null);
    setPromoError(null);
  };

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const methods = methodsQuery.data ?? [];
  const selectedMethod = methods.find((method) => method.code === paymentMethod);
  const usingSplit = splitOpen && splitLines.length > 0;
  const splitTendered = splitLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const splitCash = splitLines.reduce((sum, line) => {
    const method = methods.find((entry) => entry.code === line.method);
    const amount = Number(line.amount) || 0;
    return (method?.type === "cash" || line.method === "cash") && amount > 0 ? sum + amount : sum;
  }, 0);
  const tendered = usingSplit ? splitTendered : effectiveTotal;
  const remaining = Math.max(0, effectiveTotal - tendered);
  const change = Math.max(0, tendered - effectiveTotal);
  const changeInvalid = change > 0.005 && change > splitCash + 0.005;
  const shortPaid = usingSplit && remaining > 0.005;

  const tableOptions = (tablesQuery.data?.tables ?? []).filter(
    (table) =>
      table.isActive &&
      table.manualStatus !== "cleaning" &&
      (!table.occupied || table.id === resumedOrder?.tableId)
  );
  const tableLabel =
    tablesQuery.data?.tables.find((table) => table.id === tableId)?.name ??
    (resumedOrder?.tableId === tableId ? resumedOrder.tableName : undefined) ??
    (tableId ? "Selected table" : undefined);

  const fulfillmentFilled = Boolean(
    fulfilment.contactName?.trim() ||
      fulfilment.contactPhone?.trim() ||
      fulfilment.address?.trim() ||
      fulfilment.instructions?.trim()
  );
  const deliveryInvalid =
    orderType === "delivery" && (!fulfilment.contactPhone?.trim() || !fulfilment.address?.trim());

  const cleanFulfilment = (): OrderFulfilment | undefined => {
    if (!fulfillmentFilled) return undefined;
    return {
      contactName: fulfilment.contactName?.trim() || undefined,
      contactPhone: fulfilment.contactPhone?.trim() || undefined,
      address: fulfilment.address?.trim() || undefined,
      instructions: fulfilment.instructions?.trim() || undefined,
    };
  };

  const orderItems = () =>
    cart.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      discount: 0,
      optionIds: line.optionIds,
    }));

  const exitResume = () => {
    setResumedOrder(null);
    setOrderParam("");
    replaceSearchParam("order", "");
    setCart([]);
    setCustomer(null);
    setFulfilment(EMPTY_FULFILMENT);
    setOrderType("dine_in");
    setTableId("");
    checkoutKeyRef.current = null;
    saveKeyRef.current = null;
    resetPayment();
  };

  const posPayments = () => {
    if (usingSplit) {
      return splitLines
        .map((line) => ({
          method: line.method,
          amount: Number(line.amount) || 0,
          reference: line.reference.trim() || undefined,
        }))
        .filter((line) => line.amount > 0);
    }
    return [
      {
        method: paymentMethod,
        amount: effectiveTotal,
        reference: payReference.trim() || undefined,
      },
    ];
  };

  const resetPayment = () => {
    setSplitOpen(false);
    setSplitLines([]);
    setPayReference("");
    clearDiscounts();
  };

  const mutation = useMutation({
    // The default "online" mode would park the mutation in memory until the
    // connection returns, which loses it on a reload. Run it while offline so
    // the register can hand the sale to the durable queue instead.
    networkMode: "always",
    mutationFn: async (): Promise<Transaction> => {
      if (!outletId || !session) throw new Error("A cashier and outlet are required");
      if (!cart.length) throw new Error("Add at least one item to the order");
      if (!paymentMethod) throw new Error("Choose a payment method");
      if (deliveryInvalid) throw new Error("Delivery orders need a contact phone and address");
      if (usingSplit) {
        if (!splitLines.length) throw new Error("Add at least one payment line");
        if (remaining > 0.005) {
          throw new Error(`Payments are ${formatCurrency(remaining, currency)} short of the total`);
        }
        if (changeInvalid) throw new Error("Change can only come back from a cash payment");
      }

      const payments = posPayments();

      if (resumedOrder) {
        const updated = await updateOrder(resumedOrder.id, {
          orderType,
          tableId: orderType === "dine_in" && tableId ? tableId : null,
          fulfilment: cleanFulfilment() ?? null,
          customerId: customer?.id ?? null,
          items: orderItems(),
          promotionCode: discounts?.code ?? null,
          redeemPoints: discounts?.points ?? null,
        });
        return checkoutOrder(updated.id, {
          paymentMethod,
          payments,
          promotionCode: discounts?.code || undefined,
          redeemPoints: discounts?.points || undefined,
        });
      }

      if (!checkoutKeyRef.current) {
        checkoutKeyRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      const request: CheckoutRequest = {
        outletId,
        cashierId: session.user.id,
        customerId: customer?.id,
        items: orderItems(),
        idempotencyKey: checkoutKeyRef.current,
        paymentMethod,
        payments,
        orderType,
        tableId: orderType === "dine_in" && tableId ? tableId : undefined,
        fulfilment: cleanFulfilment(),
        promotionCode: discounts?.code || undefined,
        redeemPoints: discounts?.points || undefined,
      };

      try {
        return await checkout(request);
      } catch (error) {
        // Only a sale that never reached the server may be queued; a refusal
        // (stock, tax, a closed shift) has to be shown to the cashier.
        if (!isNetworkError(error)) throw error;
        // The queued request keeps this idempotency key, so the replay can
        // create the sale at most once however often it is retried.
        const entry = await enqueueQueuedSale(request);
        throw new QueuedSaleError(entry);
      }
    },
    onSuccess: (transaction) => {
      saveCartAfterSuccess();
      setSuccess(transaction);
      setCart([]);
      setCustomer(null);
      setResumedOrder(null);
      setOrderParam("");
      replaceSearchParam("order", "");
      setFulfilment(EMPTY_FULFILMENT);
      setTableId("");
      checkoutKeyRef.current = null;
      saveKeyRef.current = null;
      setActionError(null);
      resetPayment();
      if (transaction.paymentStatus !== "paid") {
        push({
          title: "Sale recorded - payment not recorded",
          description: `${transaction.receiptNumber} was saved without a payment. Void it in Transactions if payment cannot be confirmed.`,
          variant: "warning",
        });
      } else {
        push({
          title: "Sale completed",
          description: `${transaction.receiptNumber} · ${formatCurrency(transaction.total, currency)}`,
          variant: "success",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["floor-plan"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["pos-stock"] });
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      queryClient.invalidateQueries({ queryKey: ["pos-availability"] });
      queryClient.invalidateQueries({ queryKey: ["recipe-availability"] });
      queryClient.invalidateQueries({ queryKey: ["ingredient-usage"] });
      window.setTimeout(() => searchRef.current?.focus(), 100);
    },
    onError: (error) => {
      if (error instanceof QueuedSaleError) {
        // The sale is durable on this device, so the register can serve the
        // next guest. The queue keeps the key; the register drops it.
        saveCartAfterSuccess();
        setCart([]);
        setCustomer(null);
        setResumedOrder(null);
        setOrderParam("");
        replaceSearchParam("order", "");
        setFulfilment(EMPTY_FULFILMENT);
        setTableId("");
        checkoutKeyRef.current = null;
        saveKeyRef.current = null;
        setActionError(null);
        resetPayment();
        setQueuedSale(error.entry);
        push({
          title: "Sale queued offline",
          description: "It is saved on this device and is sent automatically when the connection returns.",
          variant: "warning",
        });
        return;
      }
      setActionError(error instanceof Error ? error.message : "The sale could not be completed");
    },
  });

  const saveOrderMutation = useMutation({
    mutationFn: async () => {
      if (!outletId) throw new Error("Choose an outlet before saving the order");
      if (!cart.length) throw new Error("Add at least one item to the order");
      if (deliveryInvalid) throw new Error("Delivery orders need a contact phone and address");
      if (!saveKeyRef.current) {
        saveKeyRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      return createOrder({
        outletId,
        orderType,
        tableId: orderType === "dine_in" && tableId ? tableId : undefined,
        customerId: customer?.id,
        items: orderItems(),
        fulfilment: cleanFulfilment(),
        idempotencyKey: saveKeyRef.current,
        promotionCode: discounts?.code || undefined,
        redeemPoints: discounts?.points || undefined,
      });
    },
    onSuccess: (order) => {
      push({
        title: "Order saved",
        description: `${order.orderNumber ?? order.receiptNumber} is waiting on the order board.`,
        variant: "success",
      });
      saveCartAfterSuccess();
      setCart([]);
      setCustomer(null);
      setFulfilment(EMPTY_FULFILMENT);
      setOrderType("dine_in");
      setTableId("");
      setActionError(null);
      clearDiscounts();
      saveKeyRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["floor-plan"] });
      window.setTimeout(() => searchRef.current?.focus(), 100);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "The order could not be saved");
    },
  });

  if (!has("sales.create")) {
    return <AccessDenied permission="sales.create" />;
  }

  const addProduct = (product: Product, optionIds: string[] = []) => {
    const stock = stockMap.has(product.id) ? (stockMap.get(product.id) as number) : 0;
    const tracked = product.trackInventory !== false;
    const groups = menuById.get(product.id)?.modifierGroups ?? [];
    const key = lineKey(product.id, optionIds);
    const selected = new Set(optionIds);
    const optionLabels = groups
      .flatMap((group) => group.options)
      .filter((option) => selected.has(option.id))
      .map((option) => option.name);
    const unitPrice = product.price + (optionIds.length ? selectedDelta(groups, optionIds) : 0);

    setCart((current) => {
      const productQty = current
        .filter((line) => line.productId === product.id)
        .reduce((sum, line) => sum + line.quantity, 0);
      const sellable = sellableFor(product.id);
      if (sellable !== null) {
        if (sellable <= 0) {
          push({
            title: "Out of ingredients",
            description: `${product.name} cannot be made at ${outlet?.name ?? "this outlet"} right now.`,
            variant: "warning",
          });
          return current;
        }
        if (productQty >= sellable) {
          push({
            title: "Ingredient limit reached",
            description: `${product.name} can be made ${formatNumber(sellable)} more time${sellable === 1 ? "" : "s"} with the stock on hand.`,
            variant: "warning",
          });
          return current;
        }
      }
      if (tracked && productQty >= stock) {
        push({
          title: "No more stock available",
          description: `${product.name} has ${formatNumber(stock)} ${product.unit ?? "units"} at ${outlet?.name ?? "this outlet"}.`,
          variant: "warning",
        });
        return current;
      }
      if (tracked && stock <= 0) {
        push({ title: "Out of stock", description: `${product.name} cannot be sold at this outlet.`, variant: "warning" });
        return current;
      }
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...current,
        {
          key,
          productId: product.id,
          optionIds,
          optionSummary: optionLabels.length ? optionLabels.join(", ") : undefined,
          name: product.name,
          sku: product.sku,
          unit: product.unit ?? "pcs",
          basePrice: product.price,
          unitPrice,
          quantity: 1,
          trackInventory: tracked,
          stock,
        },
      ];
    });
  };

  const chooseProduct = (product: Product) => {
    const groups = (menuById.get(product.id)?.modifierGroups ?? []).filter((group) => group.options.length > 0);
    if (!groups.length) {
      addProduct(product);
      return;
    }
    setPicker({ product, groups });
  };

  const changeQuantity = (key: string, delta: number) => {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.key !== key) return [line];
        const next = line.quantity + delta;
        if (next <= 0) return [];
        if (line.trackInventory && next > line.stock) {
          push({
            title: "Stock limit reached",
            description: `${line.name} has ${formatNumber(line.stock)} ${line.unit} available.`,
            variant: "warning",
          });
          return [line];
        }
        const sellable = sellableFor(line.productId);
        if (sellable !== null && next > sellable) {
          push({
            title: "Ingredient limit reached",
            description: `${line.name} can be made ${formatNumber(sellable)} time${sellable === 1 ? "" : "s"} with the stock on hand.`,
            variant: "warning",
          });
          return [line];
        }
        return [{ ...line, quantity: next }];
      })
    );
  };

  const removeLine = (key: string) => {
    setCart((current) => current.filter((line) => line.key !== key));
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const query = search.trim().toLowerCase();
    if (!query) return;
    const exact = products.find(
      (product) => product.sku.toLowerCase() === query || (product.barcode ?? "").toLowerCase() === query
    );
    if (exact) {
      chooseProduct(exact);
      setSearch("");
    }
  };

  const openOrder = () => setCartOpen(true);
  const closeOrder = () => setCartOpen(false);

  const setupNeeded = !productsQuery.isLoading && products.length === 0;

  const saveCartAfterSuccess = () => {
    if (!cart.length || !outletId) return;
    try {
      window.sessionStorage.setItem(cartStorageKey(outletId), JSON.stringify(cart));
    } catch {
      /* Same private-browsing carve-out as the cart-lifecycle effect. */
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={resumedOrder ? "Editing open order" : (outlet?.name ?? "Register")}
        title={resumedOrder ? (resumedOrder.orderNumber ?? "Open order") : "New sale"}
        description={
          resumedOrder
            ? "Add or remove items, then charge the guest. Stock moves when the order is finalised."
            : "Build the order, choose how it is served, and take payment. Stock and totals update as you go."
        }
        actions={
          <>
            {has("orders.view") ? (
              <Link href="/orders" className="btn btn--secondary btn--sm">
                Orders
              </Link>
            ) : (
              <Link href="/transactions" className="btn btn--secondary btn--sm">
                Transactions
              </Link>
            )}
            <Button
              variant="secondary"
              className="pos__mobile-order"
              onClick={openOrder}
              disabled={!cart.length}
            >
              <ShoppingBag aria-hidden="true" />
              Order
              <span className="badge badge--brand">{itemCount}</span>
            </Button>
          </>
        }
      />

      {actionError ? (
        <div className="alert alert--danger" role="alert">
          <div>
            <b>That action could not be completed.</b>
            <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
              {actionError}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={() => setActionError(null)} aria-label="Dismiss error">
            <X aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="pos">
        <section className="pos__catalog" aria-label="Product catalog">
          <div className="pos__toolbar">
            <label className="input-affix grow">
              <Search aria-hidden="true" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search or scan a product"
                aria-label="Search the product catalog"
                disabled={productsQuery.isLoading}
                autoComplete="off"
              />
              {search ? (
                <button type="button" className="icon-btn" onClick={() => setSearch("")} aria-label="Clear search">
                  <X aria-hidden="true" />
                </button>
              ) : null}
            </label>
            <span className="hint hide-mobile" style={{ margin: 0, whiteSpace: "nowrap" }}>
              {productsQuery.isLoading ? "Loading" : `${formatNumber(products.length)} active products`}
            </span>
          </div>

          <div className="chips" role="group" aria-label="Filter by category">
            <ChipButton active={category === "all"} onClick={() => setCategory("all")}>
              All
            </ChipButton>
            {(categoriesQuery.data ?? []).map((item) => (
              <ChipButton key={item.id} active={category === item.id} onClick={() => setCategory(item.id)}>
                {item.name}
                <span className="chip__count">{item.productCount}</span>
              </ChipButton>
            ))}
          </div>

          {productsQuery.isError ? (
            <div className="card">
              <EmptyState
                icon={<ShoppingBag aria-hidden="true" />}
                title="The catalog could not be loaded"
                description={productsQuery.error instanceof Error ? productsQuery.error.message : "Try again."}
                actions={
                  <Button variant="secondary" onClick={() => productsQuery.refetch()}>
                    Try again
                  </Button>
                }
              />
            </div>
          ) : productsQuery.isLoading ? (
            <div className="pos__grid" aria-busy="true" aria-label="Loading products">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="product-tile" aria-hidden="true">
                  <div className="product-tile__mono" />
                  <div className="stack-sm">
                    <div className="skeleton" style={{ height: 12, width: "80%" }} />
                    <div className="skeleton" style={{ height: 9, width: "55%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : setupNeeded ? (
            <div className="card">
              <EmptyState
                icon={<ShoppingBag aria-hidden="true" />}
                title="No active products yet"
                description="Add products before taking a sale. Categories and prices are managed in the catalog."
                actions={
                  has("products.manage") ? (
                    <Link href="/products" className="btn btn--primary">
                      Add products
                    </Link>
                  ) : (
                    <span className="hint">Ask a manager to add products to this business.</span>
                  )
                }
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Search aria-hidden="true" />}
                title="No products match"
                description="Try another category or a different name, SKU, or barcode."
                actions={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setCategory("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="pos__grid">
              {filtered.map((product) => {
                const stock = stockMap.has(product.id) ? (stockMap.get(product.id) as number) : 0;
                const tracked = product.trackInventory !== false;
                const menuProduct = menuById.get(product.id);
                const unavailable = menuProduct ? !menuProduct.available : false;
                const inCart = cart
                  .filter((line) => line.productId === product.id)
                  .reduce((sum, line) => sum + line.quantity, 0);
                const out = tracked && stock <= 0;
                const maxed = tracked && stock > 0 && inCart >= stock;
                const sellable = sellableFor(product.id);
                const ingredientOut = sellable !== null && sellable <= 0;
                const ingredientMaxed = sellable !== null && sellable > 0 && inCart >= sellable;
                const blocked = out || maxed || unavailable || ingredientOut || ingredientMaxed;
                return (
                  <button
                    key={product.id}
                    type="button"
                    className="product-tile"
                    onClick={() => chooseProduct(product)}
                    disabled={blocked}
                    aria-label={
                      ingredientOut || out
                        ? `${product.name} is sold out`
                        : ingredientMaxed || maxed
                          ? `${product.name} is at its sellable limit`
                          : `Add ${product.name} to order, ${formatCurrency(product.price, currency)}`
                    }
                  >
                    {inCart && !out && !unavailable ? (
                      <span className="product-tile__qty" aria-hidden="true">
                        {formatNumber(inCart)}
                      </span>
                    ) : null}
                    <span
                      className={`product-tile__mono sq ${out || ingredientOut ? "sq--gray" : productMonogramTone(product)}`}
                      aria-hidden="true"
                    >
                      {initials(product.name)}
                    </span>
                    <div className="product-tile__body">
                      <div className="product-tile__name">{product.name}</div>
                      <div className="product-tile__meta">
                        <span
                          className="product-tile__price"
                          data-off={out || unavailable || ingredientOut ? "true" : undefined}
                        >
                          {formatCurrency(product.price, currency)}
                        </span>
                        {unavailable ? (
                          <span className="product-tile__stock" title={menuProduct?.unavailableReason}>
                            86
                          </span>
                        ) : out || ingredientOut ? (
                          <span className="product-tile__stock" data-low="true">
                            Sold out
                          </span>
                        ) : ingredientMaxed ? (
                          <span className="product-tile__stock" data-low="true">
                            Max {formatNumber(sellable ?? 0)}
                          </span>
                        ) : tracked && stock <= 10 ? (
                          <span className="product-tile__stock" data-low="true">
                            {formatNumber(stock)} {product.unit ?? ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {productsQuery.data && productsQuery.data.total > products.length ? (
            <p className="hint" style={{ margin: 0 }}>
              Showing the first {formatNumber(products.length)} of {formatNumber(productsQuery.data.total)} products.
              Narrow the catalog in Products if an item is missing.
            </p>
          ) : null}
        </section>

        {cartOpen ? (
          <button type="button" className="cart-backdrop" aria-label="Close order" onClick={closeOrder} />
        ) : null}

        <aside
          className="cart"
          id="current-order"
          aria-label="Current order"
          data-open={cartOpen ? "true" : "false"}
        >
          <div className="cart__grabber" aria-hidden="true" />
          <div className="cart__head">
            <div>
              <div className="row row-tight">
                <h2 style={{ fontSize: 14 }}>Current order</h2>
                {itemCount ? <Badge tone="brand">{itemCount}</Badge> : null}
              </div>
              <p className="hint" style={{ marginTop: 2 }}>
                {resumedOrder?.orderNumber ?? outlet?.name ?? "Selected outlet"}
                {tableLabel ? ` · ${tableLabel}` : ""}
              </p>
            </div>
            <div className="row row-tight">
              {cart.length ? (
                <Button variant="quiet" size="sm" onClick={() => setClearOpen(true)}>
                  <Trash2 aria-hidden="true" />
                  Clear
                </Button>
              ) : null}
              <button
                type="button"
                className="icon-btn cart__close"
                onClick={closeOrder}
                aria-label="Close order"
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="cart__body">
          <div style={{ padding: "12px 15px 0" }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Order type
            </div>
            <div className="chips" role="radiogroup" aria-label="Order type">
              {ORDER_TYPES.map((type) => (
                <ChipButton
                  key={type.value}
                  active={orderType === type.value}
                  onClick={() => setOrderType(type.value)}
                  aria-label={type.label}
                >
                  {type.label}
                </ChipButton>
              ))}
            </div>

            {orderType === "dine_in" && has("tables.view") ? (
              <div className="stack-sm" style={{ marginTop: 10 }}>
                <div className="eyebrow">Table</div>
                {tablesQuery.isLoading ? (
                  <span className="hint">Loading tables…</span>
                ) : tableOptions.length ? (
                  <div className="chips" role="radiogroup" aria-label="Dining table">
                    <ChipButton active={!tableId} onClick={() => setTableId("")}>
                      No table
                    </ChipButton>
                    {tableOptions.map((table) => (
                      <ChipButton
                        key={table.id}
                        active={tableId === table.id}
                        onClick={() => setTableId(table.id)}
                        title={`${table.name} · ${table.seats} seats${table.manualStatus === "reserved" ? " · reserved" : ""}`}
                      >
                        {table.name}
                      </ChipButton>
                    ))}
                  </div>
                ) : (
                  <span className="hint">
                    No free tables right now. Free one on the floor plan or take the order without a table.
                  </span>
                )}
              </div>
            ) : null}

            {resumedOrder ? (
              <div className="alert alert--warning" role="status" style={{ marginTop: 10 }}>
                <div>
                  <b>Editing open order</b>
                  <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                    {resumedOrder.orderNumber} · {resumedOrder.items.length} lines.{" "}
                    <button type="button" className="btn btn--link" onClick={exitResume} style={{ fontSize: 11 }}>
                      Start a new sale instead
                    </button>
                  </p>
                </div>
              </div>
            ) : null}

            {orderType === "delivery" || fulfilment.contactPhone || fulfilment.address ? (
              <div className="stack-sm" style={{ marginTop: 12 }}>
                {orderType === "delivery" ? (
                  <p className="hint" style={{ margin: 0 }}>
                    Delivery needs a contact phone and address. The kitchen sees these details on the order board.
                  </p>
                ) : null}
                <Field label="Recipient" htmlFor="fulfilment-name">
                  <Input
                    id="fulfilment-name"
                    value={fulfilment.contactName ?? ""}
                    onChange={(event) => setFulfilment((current) => ({ ...current, contactName: event.target.value }))}
                    placeholder="Name on the order"
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="Phone"
                  htmlFor="fulfilment-phone"
                  required={orderType === "delivery"}
                  error={deliveryInvalid && !fulfilment.contactPhone?.trim() ? "Add a contact phone" : undefined}
                >
                  <Input
                    id="fulfilment-phone"
                    type="tel"
                    inputMode="tel"
                    value={fulfilment.contactPhone ?? ""}
                    onChange={(event) => setFulfilment((current) => ({ ...current, contactPhone: event.target.value }))}
                    placeholder="08xx xxxx xxxx"
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="Address"
                  htmlFor="fulfilment-address"
                  required={orderType === "delivery"}
                  error={deliveryInvalid && !fulfilment.address?.trim() ? "Add a delivery address" : undefined}
                >
                  <Input
                    id="fulfilment-address"
                    value={fulfilment.address ?? ""}
                    onChange={(event) => setFulfilment((current) => ({ ...current, address: event.target.value }))}
                    placeholder="Street, building, landmark"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Instructions" htmlFor="fulfilment-notes" hint="Optional, shown to the kitchen and driver.">
                  <Input
                    id="fulfilment-notes"
                    value={fulfilment.instructions ?? ""}
                    onChange={(event) => setFulfilment((current) => ({ ...current, instructions: event.target.value }))}
                    placeholder="Leave at the lobby"
                    autoComplete="off"
                  />
                </Field>
              </div>
            ) : null}
          </div>

          <div style={{ padding: "12px 15px" }}>
            {has("customers.view") ? (
              <button
                type="button"
                className="customer-pick"
                onClick={() => setCustomerOpen(true)}
                aria-label={customer ? `Customer ${customer.name}, change customer` : "Attach a customer"}
              >
                <span className="avatar" aria-hidden="true">
                  {customer ? initials(customer.name) : <UserRound />}
                </span>
                <span style={{ minWidth: 0, textAlign: "left" }}>
                  <b>{customer ? customer.name : "Walk-in guest"}</b>
                  <span>{customer ? customer.phone || customer.email || "Customer attached" : "Attach a customer for loyalty and records"}</span>
                </span>
                {customer ? (
                  <UserRoundPlus aria-hidden="true" style={{ width: 15, height: 15, flexShrink: 0 }} />
                ) : (
                  <Plus aria-hidden="true" style={{ width: 15, height: 15, flexShrink: 0 }} />
                )}
              </button>
            ) : (
              <div className="customer-pick customer-pick--static">
                <span className="avatar" aria-hidden="true">
                  <UserRound />
                </span>
                <span>
                  <b>Walk-in guest</b>
                  <span>Customer records are not available to your role.</span>
                </span>
              </div>
            )}
          </div>

          <div style={{ padding: "0 15px 12px" }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <div className="eyebrow" style={{ marginBottom: 0 }}>
                Discounts
              </div>
              {discounts ? (
                <button type="button" className="btn btn--link" style={{ fontSize: 11 }} onClick={clearDiscounts}>
                  Clear
                </button>
              ) : null}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <Input
                value={promoCode}
                onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                placeholder="Promo code"
                aria-label="Promotion code"
                autoComplete="off"
                className="mono"
                style={{ minHeight: 36 }}
              />
              <Button
                variant="secondary"
                size="sm"
                style={{ minHeight: 36 }}
                disabled={!cart.length || (!promoCode.trim() && !redeemPoints.trim())}
                onClick={() => {
                  setDiscounts({
                    code: promoCode.trim().toUpperCase(),
                    points: Number(redeemPoints) || 0,
                  });
                }}
              >
                Apply
              </Button>
            </div>
            {loyalty ? (
              <div className="stack" style={{ gap: 4, marginTop: 6 }}>
                <div className="row" style={{ gap: 6 }}>
                  <Input
                    value={redeemPoints}
                    onChange={(event) => setRedeemPoints(event.target.value.replace(/[^\d.]/g, ""))}
                    placeholder={`Redeem points (min ${formatNumber(loyalty.minRedeemPoints)})`}
                    aria-label="Loyalty points to redeem"
                    inputMode="decimal"
                    autoComplete="off"
                    disabled={!customer}
                    style={{ minHeight: 36 }}
                  />
                </div>
                <p className="hint" style={{ margin: 0 }}>
                  {customer
                    ? `${formatNumber(customer.loyaltyPoints)} points available · 1 point = ${formatCurrency(
                        loyalty.redeemValue,
                        currency
                      )}`
                    : "Attach a customer to redeem loyalty points."}
                </p>
              </div>
            ) : null}
            {promoError ? (
              <div className="alert alert--warning" style={{ marginTop: 8 }}>
                {promoError}
              </div>
            ) : null}
            {promoPreview && (promotionDiscount > 0 || loyaltyDiscount > 0) ? (
              <div className="stack-sm" style={{ gap: 2, marginTop: 8 }}>
                {promotionDiscount > 0 ? (
                  <div className="cart__row">
                    <span className="hint" style={{ margin: 0 }}>
                      {promoPreview.promotionName ?? "Promotion"}
                      {promoPreview.promotionCode ? ` · ${promoPreview.promotionCode}` : ""}
                    </span>
                    <b>−{formatCurrency(promotionDiscount, currency)}</b>
                  </div>
                ) : null}
                {loyaltyDiscount > 0 ? (
                  <div className="cart__row">
                    <span className="hint" style={{ margin: 0 }}>
                      {formatNumber(promoPreview.loyaltyPointsRedeemed)} points redeemed
                    </span>
                    <b>−{formatCurrency(loyaltyDiscount, currency)}</b>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="cart__load">
            {cart.length ? (
              cart.map((line) => (
                <div className="cart-line" key={line.key}>
                  <div style={{ minWidth: 0 }}>
                    <div className="cart-line__name">{line.name}</div>
                    <div className="hint">
                      {line.optionSummary ? `${line.optionSummary} · ` : ""}
                      {formatCurrency(line.unitPrice, currency)} · {line.unit}
                    </div>
                  </div>
                  <div className="cart-line__price">{formatCurrency(line.unitPrice * line.quantity, currency)}</div>
                  <div className="cart-line__sub">
                    <div className="qty" role="group" aria-label={`Quantity for ${line.name}`}>
                      <button
                        type="button"
                        onClick={() => changeQuantity(line.key, -1)}
                        aria-label={`Decrease ${line.name}`}
                      >
                        <Minus aria-hidden="true" />
                      </button>
                      <span className="num" aria-live="polite">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(line.key, 1)}
                        aria-label={`Increase ${line.name}`}
                        disabled={line.trackInventory && line.quantity >= line.stock}
                      >
                        <Plus aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn--link"
                      onClick={() => removeLine(line.key)}
                      aria-label={`Remove ${line.name}`}
                      style={{ fontSize: 11 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="cart__empty">
                <ShoppingBag aria-hidden="true" />
                <div>
                  <b style={{ fontSize: 12.5 }}>The order is empty</b>
                  <p className="hint" style={{ marginTop: 3 }}>
                    Choose a product to start. Scanned SKUs can be entered in the search field.
                  </p>
                </div>
              </div>
            )}
          </div>
          </div>

          <div className="cart__summary">
            <div className="cart__row">
              <span>Subtotal</span>
              <b>{formatCurrency(promoPreview?.subtotal ?? subtotal, currency)}</b>
            </div>
            {promotionDiscount > 0 ? (
              <div className="cart__row">
                <span>Promotion</span>
                <b>−{formatCurrency(promotionDiscount, currency)}</b>
              </div>
            ) : null}
            {loyaltyDiscount > 0 ? (
              <div className="cart__row">
                <span>Loyalty points</span>
                <b>−{formatCurrency(loyaltyDiscount, currency)}</b>
              </div>
            ) : null}
            {taxRate ? (
              <div className="cart__row">
                <span className="row row-tight">
                  {taxRate.name} ({formatNumber(taxRate.rate, "en-GB")}%{" "}
                  {taxRate.type === "inclusive" ? "incl." : "add."})
                  <InfoTip label="About tax in this order">
                    {taxRate.type === "inclusive"
                      ? "Prices already include this tax. The tax portion is shown for reporting and is not added again."
                      : "This tax is added to the subtotal. The server recalculates it at checkout."}
                  </InfoTip>
                </span>
                <b>{formatCurrency(effectiveTax, currency)}</b>
              </div>
            ) : taxQuery.isLoading ? (
              <div className="cart__row">
                <span>Tax</span>
                <span className="hint">Loading rate…</span>
              </div>
            ) : (
              <div className="cart__row">
                <span>Tax</span>
                <span className="hint">Not configured</span>
              </div>
            )}
            <div className="cart__total">
              <span>Total</span>
              <b>{formatCurrency(effectiveTotal, currency)}</b>
            </div>
            <p className="hint" style={{ margin: 0 }}>
              Final totals are confirmed by the server when the sale is recorded.
            </p>
          </div>

          <div className="cart__pay">
            <div className="row between">
              <div className="eyebrow" style={{ marginBottom: 0 }}>
                Payment method
              </div>
              <button
                type="button"
                className="btn btn--link"
                style={{ fontSize: 11 }}
                onClick={() => {
                  setActionError(null);
                  setSplitOpen((open) => {
                    if (open) return false;
                    setSplitLines((lines) =>
                      lines.length
                        ? lines
                        : [
                            {
                              id: splitLineId(),
                              method: paymentMethod,
                              amount: String(effectiveTotal),
                              reference: "",
                            },
                          ]
                    );
                    return true;
                  });
                }}
              >
                {splitOpen ? "Use one method" : "Split payment"}
              </button>
            </div>

            {!splitOpen ? (
              <>
                <div className="pay-options" role="radiogroup" aria-label="Payment method">
                  {methods.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      role="radio"
                      aria-checked={paymentMethod === method.code}
                      className="pay-option"
                      onClick={() => setPaymentMethod(method.code)}
                      disabled={!method.active}
                    >
                      {METHOD_ICON[method.type] ?? <CreditCard aria-hidden="true" />}
                      <span>{method.name}</span>
                      {paymentMethod === method.code ? <Check aria-hidden="true" className="pay-option__check" /> : null}
                    </button>
                  ))}
                  {methodsQuery.isLoading ? (
                    <div className="hint">
                      <Spinner size={12} /> Loading methods…
                    </div>
                  ) : null}
                </div>
                {selectedMethod?.requiresReference ? (
                  <Field label={`${selectedMethod.name} reference`} htmlFor="pay-reference">
                    <Input
                      id="pay-reference"
                      value={payReference}
                      onChange={(event) => setPayReference(event.target.value)}
                      placeholder="Approval or transaction code"
                      autoComplete="off"
                    />
                  </Field>
                ) : null}
              </>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {splitLines.map((line, index) => {
                  const method = methods.find((entry) => entry.code === line.method);
                  return (
                    <div
                      key={line.id}
                      className="stack"
                      style={{
                        gap: 6,
                        padding: 8,
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 10,
                      }}
                    >
                      <div className="row" style={{ gap: 6 }}>
                        <Select
                          aria-label={`Payment method ${index + 1}`}
                          value={line.method}
                          style={{ flex: 1, minHeight: 36 }}
                          onChange={(event) =>
                            setSplitLines((lines) =>
                              lines.map((entry) =>
                                entry.id === line.id ? { ...entry, method: event.target.value } : entry
                              )
                            )
                          }
                        >
                          {methods
                            .filter((entry) => entry.active || entry.code === line.method)
                            .map((entry) => (
                              <option key={entry.id} value={entry.code}>
                                {entry.name}
                              </option>
                            ))}
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove payment line ${index + 1}`}
                          onClick={() => setSplitLines((lines) => lines.filter((entry) => entry.id !== line.id))}
                        >
                          <X aria-hidden="true" />
                        </Button>
                      </div>
                      <Input
                        aria-label={`Amount ${index + 1}`}
                        inputMode="decimal"
                        value={line.amount}
                        placeholder="Amount"
                        onChange={(event) =>
                          setSplitLines((lines) =>
                            lines.map((entry) =>
                              entry.id === line.id ? { ...entry, amount: event.target.value } : entry
                            )
                          )
                        }
                      />
                      {method?.requiresReference ? (
                        <Input
                          aria-label={`Reference ${index + 1}`}
                          value={line.reference}
                          placeholder="Reference (optional)"
                          autoComplete="off"
                          onChange={(event) =>
                            setSplitLines((lines) =>
                              lines.map((entry) =>
                                entry.id === line.id ? { ...entry, reference: event.target.value } : entry
                              )
                            )
                          }
                        />
                      ) : null}
                    </div>
                  );
                })}
                <Button
                  variant="secondary"
                  block
                  onClick={() =>
                    setSplitLines((lines) => [
                      ...lines,
                      {
                        id: splitLineId(),
                        method: lines.at(-1)?.method ?? paymentMethod,
                        amount: "",
                        reference: "",
                      },
                    ])
                  }
                >
                  <Plus aria-hidden="true" /> Add payment line
                </Button>
                <div className="cart__summary" style={{ margin: 0 }}>
                  <div className="cart__row">
                    <span>Paid</span>
                    <b>{formatCurrency(tendered, currency)}</b>
                  </div>
                  {shortPaid ? (
                    <div className="cart__row">
                      <span>Remaining</span>
                      <b>{formatCurrency(remaining, currency)}</b>
                    </div>
                  ) : null}
                  {change > 0.005 ? (
                    <div className="cart__row">
                      <span>Change</span>
                      <b>{formatCurrency(change, currency)}</b>
                    </div>
                  ) : null}
                </div>
                {changeInvalid ? (
                  <div className="alert alert--warning">Change can only come back from a cash payment.</div>
                ) : null}
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              block
              loading={mutation.isPending}
              disabled={
                !cart.length ||
                !outletId ||
                (!splitOpen && !selectedMethod) ||
                (splitOpen && !splitLines.length) ||
                shortPaid ||
                changeInvalid ||
                deliveryInvalid ||
                Boolean(taxQuery.isLoading)
              }
              onClick={() => {
                setActionError(null);
                // Open tabs require the server to resolve their current state
                // before they can be checked out. Refuse early with a clear
                // explanation rather than letting the network call fail silently.
                if (resumedOrder && !online) {
                  setOfflineResumeOpen(true);
                  return;
                }
                mutation.mutate();
              }}
            >
              Charge {formatCurrency(effectiveTotal, currency)}
            </Button>
            {!resumedOrder && has("orders.create") ? (
              <Button
                variant="secondary"
                block
                loading={saveOrderMutation.isPending}
                disabled={!cart.length || !outletId || deliveryInvalid}
                onClick={() => {
                  setActionError(null);
                  saveOrderMutation.mutate();
                }}
              >
                Save as open order
              </Button>
            ) : null}
            <p className="hint" style={{ margin: 0, textAlign: "center" }}>
              {deliveryInvalid
                ? "Add a delivery phone and address before saving or charging."
                : `${itemCount} ${itemCount === 1 ? "item" : "items"} · ${
                    splitOpen
                      ? `${splitLines.length} payment ${splitLines.length === 1 ? "line" : "lines"}`
                      : methods.find((method) => method.code === paymentMethod)?.name ?? "Choose a method"
                  }`}
            </p>
          </div>
        </aside>

        <button type="button" className="pos__order-bar" onClick={openOrder}>
          <span className="pos__order-bar-count">{itemCount}</span>
          <span className="pos__order-bar-copy">
            <b>{itemCount ? (itemCount === 1 ? "1 item" : `${itemCount} items`) : "No items yet"}</b>
            <span>{formatCurrency(effectiveTotal, currency)}</span>
          </span>
          <span className="pos__order-bar-cta">{cart.length ? "Review order" : "Order"}</span>
        </button>
      </div>

      <CustomerPickerDialog
        open={customerOpen}
        onClose={() => setCustomerOpen(false)}
        selected={customer}
        onSelect={(next) => {
          setCustomer(next);
          setCustomerOpen(false);
        }}
      />

      <ModifierPickerDialog
        picker={picker}
        currency={currency}
        onClose={() => setPicker(null)}
        onConfirm={(product, optionIds) => {
          addProduct(product, optionIds);
          setPicker(null);
        }}
      />

      <Dialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear this order?"
        description="The items and any attached customer will be removed from this register."
        width={410}
        footer={
          <>
            <Button variant="ghost" onClick={() => setClearOpen(false)}>
              Keep order
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setCart([]);
                setCustomer(null);
                clearDiscounts();
                setClearOpen(false);
              }}
            >
              Clear order
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: "hsl(var(--ink-2))" }}>
          {itemCount} {itemCount === 1 ? "item" : "items"} worth {formatCurrency(subtotal, currency)} will be removed.
          Nothing is recorded until you charge the sale.
        </p>
      </Dialog>

      <Dialog
        open={Boolean(success)}
        onClose={() => setSuccess(null)}
        title={success?.paymentStatus === "paid" ? "Sale completed" : "Sale recorded"}
        description={success ? success.receiptNumber : undefined}
        width={450}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSuccess(null)}>
              New sale
            </Button>
            <Link
              href={success ? `/transactions?q=${encodeURIComponent(success.receiptNumber)}` : "/transactions"}
              className="btn btn--primary"
            >
              View receipt
              <ChevronRight aria-hidden="true" />
            </Link>
          </>
        }
      >
        {success ? (
          <div className="stack" style={{ gap: 16 }}>
            <div className="success-mark" aria-hidden="true">
              <Check />
            </div>
            <div style={{ textAlign: "center" }}>
              <div className="eyebrow">{success.paymentStatus === "paid" ? "Paid" : "Payment not recorded"}</div>
              <div className="num" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.04em", marginTop: 2 }}>
                {formatCurrency(success.total, currency)}
              </div>
              <p className="hint" style={{ marginTop: 5 }}>
                {success.items.reduce((sum, item) => sum + item.quantity, 0)} items ·{" "}
                {success.payments.map((payment) => payment.method).join(", ") || selectedMethod?.name}
              </p>
            </div>
            {success.paymentStatus !== "paid" ? (
              <div className="alert alert--warning" role="alert">
                The receipt is saved, but no payment was recorded. The order was removed from the register to avoid a
                duplicate charge. If payment cannot be confirmed, void the receipt in Transactions so stock and sales
                stay accurate.
              </div>
            ) : null}
            <div className="ledger">
              <div className="ledger__row ledger__row--total">
                <dt>Receipt</dt>
                <dd className="mono">{success.receiptNumber}</dd>
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(queuedSale)}
        onClose={() => setQueuedSale(null)}
        title="Sale queued offline"
        description={queuedSale ? formatCurrency(queuedSaleTotal(queuedSale), currency) : undefined}
        width={450}
        footer={
          <Button variant="primary" onClick={() => setQueuedSale(null)}>
            Keep selling
          </Button>
        }
      >
        {queuedSale ? (
          <div className="stack" style={{ gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div className="eyebrow">Saved on this device</div>
              <div className="num" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.04em", marginTop: 2 }}>
                {formatCurrency(queuedSaleTotal(queuedSale), currency)}
              </div>
              <p className="hint" style={{ marginTop: 5 }}>
                {queuedSale.request.items.reduce((sum, item) => sum + item.quantity, 0)} items ·{" "}
                {(queuedSale.request.paymentMethod ?? "cash").toUpperCase()}
              </p>
            </div>
            <div className="alert alert--warning" role="status">
              The register could not reach the server, so this sale is waiting on this till with its original
              idempotency key. It is sent automatically when the connection returns; a retry can never charge the guest
              twice. The topbar pill shows the queue — open it to retry or discard a sale the server refuses.
            </div>
            <div className="ledger">
              <div className="ledger__row">
                <dt>Queued</dt>
                <dd>{formatRelative(queuedSale.createdAt)}</dd>
              </div>
              <div className="ledger__row">
                <dt>Status</dt>
                <dd>Waiting for a connection</dd>
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>

      {/* ── Offline open-tab notice ─────────────────────────────────────── */}
      <Dialog
        open={offlineResumeOpen}
        onClose={() => setOfflineResumeOpen(false)}
        title="No connection"
        description={resumedOrder?.orderNumber ?? "Open order"}
        width={420}
        footer={
          <Button variant="primary" onClick={() => setOfflineResumeOpen(false)}>
            Got it
          </Button>
        }
      >
        <div className="alert alert--warning" role="status">
          Checking out an open tab requires a server connection to confirm the
          current order state. Direct new sales still work offline — the cart
          queues them automatically and syncs when the connection returns.
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          Reconnect, then charge the tab. If payment cannot wait, start a new
          sale instead.
        </p>
      </Dialog>
    </>
  );
}

function ModifierPickerDialog({
  picker,
  currency,
  onClose,
  onConfirm,
}: {
  picker: { product: Product; groups: ModifierGroup[] } | null;
  currency: string;
  onClose: () => void;
  onConfirm: (product: Product, optionIds: string[]) => void;
}) {
  const [selection, setSelection] = React.useState<Record<string, string[]>>({});

  React.useEffect(() => {
    setSelection(picker ? defaultSelection(picker.groups) : {});
  }, [picker]);

  const groups = picker?.groups ?? [];
  const optionIds = Object.values(selection).flat();
  const delta = selectedDelta(groups, optionIds);
  const total = (picker?.product.price ?? 0) + delta;
  const incomplete = groups.filter(
    (group) => (selection[group.id]?.length ?? 0) < Math.max(group.minSelect, group.isRequired ? 1 : 0)
  );

  const toggle = (group: ModifierGroup, optionId: string) => {
    setSelection((current) => {
      const chosen = current[group.id] ?? [];
      if (group.selectionType === "single") {
        return { ...current, [group.id]: chosen.includes(optionId) ? [] : [optionId] };
      }
      if (chosen.includes(optionId)) {
        return { ...current, [group.id]: chosen.filter((id) => id !== optionId) };
      }
      if (group.maxSelect > 0 && chosen.length >= group.maxSelect) return current;
      return { ...current, [group.id]: [...chosen, optionId] };
    });
  };

  return (
    <Dialog
      open={Boolean(picker)}
      onClose={onClose}
      title={picker ? picker.product.name : "Choose options"}
      description={
        picker
          ? `Base ${formatCurrency(picker.product.price, currency)}. Required choices are marked.`
          : undefined
      }
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={incomplete.length > 0}
            onClick={() => picker && onConfirm(picker.product, optionIds)}
          >
            Add · {formatCurrency(total, currency)}
          </Button>
        </>
      }
    >
      {incomplete.length ? (
        <div className="alert alert--warning" role="alert">
          Choose {incomplete.map((group) => group.name).join(", ")} to continue.
        </div>
      ) : null}

      <div className="stack" style={{ gap: 18 }}>
        {groups.map((group) => {
          const chosen = selection[group.id] ?? [];
          return (
            <section key={group.id} aria-label={group.name}>
              <div className="row between" style={{ alignItems: "baseline", gap: 8 }}>
                <div>
                  <b style={{ fontSize: 13 }}>{group.name}</b>
                  <p className="hint" style={{ marginTop: 2 }}>
                    {group.selectionType === "single"
                      ? "Choose one"
                      : group.maxSelect > 0
                        ? `Choose up to ${group.maxSelect}`
                        : "Choose any"}
                  </p>
                </div>
                {group.isRequired ? <Badge tone="warning">Required</Badge> : null}
              </div>
              <div className="chips" style={{ marginTop: 8 }}>
                {group.options.map((option) => (
                  <ChipButton
                    key={option.id}
                    active={chosen.includes(option.id)}
                    disabled={!option.available}
                    aria-label={`${option.name}${option.priceDelta ? `, plus ${formatCurrency(option.priceDelta, currency)}` : ""}`}
                    onClick={() => toggle(group, option.id)}
                  >
                    {option.name}
                    {option.priceDelta ? (
                      <span className="chip__count">+{formatNumber(option.priceDelta, "en-GB")}</span>
                    ) : null}
                  </ChipButton>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}

function CustomerPickerDialog({
  open,
  onClose,
  selected,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
}) {
  const { has } = usePermissions();
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 250);

  React.useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const query = useQuery({
    queryKey: ["pos-customers", debounced],
    queryFn: () => listCustomers({ search: debounced.trim() || undefined, pageSize: 20 }),
    enabled: open && has("customers.view"),
    staleTime: 30_000,
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Attach a customer"
      description="Optional. Attaching a customer links this receipt to their record."
      width={450}
      footer={
        <>
          {selected ? (
            <Button variant="ghost" onClick={() => onSelect(null)}>
              Remove customer
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose} style={{ marginLeft: "auto" }}>
            Keep walk-in
          </Button>
        </>
      }
    >
      <div className="stack">
        <label className="input-affix">
          <Search aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone, or email"
            aria-label="Search customers"
            autoFocus
          />
          {search ? (
            <button type="button" className="icon-btn" onClick={() => setSearch("")} aria-label="Clear search">
              <X aria-hidden="true" />
            </button>
          ) : null}
        </label>

        {query.isLoading ? (
          <div className="stack-sm" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="skeleton skeleton-row" key={index} />
            ))}
          </div>
        ) : query.isError ? (
          <div className="alert alert--danger" role="alert">
            {query.error instanceof Error ? query.error.message : "Customers could not be loaded."}
          </div>
        ) : (query.data?.data.length ?? 0) === 0 ? (
          <EmptyState
            compact
            icon={<UserRoundPlus aria-hidden="true" />}
            title={search ? "No matching customers" : "No customers yet"}
            description={
              search
                ? "Check the spelling or search by phone number."
                : "Add customer records from the Customers page, then attach them at checkout."
            }
            actions={
              !search && has("customers.manage") ? (
                <Link href="/customers" className="btn btn--secondary btn--sm">
                  Go to customers
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="record-list" style={{ maxHeight: 320, overflowY: "auto" }}>
            {query.data?.data.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="record"
                onClick={() => onSelect(customer)}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: 0 }}
              >
                <div className="record__top">
                  <div className="row" style={{ minWidth: 0 }}>
                    <span className="avatar" aria-hidden="true">
                      {initials(customer.name)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="record__title">{customer.name}</div>
                      <div className="record__meta">
                        {customer.phone || customer.email || "No contact details"} ·{" "}
                        {formatNumber(customer.loyaltyPoints)} points
                      </div>
                    </div>
                  </div>
                  {selected?.id === customer.id ? (
                    <Check aria-hidden="true" style={{ width: 16, height: 16, color: "hsl(var(--primary))" }} />
                  ) : (
                    <ChevronRight aria-hidden="true" style={{ width: 15, height: 15 }} />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
