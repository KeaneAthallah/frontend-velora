"use client";

// Opt out of instant-navigation validation: these pages render data-dependent client UI.
export const instant = false;


import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Plus,
  Search,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import {
  Badge,
  Button,
  ChipButton,
  EmptyState,
  Field,
  Input,
  PageSizeSelect,
  Select,
} from "@/components/ui/primitives";
import { DataTable, Pagination, TablePagination, type Column } from "@/components/ui/table";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  listPurchaseOrders,
  listSuppliers,
  receivePurchaseOrder,
} from "@/lib/api/purchasing";
import { listProducts } from "@/lib/api/products";
import type { Product, PurchaseOrder, Supplier } from "@/lib/api/types";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/formatting/currency";
import { useBusiness } from "@/lib/business/context";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useDebouncedValue, useSearchParamState, replaceSearchParam } from "@/lib/use-debounced";

type StatusFilter = "all" | PurchaseOrder["status"];
type ConfirmAction = "approve" | "cancel" | null;

const STATUS_LABEL: Record<PurchaseOrder["status"], string> = {
  draft: "Draft",
  approved: "Approved",
  partial: "Partially received",
  received: "Received",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<PurchaseOrder["status"], "neutral" | "info" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  approved: "info",
  partial: "warning",
  received: "success",
  cancelled: "danger",
};

