"use client";

// Opt out of instant-navigation validation: this page renders data-dependent client UI.
export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  ChefHat,
  CircleCheck,
  Clock,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Badge,
  Button,
  ChipButton,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { AccessDenied } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { listPaymentMethods } from "@/lib/api/payments";
import {
  cancelOrder,
  checkoutOrder,
  listOrders,
  orderStatusLabel,
  orderTypeLabel,
  setOrderStatus,
} from "@/lib/api/orders";
import type { OrderStatus, OrderType, Transaction } from "@/lib/api/types";
import { formatCurrency, formatTime } from "@/lib/formatting/currency";
import { useBusiness } from "@/lib/business/context";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced";

const COLUMNS: { status: OrderStatus; label: string; hint: string; icon: React.ReactNode }[] = [
  { status: "open", label: "Open", hint: "Taken, not fired", icon: <Clock aria-hidden="true" /> },
  { status: "in_kitchen", label: "In kitchen", hint: "Being prepared", icon: <ChefHat aria-hidden="true" /> },
  { status: "ready", label: "Ready", hint: "Waiting to be served", icon: <CircleCheck aria-hidden="true" /> },
  { status: "served", label: "Served", hint: "Awaiting payment", icon: <UtensilsCrossed aria-hidden="true" /> },
];

const TYPE_FILTERS: { value: "" | OrderType; label: string }[] = [
  { value: "", label: "All types" },
  { value: "dine_in", label: "Dine in" },
  { value: "takeaway", label: "Takeaway" },
  { value: "delivery", label: "Delivery" },
  { value: "pickup", label: "Pickup" },
];

function typeIcon(type?: OrderType) {
  if (type === "delivery") return <Truck aria-hidden="true" />;
  if (type === "pickup") return <Package aria-hidden="true" />;
  if (type === "takeaway") return <ShoppingBag aria-hidden="true" />;
  return <UtensilsCrossed aria-hidden="true" />;
}

function waitedMinutes(order: Transaction) {
  const created = new Date(order.createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.round((Date.now() - created) / 60_000));
}

