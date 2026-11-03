"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  CornerDownLeft,
  Package,
  Receipt,
  Search,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import { listProducts } from "@/lib/api/products";
import { listCustomers } from "@/lib/api/customers";
import { listTransactions } from "@/lib/api/sales";
import { listSuppliers } from "@/lib/api/purchasing";
import { filterNavGroups } from "@/lib/navigation";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";

type Entry = {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  href: string;
  group: string;
};

export function CommandPalette({
  open,
  onClose,
  instant = false,
}: {
  open: boolean;
  onClose: () => void;
  instant?: boolean;
}) {
  const router = useRouter();
  const { has } = usePermissions();
  const { session } = useAuth();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const deferredQuery = React.useDeferredValue(query.trim());
  const canSearch = deferredQuery.length >= 2;

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  const products = useQuery({
    queryKey: ["cmdk", "products", deferredQuery],
    queryFn: () => listProducts({ search: deferredQuery, pageSize: 4 }),
    enabled: open && canSearch && has("products.view"),
    staleTime: 20_000,
  });
  const customers = useQuery({
    queryKey: ["cmdk", "customers", deferredQuery],
    queryFn: () => listCustomers({ search: deferredQuery, pageSize: 4 }),
    enabled: open && canSearch && has("customers.view"),
    staleTime: 20_000,
  });
  const transactions = useQuery({
    queryKey: ["cmdk", "transactions", deferredQuery],
    queryFn: () => listTransactions({ search: deferredQuery, pageSize: 4 }),
    enabled: open && canSearch && has("sales.view"),
    staleTime: 20_000,
  });
  const suppliers = useQuery({
    queryKey: ["cmdk", "suppliers", deferredQuery],
    queryFn: () => listSuppliers(deferredQuery),
    enabled: open && canSearch && has("suppliers.view"),
    staleTime: 20_000,
  });

  const groups = React.useMemo(() => {
    const navigation = filterNavGroups(has, session?.isPlatformAdmin)
      .map((group) => ({
        label: group.label,
        entries: group.items
          .filter((item) => {
            if (!query.trim()) return true;
            const text = `${item.label} ${item.description ?? ""}`.toLowerCase();
            return text.includes(query.trim().toLowerCase());
          })
          .map<Entry>((item) => ({
            id: `nav-${item.href}`,
            label: item.label,
            sublabel: item.description,
            icon: <item.icon aria-hidden="true" />,
            href: item.href,
            group: group.label,
          })),
      }))
      .filter((group) => group.entries.length);

    if (!canSearch) return navigation;

    const found: Entry[] = [];
    customers.data?.data.forEach((customer) => {
      found.push({
        id: `customer-${customer.id}`,
        label: customer.name,
        sublabel: [customer.phone, customer.email].filter(Boolean).join(" · ") || "Customer",
        icon: <Users aria-hidden="true" />,
        href: `/customers?q=${encodeURIComponent(customer.name)}`,
        group: "Customers",
      });
    });
    products.data?.data.forEach((product) => {
      found.push({
        id: `product-${product.id}`,
        label: product.name,
        sublabel: `${product.sku}${product.categoryName ? ` · ${product.categoryName}` : ""}`,
        icon: <Package aria-hidden="true" />,
        href: `/products?q=${encodeURIComponent(product.sku || product.name)}`,
        group: "Products",
      });
    });
    transactions.data?.data.forEach((transaction) => {
      found.push({
        id: `sale-${transaction.id}`,
        label: transaction.receiptNumber,
        sublabel: `${transaction.customerName || "Walk-in"} · ${transaction.outletName}`,
        icon: <Receipt aria-hidden="true" />,
        href: `/transactions?q=${encodeURIComponent(transaction.receiptNumber)}`,
        group: "Transactions",
      });
    });
    suppliers.data?.forEach((supplier) => {
      found.push({
        id: `supplier-${supplier.id}`,
        label: supplier.name,
        sublabel: supplier.contact || supplier.email || "Supplier",
        icon: <Truck aria-hidden="true" />,
        href: `/suppliers?q=${encodeURIComponent(supplier.name)}`,
        group: "Suppliers",
      });
    });

    if (found.length) {
      return [...navigation, { label: "Matching records", entries: found }];
    }
    return navigation;
  }, [has, session?.isPlatformAdmin, query, canSearch, customers.data, products.data, transactions.data, suppliers.data]);

  const flat = React.useMemo(() => groups.flatMap((group) => group.entries), [groups]);

  React.useEffect(() => {
    setActive(0);
  }, [deferredQuery, groups.length]);

  React.useEffect(() => {
    if (active > flat.length - 1) setActive(Math.max(0, flat.length - 1));
  }, [active, flat.length]);

  const select = React.useCallback(
    (entry: Entry | undefined) => {
      if (!entry) return;
      onClose();
      router.push(entry.href);
    },
    [onClose, router]
  );

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (flat.length ? (value + 1) % flat.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => (flat.length ? (value - 1 + flat.length) % flat.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(flat[active]);
    } else if (event.key === "Tab") {
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const activeId = flat[active] ? `cmdk-${flat[active].id}` : undefined;
  let itemIndex = -1;
  const anySearchLoading =
    products.isFetching || customers.isFetching || transactions.isFetching || suppliers.isFetching;

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Search Velora"
        data-instant={instant || undefined}
      >
        <div className="cmdk__input">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages, products, customers, receipts…"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-results"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-label="Search pages, products, customers, and receipts"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>

        <div className="cmdk__list" id="cmdk-results" role="listbox" aria-label="Results">
          {!flat.length ? (
            <div className="cmdk__empty">
              {canSearch && anySearchLoading
                ? "Searching…"
                : query.trim()
                  ? `No pages or records match “${query.trim()}”.`
                  : "No sections are available for your access level."}
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className="cmdk__group">{group.label}</div>
                {group.entries.map((entry) => {
                  itemIndex += 1;
                  const index = itemIndex;
                  return (
                    <button
                      key={entry.id}
                      id={`cmdk-${entry.id}`}
                      type="button"
                      role="option"
                      aria-selected={active === index}
                      data-active={active === index || undefined}
                      className="cmdk__item"
                      onMouseMove={() => setActive(index)}
                      onClick={() => select(entry)}
                    >
                      {entry.icon}
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 550 }}>{entry.label}</span>
                        {entry.sublabel && (
                          <small
                            style={{
                              display: "block",
                              margin: 0,
                              color: "hsl(var(--ink-3))",
                              fontSize: 10.5,
                              fontWeight: 450,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {entry.sublabel}
                          </small>
                        )}
                      </span>
                      {active === index ? <ArrowRight aria-hidden="true" style={{ marginLeft: "auto" }} /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
          {canSearch && anySearchLoading && flat.length ? (
            <div className="cmdk__hint">Searching records…</div>
          ) : null}
        </div>

        <div className="cmdk__foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>
              <CornerDownLeft size={10} aria-hidden="true" />
            </kbd>{" "}
            open
          </span>
          <span style={{ marginLeft: "auto" }}>Searches your workspace only</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Compact entry point used by the empty states on searchable pages. */
export function CommandHint() {
  return (
    <span className="hint">
      <Boxes aria-hidden="true" /> Use the search field or press Ctrl K
    </span>
  );
}

export { UserRound };