export default function PurchasingPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId, outlet } = useBusiness();
  const [search, setSearch, searchReady] = useSearchParamState("q");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<PurchaseOrder | null>(null);
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const debounced = useDebouncedValue(search, 300);
  const currency = session?.business.currency ?? "IDR";

  React.useEffect(() => {
    if (!searchReady) return;
    replaceSearchParam("q", debounced.trim());
  }, [debounced, searchReady]);

  React.useEffect(() => {
    setPage(1);
  }, [debounced, status, pageSize, outletId]);

  const query = useQuery({
    queryKey: ["purchase-orders", outletId, debounced, status, page, pageSize],
    queryFn: () =>
      listPurchaseOrders({
        search: debounced.trim() || undefined,
        status,
        outletId: outletId ?? undefined,
        page,
        pageSize,
      }),
    enabled: has("purchasing.view") && Boolean(outletId),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "purchasing"],
    queryFn: () => listSuppliers(),
    enabled: has("purchasing.view"),
    staleTime: 60_000,
  });

  const productsQuery = useQuery({
    queryKey: ["purchasing-products"],
    queryFn: () => listProducts({ pageSize: 200, activeOnly: true }),
    enabled: has("purchasing.view"),
    staleTime: 60_000,
  });

  const canManage = has("purchasing.manage");
  const rows = query.data?.data ?? [];
  const activeFilters = Boolean(debounced.trim()) || status !== "all";
  const suppliers = React.useMemo(() => suppliersQuery.data ?? [], [suppliersQuery.data]);
  const products = React.useMemo(() => productsQuery.data?.data ?? [], [productsQuery.data]);

  const actions = {
    approve: useMutation({
      mutationFn: (order: PurchaseOrder) => approvePurchaseOrder(order.id),
      onSuccess: (_data, order) => {
        setActionError(null);
        setConfirmAction(null);
        setSelected((current) => (current && current.id === order.id ? { ...current, status: "approved" } : current));
        void query.refetch();
        void suppliersQuery.refetch();
      },
      onError: (error) => {
        setConfirmAction(null);
        setActionError(error instanceof Error ? error.message : "The order could not be approved.");
      },
    }),
    cancel: useMutation({
      mutationFn: (order: PurchaseOrder) => cancelPurchaseOrder(order.id),
      onSuccess: (_data, order) => {
        setActionError(null);
        setConfirmAction(null);
        setSelected((current) => (current && current.id === order.id ? { ...current, status: "cancelled" } : current));
        void query.refetch();
      },
      onError: (error) => {
        setConfirmAction(null);
        setActionError(error instanceof Error ? error.message : "The order could not be cancelled.");
      },
    }),
  };

  if (!has("purchasing.view")) {
    return <AccessDenied permission="purchasing.view" />;
  }

  const openOrder = (order: PurchaseOrder) => {
    setActionError(null);
    setSelected(order);
  };

  const columns: Column<PurchaseOrder>[] = [
    {
      id: "order",
      header: "Order",
      cell: (row) => (
        <div>
          <div className="mono" style={{ fontWeight: 650, fontSize: 12 }}>
            {row.number}
          </div>
          <div className="hint">
            {row.items.length} {row.items.length === 1 ? "line" : "lines"} · {row.outletName || outlet?.name || "Outlet"}
          </div>
        </div>
      ),
    },
    {
      id: "supplier",
      header: "Supplier",
      cell: (row) => <span style={{ fontWeight: 550 }}>{row.supplierName || "Unknown supplier"}</span>,
    },
    {
      id: "expected",
      header: "Expected",
      cell: (row) => <span className="cell-muted">{row.expectedAt ? formatDate(row.expectedAt) : "—"}</span>,
    },
    {
      id: "created",
      header: "Created",
      cell: (row) => <span className="cell-muted">{formatDate(row.createdAt)}</span>,
    },
    {
      id: "items",
      header: "Units",
      align: "right",
      cell: (row) => (
        <span className="cell-muted num">
          {formatNumber(row.items.reduce((sum, item) => sum + item.quantity, 0))}
        </span>
      ),
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      cell: (row) => (
        <span className="num" style={{ fontWeight: 650 }}>
          {formatCurrency(row.total, currency)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge tone={STATUS_TONE[row.status]} dot>
          {STATUS_LABEL[row.status]}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button
          variant="quiet"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            openOrder(row);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchasing"
        eyebrow={outlet?.name ?? "Selected outlet"}
        description="Order stock, approve drafts, and receive goods with an audit trail into inventory."
        actions={
          <>
            <Link href="/suppliers" className="btn btn--secondary">
              <Truck aria-hidden="true" />
              Suppliers
            </Link>
            {canManage ? (
              <Button
                variant="primary"
                onClick={() => setCreateOpen(true)}
                disabled={suppliersQuery.isLoading || productsQuery.isLoading}
              >
                <Plus aria-hidden="true" />
                New purchase order
              </Button>
            ) : null}
          </>
        }
      />

      {actionError ? (
        <div className="alert alert--danger" role="alert">
          <div>{actionError}</div>
          <button type="button" className="icon-btn" onClick={() => setActionError(null)} aria-label="Dismiss error">
            <X aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <Card>
        <div className="toolbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <label className="toolbar__search input-affix">
            <Search aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order number or supplier"
              aria-label="Search purchase orders"
            />
            {search ? (
              <button type="button" className="icon-btn" onClick={() => setSearch("")} aria-label="Clear search">
                <X aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <div className="chips" role="group" aria-label="Filter by order status">
            <ChipButton active={status === "all"} onClick={() => setStatus("all")}>
              All
            </ChipButton>
            {(["draft", "approved", "partial", "received", "cancelled"] as const).map((value) => (
              <ChipButton key={value} active={status === value} onClick={() => setStatus(value)}>
                {STATUS_LABEL[value]}
              </ChipButton>
            ))}
          </div>
          <div className="spacer" />
          <span className="hint" style={{ margin: 0, whiteSpace: "nowrap" }}>
            {query.data ? `${formatNumber(query.data.total)} orders` : "—"}
          </span>
          {activeFilters ? (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatus("all");
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>

        {query.isError ? (
          <InlineError
            title="Purchase orders could not be loaded"
            error={query.error}
            onRetry={() => query.refetch()}
          />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowId={(row) => row.id}
            loading={query.isLoading && !query.data}
            onRowClick={openOrder}
            minWidth={820}
            empty={
              <EmptyState
                icon={<ClipboardList aria-hidden="true" />}
                title={
                  activeFilters
                    ? "No orders match these filters"
                    : suppliers.length === 0
                      ? "Add a supplier first"
                      : products.length === 0
                        ? "Add products first"
                        : "No purchase orders yet"
                }
                description={
                  activeFilters
                    ? "Try another status or search term."
                    : suppliers.length === 0
                      ? "A purchase order needs a supplier. Add one before ordering stock."
                      : products.length === 0
                        ? "Purchase orders need products in the catalog."
                        : "Create a draft, approve it, then receive goods into inventory."
                }
                actions={
                  activeFilters ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch("");
                        setStatus("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : suppliers.length === 0 ? (
                    <Link href="/suppliers" className="btn btn--secondary">
                      Go to suppliers
                    </Link>
                  ) : products.length === 0 ? (
                    <Link href="/products" className="btn btn--secondary">
                      Go to products
                    </Link>
                  ) : canManage ? (
                    <Button variant="primary" onClick={() => setCreateOpen(true)}>
                      Create first purchase order
                    </Button>
                  ) : (
                    <span className="hint">Ask a manager to create purchase orders.</span>
                  )
                }
              />
            }
            mobile={(row) => (
              <button
                type="button"
                className="record"
                onClick={() => openOrder(row)}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: 0 }}
              >
                <div className="record__top">
                  <div style={{ minWidth: 0 }}>
                    <div className="record__title mono">{row.number}</div>
                    <div className="record__meta">{row.supplierName || "Unknown supplier"}</div>
                    <div className="row row-tight" style={{ marginTop: 6 }}>
                      <Badge tone={STATUS_TONE[row.status]} dot>
                        {STATUS_LABEL[row.status]}
                      </Badge>
                      <span className="hint" style={{ margin: 0 }}>
                        {row.items.length} lines
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <b className="num">{formatCurrency(row.total, currency)}</b>
                    <div className="hint">{formatDate(row.createdAt)}</div>
                  </div>
                </div>
              </button>
            )}
            footer={
              <TablePagination>
                <PageSizeSelect value={pageSize} onChange={setPageSize} options={[10, 20, 50]} />
                <Pagination
                  page={query.data?.page ?? page}
                  totalPages={query.data?.totalPages ?? 1}
                  total={query.data?.total ?? 0}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  label="purchase orders"
                />
              </TablePagination>
            }
          />
        )}
      </Card>

      <CreatePurchaseOrderSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        suppliers={suppliers}
        products={products}
        outletId={outletId}
        outletName={outlet?.name ?? "this outlet"}
        currency={currency}
        onCreated={() => {
          setCreateOpen(false);
          void query.refetch();
        }}
        canManage={canManage}
        loadingSuppliers={suppliersQuery.isLoading}
        loadingProducts={productsQuery.isLoading}
      />

      <PurchaseOrderSheet
        order={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        canManage={canManage}
        currency={currency}
        onApprove={() => setConfirmAction("approve")}
        onCancel={() => setConfirmAction("cancel")}
        onReceive={() => setReceiveOpen(true)}
        busy={actions.approve.isPending || actions.cancel.isPending}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!selected || !confirmAction) return;
          if (confirmAction === "approve") actions.approve.mutate(selected);
          else actions.cancel.mutate(selected);
        }}
        title={confirmAction === "cancel" ? "Cancel this purchase order?" : "Approve this purchase order?"}
        description={
          confirmAction === "cancel" ? (
            <>
              <b>{selected?.number}</b> will be cancelled. It cannot be received or approved afterwards. Stock is
              unchanged until goods are received.
            </>
          ) : (
            <>
              <b>{selected?.number}</b> will be marked approved and become ready to receive. Approving does not add
              stock by itself.
            </>
          )
        }
        confirmLabel={confirmAction === "cancel" ? "Cancel order" : "Approve order"}
        tone={confirmAction === "cancel" ? "danger" : "primary"}
        loading={actions.approve.isPending || actions.cancel.isPending}
      />

      {selected ? (
        <ReceiveDialog
          open={receiveOpen}
          onClose={() => setReceiveOpen(false)}
          order={selected}
          onReceived={() => {
            setReceiveOpen(false);
            setSelected(null);
            void query.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function PurchaseOrderSheet({
  order,
  open,
  onClose,
  canManage,
  currency,
  onApprove,
  onCancel,
  onReceive,
  busy,
}: {
  order: PurchaseOrder | null;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  currency: string;
  onApprove: () => void;
  onCancel: () => void;
  onReceive: () => void;
  busy: boolean;
}) {
  if (!order) return null;
  const receivedUnits = order.items.reduce((sum, item) => sum + (item.receivedQuantity ?? 0), 0);
  const orderedUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const canReceive = order.status === "approved" || order.status === "partial";
  const canApprove = order.status === "draft";
  const canCancel = order.status === "draft";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={order.number}
      description={`${order.supplierName} · ${STATUS_LABEL[order.status]} · ${formatDate(order.createdAt)}`}
      width={560}
      footer={
        <>
          {canManage && canCancel ? (
            <Button variant="danger-quiet" onClick={onCancel} disabled={busy}>
              Cancel order
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose} style={{ marginLeft: canManage && canCancel ? 0 : "auto" }}>
            Close
          </Button>
          {canManage && canApprove ? (
            <Button variant="primary" onClick={onApprove} loading={busy}>
              <CheckCircle2 aria-hidden="true" />
              Approve
            </Button>
          ) : null}
          {canManage && canReceive ? (
            <Button variant="primary" onClick={onReceive}>
              <PackageCheck aria-hidden="true" />
              Receive stock
            </Button>
          ) : null}
        </>
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <div className="row between wrap">
          <div>
            <div className="eyebrow">Status</div>
            <Badge tone={STATUS_TONE[order.status]} dot>
              {STATUS_LABEL[order.status]}
            </Badge>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="eyebrow">Order total</div>
            <b className="num" style={{ fontSize: 20 }}>
              {formatCurrency(order.total, currency)}
            </b>
          </div>
        </div>

        <div className="inset">
          <div className="grid-2" style={{ gap: 12 }}>
            <OrderFact label="Outlet" value={order.outletName || "Selected outlet"} />
            <OrderFact label="Supplier" value={order.supplierName || "Unknown"} />
            <OrderFact label="Expected" value={order.expectedAt ? formatDate(order.expectedAt) : "Not specified"} />
            <OrderFact
              label="Received"
              value={`${formatNumber(receivedUnits)} of ${formatNumber(orderedUnits)} units`}
            />
            {order.approvedAt ? <OrderFact label="Approved" value={formatDateTime(order.approvedAt)} /> : null}
            {order.receivedAt ? <OrderFact label="Last received" value={formatDateTime(order.receivedAt)} /> : null}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 12, marginBottom: 8 }}>Order lines</h3>
          <div className="stack-sm">
            {order.items.map((item) => {
              const received = item.receivedQuantity ?? 0;
              return (
                <div className="po-item po-item--read" key={item.id ?? item.productId}>
                  <div className="row between wrap" style={{ gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{item.productName || "Unknown product"}</div>
                      <div className="hint">
                        {formatNumber(item.quantity)} ordered ·{" "}
                        {formatCurrency(item.cost, currency)} each
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <b className="num">{formatCurrency(item.quantity * item.cost, currency)}</b>
                      <div className="hint">
                        {received >= item.quantity
                          ? "Received"
                          : received > 0
                            ? `${formatNumber(received)} received`
                            : "Not received"}
                      </div>
                    </div>
                  </div>
                  {received > 0 && received < item.quantity ? (
                    <div className="progress" aria-label={`${formatNumber(received)} of ${formatNumber(item.quantity)} received`}>
                      <span style={{ width: `${Math.min(100, (received / item.quantity) * 100)}%` }} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {order.status === "received" ? (
          <div className="alert alert--success" role="status">
            <CheckCircle2 aria-hidden="true" />
            <div>
              <b>All goods received.</b>
              <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                Stock was added at the receiving outlet and is visible in Inventory.
              </p>
            </div>
          </div>
        ) : null}
        {order.status === "cancelled" ? (
          <div className="alert alert--danger" role="status">
            <XCircle aria-hidden="true" />
            <div>
              <b>This order was cancelled.</b>
              <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                It cannot be approved or received. Create a new order if the purchase is still needed.
              </p>
            </div>
          </div>
        ) : null}
        {!canManage ? (
          <p className="hint" style={{ margin: 0 }}>
            Your role can view purchase orders but not approve or receive them.
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

function OrderFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 550 }}>{value}</div>
    </div>
  );
}

function CreatePurchaseOrderSheet({
  open,
  onClose,
  suppliers,
  products,
  outletId,
  outletName,
  currency,
  loadingSuppliers,
  loadingProducts,
  canManage,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  products: Product[];
  outletId: string | null;
  outletName: string;
  currency: string;
  loadingSuppliers: boolean;
  loadingProducts: boolean;
  canManage: boolean;
  onCreated: () => void;
}) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = React.useState("");
  const [expectedAt, setExpectedAt] = React.useState("");
  const [lines, setLines] = React.useState<{ key: string; productId: string; quantity: string; unitCost: string }[]>([
    { key: "line-1", productId: "", quantity: "1", unitCost: "" },
  ]);
  const [error, setError] = React.useState<string | null>(null);

  const newLine = React.useCallback(
    (index: number) => ({
      key: `line-${Date.now()}-${index}`,
      productId: "",
      quantity: "1",
      unitCost: "",
    }),
    []
  );

  React.useEffect(() => {
    if (!open) return;
    const firstProduct = products[0];
    setSupplierId(suppliers[0]?.id ?? "");
    setExpectedAt("");
    setError(null);
    setLines([
      {
        key: `line-${Date.now()}`,
        productId: firstProduct?.id ?? "",
        quantity: "1",
        unitCost: firstProduct ? String(firstProduct.cost) : "",
      },
    ]);
  }, [open, products, suppliers]);

  const total = lines.reduce((sum, line) => {
    const quantity = Number(line.quantity);
    const cost = Number(line.unitCost);
    if (!Number.isFinite(quantity) || !Number.isFinite(cost)) return sum;
    return sum + quantity * cost;
  }, 0);

  const updateLine = (key: string, patch: Partial<(typeof lines)[number]>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const chooseProduct = (key: string, productId: string) => {
    const product = products.find((item) => item.id === productId);
    updateLine(key, {
      productId,
      unitCost: product ? String(product.cost) : "",
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!outletId) throw new Error("Select an outlet before creating a purchase order.");
      if (!supplierId) throw new Error("Choose a supplier.");
      const prepared = lines.map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost),
      }));
      if (prepared.some((line) => !line.productId)) throw new Error("Choose a product on every line.");
      if (prepared.some((line) => !Number.isFinite(line.quantity) || line.quantity <= 0)) {
        throw new Error("Every quantity must be greater than zero.");
      }
      if (prepared.some((line) => !Number.isFinite(line.unitCost) || line.unitCost < 0)) {
        throw new Error("Unit costs cannot be negative.");
      }
      return createPurchaseOrder({
        supplierId,
        outletId,
        expectedAt: expectedAt || undefined,
        items: prepared,
      });
    },
    onSuccess: (order) => {
      push({
        title: "Purchase order drafted",
        description: `${order.number} · ${formatCurrency(order.total, currency)}. Approve it when you are ready.`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      onCreated();
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : "The purchase order could not be created.");
    },
  });

  if (!canManage) return null;

  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title="New purchase order"
      description={`Draft an order for ${outletName}. Stock is added only when goods are received.`}
      width={620}
      footer={
        <>
          <span className="hint" style={{ margin: 0, marginRight: "auto" }}>
            Draft total <b className="num" style={{ color: "hsl(var(--ink))" }}>{formatCurrency(total, currency)}</b>
          </span>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={!suppliers.length || !products.length}
            onClick={() => mutation.mutate()}
          >
            Create draft
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        {error ? (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        ) : null}

        {!suppliers.length ? (
          <div className="alert alert--warning">
            <div>
              <b>No suppliers available.</b>
              <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                Add a supplier before creating a purchase order.
              </p>
            </div>
          </div>
        ) : null}
        {!products.length ? (
          <div className="alert alert--warning">
            <div>
              <b>No active products available.</b>
              <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                Add or reactivate products in the catalog first.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Supplier" htmlFor="po-supplier" required>
            <Select
              id="po-supplier"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              disabled={loadingSuppliers || suppliers.length === 0}
            >
              {suppliers.length === 0 ? <option value="">No suppliers</option> : null}
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expected delivery" htmlFor="po-expected" hint="Optional. Used for planning, not stock.">
            <Input
              id="po-expected"
              type="date"
              value={expectedAt}
              onChange={(event) => setExpectedAt(event.target.value)}
            />
          </Field>
        </div>

        <div>
          <div className="row between" style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 12 }}>Order lines</h3>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => setLines((current) => [...current, newLine(current.length + 1)])}
              disabled={!products.length}
            >
              <Plus aria-hidden="true" />
              Add line
            </Button>
          </div>

          <div className="stack-sm">
            {lines.map((line, index) => {
              const product = products.find((item) => item.id === line.productId);
              const lineTotal = Number(line.quantity || 0) * Number(line.unitCost || 0);
              return (
                <div className="po-item" key={line.key}>
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <span className="eyebrow" style={{ margin: 0 }}>
                      Line {index + 1}
                    </span>
                    {lines.length > 1 ? (
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                        aria-label={`Remove line ${index + 1}`}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                  <div className="stack-sm" style={{ gap: 8 }}>
                    <Select
                      aria-label={`Product for line ${index + 1}`}
                      value={line.productId}
                      onChange={(event) => chooseProduct(line.key, event.target.value)}
                      disabled={loadingProducts || products.length === 0}
                    >
                      {products.length === 0 ? <option value="">No products</option> : null}
                      {products.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.sku}
                        </option>
                      ))}
                    </Select>
                    <div className="grid-3" style={{ gap: 8 }}>
                      <Field label="Quantity" htmlFor={`po-qty-${line.key}`}>
                        <Input
                          id={`po-qty-${line.key}`}
                          type="number"
                          min="0.0001"
                          step="1"
                          inputMode="decimal"
                          value={line.quantity}
                          onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                        />
                      </Field>
                      <Field label="Unit cost" htmlFor={`po-cost-${line.key}`}>
                        <Input
                          id={`po-cost-${line.key}`}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={line.unitCost}
                          onChange={(event) => updateLine(line.key, { unitCost: event.target.value })}
                        />
                      </Field>
                      <div>
                        <div className="eyebrow" style={{ marginBottom: 7 }}>
                          Line total
                        </div>
                        <div className="num" style={{ fontWeight: 650, paddingTop: 9 }}>
                          {formatCurrency(lineTotal, currency)}
                        </div>
                      </div>
                    </div>
                    {product ? (
                      <span className="hint">
                        Current cost {formatCurrency(product.cost, currency)} · sold at{" "}
                        {formatCurrency(product.price, currency)}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="inset row between">
          <div>
            <b style={{ fontSize: 12.5 }}>Order total</b>
            <p className="hint" style={{ margin: "2px 0 0" }}>
              This draft total comes from quantities and unit costs. Receiving may adjust cost.
            </p>
          </div>
          <b className="num" style={{ fontSize: 18 }}>
            {formatCurrency(total, currency)}
          </b>
        </div>
      </div>
    </Sheet>
  );
}

function ReceiveDialog({
  open,
  onClose,
  order,
  onReceived,
}: {
  open: boolean;
  onClose: () => void;
  order: PurchaseOrder;
  onReceived: () => void;
}) {
  const { push } = useToast();
  const { outlet } = useBusiness();
  const queryClient = useQueryClient();
  const [lines, setLines] = React.useState<
    Record<string, { quantity: string; unitCost: string }>
  >({});
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const initial: Record<string, { quantity: string; unitCost: string }> = {};
    order.items.forEach((item) => {
      const remaining = Math.max(0, item.quantity - (item.receivedQuantity ?? 0));
      initial[item.id ?? item.productId] = {
        quantity: remaining > 0 ? String(remaining) : "0",
        unitCost: String(item.cost),
      };
    });
    setLines(initial);
    setError(null);
  }, [open, order]);

  const mutation = useMutation({
    mutationFn: async () => {
      const items = order.items
        .map((item) => {
          const key = item.id ?? item.productId;
          const entry = lines[key];
          return {
            itemId: item.id ?? "",
            quantity: Number(entry?.quantity ?? 0),
            unitCost: Number(entry?.unitCost ?? item.cost),
            remaining: Math.max(0, item.quantity - (item.receivedQuantity ?? 0)),
            name: item.productName,
          };
        })
        .filter((item) => item.quantity > 0);

      if (!items.length) throw new Error("Enter at least one received quantity.");
      if (items.some((item) => !item.itemId)) throw new Error("This order line cannot be received.");
      if (items.some((item) => !Number.isFinite(item.quantity) || item.quantity > item.remaining)) {
        throw new Error("Received quantities cannot exceed what is still outstanding.");
      }
      if (items.some((item) => !Number.isFinite(item.unitCost) || item.unitCost < 0)) {
        throw new Error("Unit costs cannot be negative.");
      }
      await receivePurchaseOrder(
        order.id,
        items.map((item) => ({ itemId: item.itemId, quantity: item.quantity, unitCost: item.unitCost })),
        order.outletId
      );
      return items;
    },
    onSuccess: (items) => {
      const units = items.reduce((sum, item) => sum + item.quantity, 0);
      push({
        title: "Goods received",
        description: `${formatNumber(units)} units added to inventory at ${outlet?.name ?? order.outletName ?? "the outlet"}.`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stock"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["pos-stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onReceived();
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : "The receipt could not be recorded.");
    },
  });

  const totalReceived = order.items.reduce((sum, item) => {
    const key = item.id ?? item.productId;
    const value = Number(lines[key]?.quantity ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title="Receive stock"
      description={`${order.number} · ${order.supplierName}. Quantities are added to inventory at the order outlet.`}
      width={580}
      footer={
        <>
          <span className="hint" style={{ margin: 0, marginRight: "auto" }}>
            {formatNumber(totalReceived)} units in this receipt
          </span>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            <PackageCheck aria-hidden="true" />
            Receive goods
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        {error ? (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        ) : null}
        <p className="hint" style={{ margin: 0 }}>
          Receive all or part of this order. Partial receipts keep the order open until every unit has arrived.
          Unit cost can be corrected to match the supplier invoice.
        </p>

        {order.items.map((item) => {
          const key = item.id ?? item.productId;
          const remaining = Math.max(0, item.quantity - (item.receivedQuantity ?? 0));
          const entry = lines[key] ?? { quantity: "0", unitCost: String(item.cost) };
          return (
            <div className="po-item" key={key}>
              <div className="row between wrap" style={{ gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.productName || "Unknown product"}</div>
                  <div className="hint">
                    {formatNumber(item.receivedQuantity ?? 0)} of {formatNumber(item.quantity)} already received
                  </div>
                </div>
                <Badge tone={remaining > 0 ? "warning" : "success"}>
                  {remaining > 0 ? `${formatNumber(remaining)} outstanding` : "Complete"}
                </Badge>
              </div>
              {remaining > 0 ? (
                <div className="grid-2" style={{ gap: 8 }}>
                  <Field label="Received now" htmlFor={`receive-qty-${key}`}>
                    <Input
                      id={`receive-qty-${key}`}
                      type="number"
                      min="0"
                      max={remaining}
                      step="1"
                      inputMode="decimal"
                      value={entry.quantity}
                      onChange={(event) =>
                        setLines((current) => ({
                          ...current,
                          [key]: { ...entry, quantity: event.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Unit cost" htmlFor={`receive-cost-${key}`}>
                    <Input
                      id={`receive-cost-${key}`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={entry.unitCost}
                      onChange={(event) =>
                        setLines((current) => ({
                          ...current,
                          [key]: { ...entry, unitCost: event.target.value },
                        }))
                      }
                    />
                  </Field>
                </div>
              ) : (
                <p className="hint" style={{ margin: 0 }}>
                  Nothing outstanding on this line.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