export default function OrdersPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId, outlet } = useBusiness();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [orderType, setOrderType] = React.useState<"" | OrderType>("");
  const [showAll, setShowAll] = React.useState(false);
  const [checkoutTarget, setCheckoutTarget] = React.useState<Transaction | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState("cash");
  const [checkoutReference, setCheckoutReference] = React.useState("");
  const [cancelTarget, setCancelTarget] = React.useState<Transaction | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");

  const debounced = useDebouncedValue(search, 250);
  const currency = session?.business.currency ?? "IDR";

  const query = useQuery({
    queryKey: ["orders", outletId, showAll ? "all" : "active", orderType, debounced],
    queryFn: () =>
      listOrders({
        outletId: outletId ?? undefined,
        status: showAll ? "all" : "active",
        orderType: orderType || undefined,
        search: debounced.trim() || undefined,
      }),
    enabled: has("orders.view") && Boolean(outletId),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 2000,
  });

  const methodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => listPaymentMethods(),
    enabled: has("orders.manage"),
    staleTime: 5 * 60_000,
  });

  React.useEffect(() => {
    const first = methodsQuery.data?.find((method) => method.active);
    if (first && !methodsQuery.data?.some((method) => method.code === paymentMethod && method.active)) {
      setPaymentMethod(first.code);
    }
  }, [methodsQuery.data, paymentMethod]);

  const checkoutMethod = methodsQuery.data?.find((method) => method.code === paymentMethod);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    queryClient.invalidateQueries({ queryKey: ["pos-stock"] });
    queryClient.invalidateQueries({ queryKey: ["floor-plan"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ order, status }: { order: Transaction; status: OrderStatus }) =>
      setOrderStatus(order.id, status),
    onSuccess: (order, variables) => {
      push({
        title: `${order.orderNumber ?? "Order"} · ${orderStatusLabel(order.orderStatus)}`,
        description: `Moved from ${orderStatusLabel(variables.order.orderStatus)}.`,
        variant: "success",
      });
      invalidate();
    },
    onError: (error) => {
      push({
        title: "The order was not updated",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: () =>
      checkoutOrder(checkoutTarget!.id, {
        paymentMethod,
        payments: [
          {
            method: paymentMethod,
            amount: checkoutTarget!.total,
            reference: checkoutReference.trim() || undefined,
          },
        ],
      }),
    onSuccess: (order) => {
      push({
        title: "Order checked out",
        description: `${order.receiptNumber} · ${formatCurrency(order.total, currency)}`,
        variant: order.paymentStatus === "paid" ? "success" : "warning",
      });
      setCheckoutTarget(null);
      invalidate();
    },
    onError: (error) => {
      push({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(cancelTarget!.id, cancelReason.trim()),
    onSuccess: (order) => {
      push({
        title: `${order.orderNumber ?? "Order"} cancelled`,
        description: "Nothing was deducted from stock.",
        variant: "success",
      });
      setCancelTarget(null);
      setCancelReason("");
      invalidate();
    },
    onError: (error) => {
      push({
        title: "The order was not cancelled",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
    },
  });

  if (!has("orders.view")) {
    return <AccessDenied permission="orders.view" />;
  }

  const orders = query.data?.data ?? [];
  const canManage = has("orders.manage");
  const canCancel = has("orders.cancel");

  const byStatus = (status: OrderStatus) =>
    orders
      .filter((order) => order.orderStatus === status)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const closed = orders
    .filter((order) => order.orderStatus === "completed" || order.orderStatus === "cancelled")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activeCount = orders.filter(
    (order) => order.orderStatus !== "completed" && order.orderStatus !== "cancelled"
  ).length;

  const renderCard = (order: Transaction) => {
    const minutes = waitedMinutes(order);
    const late = minutes >= 20 && order.orderStatus !== "served" && order.orderStatus !== "completed";
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
      <article className="order-card" key={order.id} data-late={late || undefined}>
        <div className="order-card__head">
          <div style={{ minWidth: 0 }}>
            <div className="order-card__number mono">{order.orderNumber ?? order.receiptNumber}</div>
            <div className="order-card__meta">
              {typeIcon(order.orderType)}
              <span>{orderTypeLabel(order.orderType)}</span>
              {order.tableName ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tag">{order.tableName}</span>
                </>
              ) : null}
              <span aria-hidden="true">·</span>
              <span>{formatTime(order.createdAt)}</span>
            </div>
          </div>
          <Badge tone={late ? "warning" : "neutral"}>{minutes}m</Badge>
        </div>

        {order.customerName || order.fulfilment?.contactName ? (
          <div className="order-card__meta">
            <span>{order.customerName ?? order.fulfilment?.contactName}</span>
            {order.fulfilment?.contactPhone ? <span>· {order.fulfilment.contactPhone}</span> : null}
          </div>
        ) : null}

        <ul className="order-card__items">
          {order.items.slice(0, 5).map((item, index) => (
            <li key={`${item.name}-${index}`}>
              <span className="order-card__qty">{item.quantity}×</span>
              <span>{item.name}</span>
              <span className="order-card__line">{formatCurrency(item.lineTotal, currency)}</span>
            </li>
          ))}
          {order.items.length > 5 ? (
            <li className="hint">+{order.items.length - 5} more lines</li>
          ) : null}
        </ul>

        {order.notes || order.fulfilment?.address || order.fulfilment?.instructions ? (
          <div className="order-card__note">
            {order.fulfilment?.address ? <p>{order.fulfilment.address}</p> : null}
            {order.notes ? <p>{order.notes}</p> : null}
            {order.fulfilment?.instructions ? <p>“{order.fulfilment.instructions}”</p> : null}
          </div>
        ) : null}

        <div className="order-card__foot">
          <div>
            <b>{formatCurrency(order.total, currency)}</b>
            <span className="hint">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </div>
          <Link
            href={`/sales?order=${encodeURIComponent(order.id)}`}
            className="btn btn--link btn--sm"
            aria-label={`Open ${order.orderNumber ?? "order"} in the register`}
          >
            Open tab
          </Link>
        </div>

        {canManage || canCancel ? (
          <div className="order-card__actions">
            {canManage && order.orderStatus === "open" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => statusMutation.mutate({ order, status: "in_kitchen" })}
                disabled={statusMutation.isPending}
              >
                Fire
              </Button>
            ) : null}
            {canManage && (order.orderStatus === "open" || order.orderStatus === "in_kitchen") ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => statusMutation.mutate({ order, status: "ready" })}
                disabled={statusMutation.isPending}
              >
                Ready
              </Button>
            ) : null}
            {canManage && (order.orderStatus === "open" || order.orderStatus === "in_kitchen" || order.orderStatus === "ready") ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => statusMutation.mutate({ order, status: "served" })}
                disabled={statusMutation.isPending}
              >
                Served
              </Button>
            ) : null}
            {canManage ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setCheckoutReference("");
                  setCheckoutTarget(order);
                }}
                disabled={checkoutMutation.isPending}
              >
                Checkout
              </Button>
            ) : null}
            {canCancel ? (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Cancel ${order.orderNumber ?? "order"}`}
                onClick={() => {
                  setCancelTarget(order);
                  setCancelReason("");
                }}
              >
                <X aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow={outlet?.name ?? "All outlets"}
        title="Orders"
        description="Open tabs and the kitchen queue. Refreshes every few seconds; stock moves when an order is checked out."
        actions={
          <>
            <Button variant="secondary" onClick={() => query.refetch()} loading={query.isFetching}>
              <RefreshCw aria-hidden="true" />
              Refresh
            </Button>
            {has("sales.create") ? (
              <Link href="/sales" className="btn btn--primary btn--sm">
                <ShoppingBag aria-hidden="true" />
                New sale
              </Link>
            ) : null}
          </>
        }
      />

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div className="toolbar__group grow">
          <label className="input-affix grow">
            <Search aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order number, guest, or item"
              aria-label="Search orders"
            />
            {search ? (
              <button type="button" className="icon-btn" onClick={() => setSearch("")} aria-label="Clear search">
                <X aria-hidden="true" />
              </button>
            ) : null}
          </label>
        </div>
        <div className="chips" role="group" aria-label="Filter by order type">
          {TYPE_FILTERS.map((filter) => (
            <ChipButton
              key={filter.value || "all"}
              active={orderType === filter.value}
              onClick={() => setOrderType(filter.value)}
            >
              {filter.label}
            </ChipButton>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Which orders to show">
          <ChipButton active={!showAll} onClick={() => setShowAll(false)}>
            Active
            <span className="chip__count">{activeCount}</span>
          </ChipButton>
          <ChipButton active={showAll} onClick={() => setShowAll(true)}>
            All
          </ChipButton>
        </div>
      </div>

      {query.isError ? (
        <div className="card">
          <EmptyState
            icon={<Ban aria-hidden="true" />}
            title="Orders could not be loaded"
            description={query.error instanceof Error ? query.error.message : "Try again."}
            actions={
              <Button variant="secondary" onClick={() => query.refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : (
        <div className={showAll ? "order-board order-board--wide" : "order-board"}>
          {COLUMNS.map((column) => {
            const list = byStatus(column.status);
            return (
              <section className="order-column" key={column.status} aria-label={column.label}>
                <header className="order-column__head">
                  <div className="row row-tight">
                    <span className="order-column__icon">{column.icon}</span>
                    <b>{column.label}</b>
                    <span className="chip__count">{list.length}</span>
                  </div>
                  <p className="hint">{column.hint}</p>
                </header>
                <div className="order-column__list">
                  {query.isLoading ? (
                    Array.from({ length: 2 }).map((_, index) => (
                      <div className="order-card" key={index} aria-hidden="true">
                        <div className="skeleton" style={{ height: 12, width: "60%" }} />
                        <div className="skeleton" style={{ height: 9, width: "80%" }} />
                        <div className="skeleton" style={{ height: 9, width: "40%" }} />
                      </div>
                    ))
                  ) : list.length ? (
                    list.map(renderCard)
                  ) : (
                    <p className="order-column__empty">
                      {search || orderType ? "No matching orders" : "Nothing here right now"}
                    </p>
                  )}
                </div>
              </section>
            );
          })}

          {showAll ? (
            <section className="order-column" aria-label="Closed">
              <header className="order-column__head">
                <div className="row row-tight">
                  <span className="order-column__icon">
                    <CircleCheck aria-hidden="true" />
                  </span>
                  <b>Closed</b>
                  <span className="chip__count">{closed.length}</span>
                </div>
                <p className="hint">Completed or cancelled</p>
              </header>
              <div className="order-column__list">
                {closed.length ? (
                  closed.map((order) => (
                    <article className="order-card order-card--closed" key={order.id}>
                      <div className="order-card__head">
                        <div style={{ minWidth: 0 }}>
                          <div className="order-card__number mono">{order.orderNumber ?? order.receiptNumber}</div>
                          <div className="order-card__meta">
                            {typeIcon(order.orderType)}
                            <span>{orderTypeLabel(order.orderType)}</span>
                            {order.tableName ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="tag">{order.tableName}</span>
                              </>
                            ) : null}
                            <span aria-hidden="true">·</span>
                            <span>{formatTime(order.createdAt)}</span>
                          </div>
                        </div>
                        <Badge tone={order.orderStatus === "cancelled" ? "danger" : "success"}>
                          {orderStatusLabel(order.orderStatus)}
                        </Badge>
                      </div>
                      <div className="order-card__foot">
                        <b>{formatCurrency(order.total, currency)}</b>
                        <Link
                          href={`/transactions?q=${encodeURIComponent(order.receiptNumber)}`}
                          className="btn btn--link btn--sm"
                        >
                          Receipt
                        </Link>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="order-column__empty">No closed orders yet</p>
                )}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <Dialog
        open={Boolean(checkoutTarget)}
        onClose={() => setCheckoutTarget(null)}
        title="Check out order"
        description={checkoutTarget?.orderNumber}
        width={430}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCheckoutTarget(null)}>
              Keep open
            </Button>
            <Button
              variant="primary"
              loading={checkoutMutation.isPending}
              disabled={!methodsQuery.data?.some((method) => method.code === paymentMethod && method.active)}
              onClick={() => checkoutMutation.mutate()}
            >
              Charge {checkoutTarget ? formatCurrency(checkoutTarget.total, currency) : ""}
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="hint" style={{ margin: 0 }}>
            Checking out deducts product stock and recipe ingredients, assigns the receipt number, and closes the tab.
          </p>
          <Field label="Payment method" htmlFor="order-payment-method">
            <Select
              id="order-payment-method"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              {(methodsQuery.data ?? []).map((method) => (
                <option key={method.id} value={method.code} disabled={!method.active}>
                  {method.name}
                </option>
              ))}
            </Select>
          </Field>
          {checkoutMethod?.requiresReference ? (
            <Field label={`${checkoutMethod.name} reference`} htmlFor="order-payment-reference">
              <Input
                id="order-payment-reference"
                value={checkoutReference}
                onChange={(event) => setCheckoutReference(event.target.value)}
                placeholder="Approval or transaction code"
                autoComplete="off"
              />
            </Field>
          ) : null}
          {checkoutTarget?.items.length ? (
            <ul className="ledger" style={{ margin: 0 }}>
              {checkoutTarget.items.map((item, index) => (
                <div className="ledger__row" key={`${item.name}-${index}`}>
                  <dt>
                    {item.quantity}× {item.name}
                  </dt>
                  <dd>{formatCurrency(item.lineTotal, currency)}</dd>
                </div>
              ))}
              <div className="ledger__row ledger__row--total">
                <dt>Total</dt>
                <dd>{formatCurrency(checkoutTarget.total, currency)}</dd>
              </div>
            </ul>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancel this order?"
        description={cancelTarget?.orderNumber}
        width={430}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>
              Keep order
            </Button>
            <Button
              variant="danger"
              loading={cancelMutation.isPending}
              disabled={!cancelReason.trim()}
              onClick={() => cancelMutation.mutate()}
            >
              Cancel order
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="hint" style={{ margin: 0 }}>
            The tab is voided and released. Because stock is only deducted at checkout, nothing is returned to
            inventory.
          </p>
          <Field label="Reason" htmlFor="order-cancel-reason" required>
            <Textarea
              id="order-cancel-reason"
              rows={3}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Guest left, wrong items, duplicate order…"
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
