"use client";

// Opt out of instant-navigation validation: these pages render data-dependent client UI.
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
  InfoTip,
  Input,
  Spinner,
} from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { AccessDenied } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { listCategories, listProducts } from "@/lib/api/products";
import { getMenu } from "@/lib/api/menu";
import { listPaymentMethods } from "@/lib/api/business";
import { listTaxRates } from "@/lib/api/tax";
import { checkout } from "@/lib/api/sales";
import { listCustomers } from "@/lib/api/customers";
import { stockByOutlet } from "@/lib/api/inventory";
import type { Customer, ModifierGroup, Product, TaxRate, Transaction } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/formatting/currency";
import { initials } from "@/components/ui/primitives";
import { useBusiness } from "@/lib/business/context";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced";

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
};

function cartStorageKey(outletId: string | null) {
  return `velora_pos_cart_${outletId ?? "default"}`;
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

export default function SalesPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId, outlet } = useBusiness();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [cartLoaded, setCartLoaded] = React.useState(false);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [customerOpen, setCustomerOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState("cash");
  const [success, setSuccess] = React.useState<Transaction | null>(null);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [chargeError, setChargeError] = React.useState<string | null>(null);
  const [picker, setPicker] = React.useState<{ product: Product; groups: ModifierGroup[] } | null>(null);

  const searchRef = React.useRef<HTMLInputElement>(null);
  const checkoutKeyRef = React.useRef<string | null>(null);
  const loadedKeyRef = React.useRef<string | null>(null);

  const currency = session?.business.currency ?? "IDR";

  React.useEffect(() => {
    const stored = readCart(outletId);
    setCart(stored);
    setCustomer(null);
    loadedKeyRef.current = cartStorageKey(outletId);
    setCartLoaded(true);
  }, [outletId]);

  React.useEffect(() => {
    if (!cartLoaded) return;
    const key = cartStorageKey(outletId);
    if (loadedKeyRef.current !== key) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(cart));
    } catch {
      /* Private browsing storage may be unavailable; the register still works in memory. */
    }
  }, [cart, cartLoaded, outletId]);

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
    queryFn: listPaymentMethods,
    enabled: has("sales.create"),
    staleTime: 5 * 60_000,
  });

  const taxQuery = useQuery({
    queryKey: ["tax-rates"],
    queryFn: listTaxRates,
    enabled: has("sales.create"),
    staleTime: 60_000,
  });

  const stockMap = React.useMemo(
    () => new Map((stockQuery.data ?? []).map((row) => [row.productId, row.stock])),
    [stockQuery.data]
  );

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
      setPaymentMethod(methodsQuery.data[0].type);
    }
  }, [methodsQuery.data, paymentMethod]);

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
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const selectedMethod = methodsQuery.data?.find((method) => method.type === paymentMethod);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!outletId || !session) throw new Error("A cashier and outlet are required");
      if (!cart.length) throw new Error("Add at least one item to the order");
      if (!paymentMethod) throw new Error("Choose a payment method");
      if (!checkoutKeyRef.current) {
        checkoutKeyRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      return checkout({
        outletId,
        cashierId: session.user.id,
        customerId: customer?.id,
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          discount: 0,
          optionIds: line.optionIds,
        })),
        idempotencyKey: checkoutKeyRef.current,
        paymentMethod,
      });
    },
    onSuccess: (transaction) => {
      const pending = transaction.paymentStatus !== "paid";
      setSuccess(transaction);
      setCart([]);
      setCustomer(null);
      checkoutKeyRef.current = null;
      setChargeError(null);
      if (pending) {
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
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["pos-stock"] });
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      window.setTimeout(() => searchRef.current?.focus(), 100);
    },
    onError: (error) => {
      setChargeError(error instanceof Error ? error.message : "The sale could not be completed");
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

  const scrollToOrder = () => {
    document.getElementById("current-order")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const setupNeeded = !productsQuery.isLoading && products.length === 0;

  return (
    <>
      <PageHeader
        eyebrow={outlet?.name ?? "Register"}
        title="New sale"
        description="Build the order, attach a customer, and take payment. Stock and totals update as you go."
        actions={
          <>
            <Link href="/transactions" className="btn btn--secondary btn--sm">
              Transactions
            </Link>
            <Button
              variant="secondary"
              className="pos__mobile-order"
              onClick={scrollToOrder}
              disabled={!cart.length}
            >
              <ShoppingBag aria-hidden="true" />
              Order
              <span className="badge badge--brand">{itemCount}</span>
            </Button>
          </>
        }
      />

      {chargeError ? (
        <div className="alert alert--danger" role="alert">
          <div>
            <b>Payment could not be completed.</b>
            <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
              {chargeError}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={() => setChargeError(null)} aria-label="Dismiss error">
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
                return (
                  <button
                    key={product.id}
                    type="button"
                    className="product-tile"
                    onClick={() => chooseProduct(product)}
                    disabled={out || maxed || unavailable}
                    aria-label={`Add ${product.name} to order, ${formatCurrency(product.price, currency)}`}
                  >
                    <div className="row between" style={{ alignItems: "flex-start" }}>
                      <span className="product-tile__mono" aria-hidden="true">
                        {initials(product.name)}
                      </span>
                      {unavailable ? (
                        <Badge tone="danger">86</Badge>
                      ) : out ? (
                        <Badge tone="danger">Out</Badge>
                      ) : tracked && stock <= 10 ? (
                        <Badge tone="warning">{formatNumber(stock)} left</Badge>
                      ) : inCart ? (
                        <Badge tone="brand">{inCart} in order</Badge>
                      ) : null}
                    </div>
                    <div>
                      <div className="product-tile__name">{product.name}</div>
                      <div className="hint" style={{ marginTop: 2 }}>
                        {unavailable && menuProduct?.unavailableReason
                          ? menuProduct.unavailableReason
                          : product.categoryName || product.sku}
                      </div>
                    </div>
                    <div className="product-tile__meta">
                      <span className="product-tile__price">{formatCurrency(product.price, currency)}</span>
                      <span className="product-tile__stock" data-low={tracked && stock <= 10}>
                        {unavailable
                          ? "Unavailable"
                          : tracked
                            ? `${formatNumber(stock)} ${product.unit ?? ""}`
                            : "Untracked"}
                      </span>
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

        <aside className="cart" id="current-order" aria-label="Current order">
          <div className="cart__head">
            <div>
              <div className="row row-tight">
                <h2 style={{ fontSize: 14 }}>Current order</h2>
                {itemCount ? <Badge tone="brand">{itemCount}</Badge> : null}
              </div>
              <p className="hint" style={{ marginTop: 2 }}>
                {outlet?.name ?? "Selected outlet"}
              </p>
            </div>
            {cart.length ? (
              <Button variant="quiet" size="sm" onClick={() => setClearOpen(true)}>
                <Trash2 aria-hidden="true" />
                Clear
              </Button>
            ) : null}
          </div>

          <div style={{ padding: "0 15px 12px" }}>
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

          <div className="cart__summary">
            <div className="cart__row">
              <span>Subtotal</span>
              <b>{formatCurrency(subtotal, currency)}</b>
            </div>
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
                <b>{formatCurrency(tax, currency)}</b>
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
              <b>{formatCurrency(total, currency)}</b>
            </div>
            <p className="hint" style={{ margin: 0 }}>
              Final totals are confirmed by the server when the sale is recorded.
            </p>
          </div>

          <div className="cart__pay">
            <div className="eyebrow" style={{ marginBottom: 0 }}>
              Payment method
            </div>
            <div className="pay-options" role="radiogroup" aria-label="Payment method">
              {(methodsQuery.data ?? []).map((method) => (
                <button
                  key={method.id}
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === method.type}
                  className="pay-option"
                  onClick={() => setPaymentMethod(method.type)}
                  disabled={!method.active}
                >
                  {METHOD_ICON[method.type] ?? <CreditCard aria-hidden="true" />}
                  <span>{method.name}</span>
                  {paymentMethod === method.type ? <Check aria-hidden="true" className="pay-option__check" /> : null}
                </button>
              ))}
              {methodsQuery.isLoading ? (
                <div className="hint">
                  <Spinner size={12} /> Loading methods…
                </div>
              ) : null}
            </div>
            <Button
              variant="primary"
              size="lg"
              block
              loading={mutation.isPending}
              disabled={!cart.length || !outletId || !selectedMethod || Boolean(taxQuery.isLoading)}
              onClick={() => {
                setChargeError(null);
                mutation.mutate();
              }}
            >
              Charge {formatCurrency(total, currency)}
            </Button>
            <p className="hint" style={{ margin: 0, textAlign: "center" }}>
              {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
              {methodsQuery.data?.find((method) => method.type === paymentMethod)?.name ?? "Choose a method"}
            </p>
          </div>
        </aside>
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
