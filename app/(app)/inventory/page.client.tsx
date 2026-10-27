"use client";

// Opt out of instant-navigation validation: these pages render data-dependent client UI.
export const instant = false;


import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  Boxes,
  ClipboardList,
  Package,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageSizeSelect,
  Select,
  Segmented,
  Textarea,
  InfoTip,
} from "@/components/ui/primitives";
import { DataTable, Pagination, TablePagination, type Column } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { adjustStock, listMovements, stockByOutlet } from "@/lib/api/inventory";
import { listProducts } from "@/lib/api/products";
import type { InventoryMovement } from "@/lib/api/types";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/formatting/currency";
import { useBusiness } from "@/lib/business/context";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced";

const LOW_STOCK = 10;

type Tab = "stock" | "movements";
type StockFilter = "all" | "low" | "out" | "healthy";

type StockLine = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  stock: number;
  cost: number;
  price: number;
  trackInventory: boolean;
};

export default function InventoryPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId, outlet } = useBusiness();
  const [tab, setTab] = React.useState<Tab>("stock");
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<StockFilter>("all");
  const [movementPage, setMovementPage] = React.useState(1);
  const [movementPageSize, setMovementPageSize] = React.useState(20);
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [adjustProductId, setAdjustProductId] = React.useState("");
  const debounced = useDebouncedValue(search, 200);
  const currency = session?.business.currency ?? "IDR";
  const canAdjust = has("inventory.adjust");

  const stockQuery = useQuery({
    queryKey: ["inventory-stock", outletId],
    queryFn: () => stockByOutlet(outletId!),
    enabled: has("inventory.view") && Boolean(outletId),
    staleTime: 20_000,
  });

  const productsQuery = useQuery({
    queryKey: ["inventory-products"],
    queryFn: () => listProducts({ pageSize: 200 }),
    enabled: has("inventory.view"),
    staleTime: 60_000,
  });

  const movementsQuery = useQuery({
    queryKey: ["inventory-movements", outletId, movementPage, movementPageSize],
    queryFn: () => listMovements({ page: movementPage, pageSize: movementPageSize }),
    enabled: has("inventory.view") && tab === "movements",
    placeholderData: (previous) => previous,
    staleTime: 20_000,
  });

  React.useEffect(() => {
    setMovementPage(1);
  }, [movementPageSize, outletId]);

  const stockMap = React.useMemo(
    () => new Map((stockQuery.data ?? []).map((row) => [row.productId, row.stock])),
    [stockQuery.data]
  );

  const lines: StockLine[] = React.useMemo(() => {
    const products = productsQuery.data?.data ?? [];
    const result = products
      .filter((product) => product.trackInventory !== false)
      .map((product) => ({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit ?? "pcs",
        stock: stockMap.get(product.id) ?? 0,
        cost: product.cost,
        price: product.price,
        trackInventory: true,
      }));
    const known = new Set(result.map((line) => line.productId));
    (stockQuery.data ?? []).forEach((row) => {
      if (known.has(row.productId)) return;
      result.push({
        productId: row.productId,
        name: row.name,
        sku: row.sku,
        unit: "pcs",
        stock: row.stock,
        cost: 0,
        price: 0,
        trackInventory: true,
      });
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [productsQuery.data, stockQuery.data, stockMap]);

  const filtered = React.useMemo(() => {
    const query = debounced.trim().toLowerCase();
    return lines.filter((line) => {
      if (query && !line.name.toLowerCase().includes(query) && !line.sku.toLowerCase().includes(query)) return false;
      if (filter === "out") return line.stock <= 0;
      if (filter === "low") return line.stock > 0 && line.stock <= LOW_STOCK;
      if (filter === "healthy") return line.stock > LOW_STOCK;
      return true;
    });
  }, [lines, debounced, filter]);

  const totals = React.useMemo(() => {
    return lines.reduce(
      (sum, line) => {
        sum.units += line.stock;
        sum.cost += line.stock * line.cost;
        sum.retail += line.stock * line.price;
        if (line.stock <= 0) sum.out += 1;
        else if (line.stock <= LOW_STOCK) sum.low += 1;
        return sum;
      },
      { units: 0, cost: 0, retail: 0, out: 0, low: 0 }
    );
  }, [lines]);

  const productsWithMissingCost = lines.filter((line) => line.cost <= 0 && line.stock > 0).length;

  if (!has("inventory.view")) {
    return <AccessDenied permission="inventory.view" />;
  }

  const openAdjust = (productId?: string) => {
    setAdjustProductId(productId ?? lines[0]?.productId ?? "");
    setAdjustOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setFilter("all");
  };

  const stockColumns: Column<StockLine>[] = [
    {
      id: "product",
      header: "Product",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div className="hint mono" style={{ fontSize: 10.5 }}>
            {row.sku}
          </div>
        </div>
      ),
    },
    {
      id: "stock",
      header: "On hand",
      align: "right",
      cell: (row) => (
        <div className="row row-tight" style={{ justifyContent: "flex-end" }}>
          <span className="num" style={{ fontWeight: 650 }}>
            {formatNumber(row.stock)}
          </span>
          <span className="hint" style={{ margin: 0 }}>
            {row.unit}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) =>
        row.stock <= 0 ? (
          <Badge tone="danger" dot>
            Out of stock
          </Badge>
        ) : row.stock <= LOW_STOCK ? (
          <Badge tone="warning" dot>
            Low
          </Badge>
        ) : (
          <Badge tone="success" dot>
            Healthy
          </Badge>
        ),
    },
    {
      id: "cost",
      header: "Value at cost",
      align: "right",
      cell: (row) => (
        <span className="num">{row.cost > 0 ? formatCurrency(row.stock * row.cost, currency) : "—"}</span>
      ),
    },
    {
      id: "retail",
      header: "Value at retail",
      align: "right",
      cell: (row) => (
        <span className="cell-muted num">{row.price > 0 ? formatCurrency(row.stock * row.price, currency) : "—"}</span>
      ),
    },
    ...(canAdjust
      ? [
          {
            id: "adjust",
            header: "",
            align: "right" as const,
            cell: (row: StockLine) => (
              <Button
                variant="quiet"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openAdjust(row.productId);
                }}
              >
                Adjust
              </Button>
            ),
          },
        ]
      : []),
  ];

  const movementColumns: Column<InventoryMovement>[] = [
    {
      id: "when",
      header: "When",
      cell: (row) => <span className="cell-muted">{formatDateTime(row.createdAt)}</span>,
    },
    {
      id: "product",
      header: "Product",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 550 }}>{row.productName || "Unknown product"}</div>
          <div className="hint">{row.reason || "No reason recorded"}</div>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (row) => <Badge tone={movementTone(row.type)}>{movementLabel(row.type)}</Badge>,
    },
    {
      id: "quantity",
      header: "Change",
      align: "right",
      cell: (row) => (
        <span
          className="num"
          style={{ fontWeight: 650, color: row.quantity < 0 ? "hsl(var(--danger))" : "hsl(var(--success))" }}
        >
          {row.quantity > 0 ? "+" : ""}
          {formatNumber(row.quantity)}
        </span>
      ),
    },
    {
      id: "balance",
      header: "Balance after",
      align: "right",
      cell: (row) => (
        <span className="cell-muted num">
          {row.balanceAfter === undefined ? "—" : formatNumber(row.balanceAfter)}
        </span>
      ),
    },
  ];

  const loading = stockQuery.isLoading || productsQuery.isLoading;

  return (
    <>
      <PageHeader
        title="Inventory"
        eyebrow={outlet?.name ?? "Selected outlet"}
        description="Stock on hand by outlet, with a complete audit trail for every adjustment."
        actions={
          <>
            <Link href="/products" className="btn btn--secondary">
              <Package aria-hidden="true" />
              Catalog
            </Link>
            {canAdjust ? (
              <Button variant="primary" onClick={() => openAdjust()}>
                <ArrowDownToLine aria-hidden="true" />
                Adjust stock
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid-4">
        <Stat
          label="Units on hand"
          value={formatNumber(totals.units)}
          info="Sum of units across tracked products at this outlet. Each product contributes its on-hand quantity once."
          foot={<span>{formatNumber(lines.length)} tracked products</span>}
        />
        <Stat
          label="Stock value at cost"
          value={formatCurrency(totals.cost, currency)}
          info="On-hand units multiplied by each product's cost price. This is the accounting value of stock, not the sum of quantities."
          foot={
            <span>
              {productsWithMissingCost
                ? `${productsWithMissingCost} products have no cost price`
                : "Cost prices are complete"}
            </span>
          }
        />
        <Stat
          label="Stock value at retail"
          value={formatCurrency(totals.retail, currency)}
          info="On-hand units multiplied by each product's selling price. Tax and future discounts are not included."
          foot={<span>Before tax and markdowns</span>}
        />
        <Stat
          label="Needs attention"
          value={formatNumber(totals.out + totals.low)}
          info={`Tracked products at or below ${LOW_STOCK} units, including out-of-stock items.`}
          foot={
            <>
              <Badge tone="danger" dot>
                {formatNumber(totals.out)} out
              </Badge>
              <Badge tone="warning" dot>
                {formatNumber(totals.low)} low
              </Badge>
            </>
          }
        />
      </div>

      <Card>
        <div className="toolbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <Segmented
            label="Inventory view"
            options={[
              { value: "stock", label: "Stock on hand" },
              { value: "movements", label: "Movement log" },
            ]}
            value={tab}
            onChange={(value) => setTab(value as Tab)}
          />
          <div className="spacer" />
          {tab === "stock" ? (
            <>
              <label className="toolbar__search input-affix">
                <Search aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search product or SKU"
                  aria-label="Search stock"
                />
                {search ? (
                  <button type="button" className="icon-btn" onClick={() => setSearch("")} aria-label="Clear search">
                    <X aria-hidden="true" />
                  </button>
                ) : null}
              </label>
              <label className="row row-tight hint" style={{ gap: 6 }}>
                <SlidersHorizontal aria-hidden="true" style={{ width: 13, height: 13 }} />
                Stock
                <Select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as StockFilter)}
                  aria-label="Filter by stock level"
                  style={{ width: 130 }}
                >
                  <option value="all">All levels</option>
                  <option value="out">Out of stock</option>
                  <option value="low">Low stock</option>
                  <option value="healthy">Healthy</option>
                </Select>
              </label>
            </>
          ) : (
            <span className="hint" style={{ margin: 0 }}>
              Latest movements at this outlet
            </span>
          )}
        </div>

        {stockQuery.isError || productsQuery.isError ? (
          <InlineError
            title="Inventory could not be loaded"
            error={stockQuery.error ?? productsQuery.error}
            onRetry={() => {
              stockQuery.refetch();
              productsQuery.refetch();
            }}
          />
        ) : tab === "stock" ? (
          <DataTable
            rows={filtered}
            columns={stockColumns}
            rowId={(row) => row.productId}
            loading={loading}
            minWidth={720}
            empty={
              <EmptyState
                icon={<Boxes aria-hidden="true" />}
                title={
                  lines.length === 0
                    ? "No tracked products yet"
                    : search || filter !== "all"
                      ? "No stock matches these filters"
                      : "No stock to show"
                }
                description={
                  lines.length === 0
                    ? "Create tracked products in the catalog before receiving or adjusting stock."
                    : search || filter !== "all"
                      ? "Try a different search or stock level."
                      : "Stock balances will appear after products are added."
                }
                actions={
                  lines.length === 0 ? (
                    <Link href="/products" className="btn btn--secondary">
                      Go to products
                    </Link>
                  ) : search || filter !== "all" ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            }
            mobile={(row) => (
              <div className="record">
                <div className="record__top">
                  <div style={{ minWidth: 0 }}>
                    <div className="record__title">{row.name}</div>
                    <div className="record__meta mono">{row.sku}</div>
                    <div className="row row-tight" style={{ marginTop: 5 }}>
                      {row.stock <= 0 ? (
                        <Badge tone="danger" dot>
                          Out of stock
                        </Badge>
                      ) : row.stock <= LOW_STOCK ? (
                        <Badge tone="warning" dot>
                          Low
                        </Badge>
                      ) : (
                        <Badge tone="success" dot>
                          Healthy
                        </Badge>
                      )}
                      {row.cost > 0 ? (
                        <span className="hint" style={{ margin: 0 }}>
                          {formatCurrency(row.stock * row.cost, currency)} at cost
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <b className="num">{formatNumber(row.stock)}</b>
                    <div className="hint">{row.unit}</div>
                    {canAdjust ? (
                      <Button variant="quiet" size="sm" onClick={() => openAdjust(row.productId)}>
                        Adjust
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          />
        ) : movementsQuery.isError ? (
          <InlineError
            title="The movement log could not be loaded"
            error={movementsQuery.error}
            onRetry={() => movementsQuery.refetch()}
          />
        ) : (
          <DataTable
            rows={movementsQuery.data?.data ?? []}
            columns={movementColumns}
            rowId={(row) => row.id}
            loading={movementsQuery.isLoading && !movementsQuery.data}
            minWidth={680}
            empty={
              <EmptyState
                icon={<ClipboardList aria-hidden="true" />}
                title="No movements yet"
                description="Sales, voids, and stock adjustments will be recorded here with their reason and balance."
                actions={
                  canAdjust ? (
                    <Button variant="secondary" onClick={() => openAdjust()}>
                      Make the first adjustment
                    </Button>
                  ) : undefined
                }
              />
            }
            mobile={(row) => (
              <div className="record">
                <div className="record__top">
                  <div style={{ minWidth: 0 }}>
                    <div className="record__title">{row.productName || "Unknown product"}</div>
                    <div className="record__meta">
                      {movementLabel(row.type)} · {formatDateTime(row.createdAt)}
                    </div>
                    <div className="hint" style={{ marginTop: 3 }}>
                      {row.reason || "No reason recorded"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <b
                      className="num"
                      style={{ color: row.quantity < 0 ? "hsl(var(--danger))" : "hsl(var(--success))" }}
                    >
                      {row.quantity > 0 ? "+" : ""}
                      {formatNumber(row.quantity)}
                    </b>
                    <div className="hint">
                      {row.balanceAfter === undefined ? "—" : `${formatNumber(row.balanceAfter)} after`}
                    </div>
                  </div>
                </div>
              </div>
            )}
            footer={
              <TablePagination>
                <PageSizeSelect value={movementPageSize} onChange={setMovementPageSize} options={[10, 20, 50]} />
                <Pagination
                  page={movementsQuery.data?.page ?? movementPage}
                  totalPages={movementsQuery.data?.totalPages ?? 1}
                  total={movementsQuery.data?.total ?? 0}
                  pageSize={movementPageSize}
                  onPageChange={setMovementPage}
                  label="movements"
                />
              </TablePagination>
            }
          />
        )}
      </Card>

      <p className="hint" style={{ margin: 0 }}>
        {productsQuery.data && productsQuery.data.total > (productsQuery.data.data.length ?? 0)
          ? `Stock totals cover the first ${formatNumber(productsQuery.data.data.length)} of ${formatNumber(productsQuery.data.total)} products.`
          : "Stock value uses on-hand units × cost or selling price; it is not a count of stock records."}
      </p>

      {canAdjust ? (
        <AdjustDialog
          open={adjustOpen}
          onClose={() => setAdjustOpen(false)}
          lines={lines}
          initialProductId={adjustProductId}
          outletName={outlet?.name ?? "this outlet"}
          currency={currency}
          onSaved={() => {
            setAdjustOpen(false);
            stockQuery.refetch();
            productsQuery.refetch();
            movementsQuery.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function movementLabel(type: InventoryMovement["type"]) {
  const labels: Record<InventoryMovement["type"], string> = {
    adjustment: "Adjustment",
    transfer: "Transfer",
    receive: "Received",
    sale: "Sale",
    return: "Return",
    void: "Void",
    damaged: "Damaged",
    missing: "Missing",
    expired: "Expired",
    write_off: "Write-off",
  };
  return labels[type] ?? type;
}

function movementTone(type: InventoryMovement["type"]) {
  if (type === "sale" || type === "damaged" || type === "missing" || type === "expired" || type === "write_off") {
    return "danger" as const;
  }
  if (type === "receive" || type === "return") return "success" as const;
  if (type === "void") return "warning" as const;
  return "info" as const;
}

function AdjustDialog({
  open,
  onClose,
  lines,
  initialProductId,
  outletName,
  currency,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  lines: StockLine[];
  initialProductId: string;
  outletName: string;
  currency: string;
  onSaved: () => void;
}) {
  const { outletId } = useBusiness();
  const { has } = usePermissions();
  const { push } = useToast();
  const [productId, setProductId] = React.useState(initialProductId);
  const [direction, setDirection] = React.useState<"add" | "remove">("add");
  const [quantity, setQuantity] = React.useState("1");
  const [reason, setReason] = React.useState("");
  const [type, setType] = React.useState<InventoryMovement["type"]>("adjustment");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setProductId(initialProductId || lines[0]?.productId || "");
    setDirection("add");
    setQuantity("1");
    setReason("");
    setType("adjustment");
    setError(null);
  }, [open, initialProductId, lines]);

  const line = lines.find((item) => item.productId === productId);
  const amount = Number(quantity);
  const signed = direction === "add" ? amount : -amount;
  const resulting = (line?.stock ?? 0) + (Number.isFinite(signed) ? signed : 0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!outletId) throw new Error("Select an outlet first");
      if (!productId) throw new Error("Choose a product");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a quantity greater than zero");
      if (!reason.trim()) throw new Error("Give the adjustment a reason");
      if (direction === "remove" && line && amount > line.stock) {
        throw new Error(`Only ${formatNumber(line.stock)} ${line.unit} are on hand.`);
      }
      return adjustStock({
        productId,
        outletId,
        quantity: signed,
        reason: reason.trim(),
        type: direction === "add" ? "adjustment" : type,
      });
    },
    onSuccess: () => {
      push({
        title: "Stock adjusted",
        description: `${line?.name ?? "Product"} · ${signed > 0 ? "+" : ""}${formatNumber(signed)} ${line?.unit ?? ""}`,
        variant: "success",
      });
      onSaved();
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : "The adjustment could not be saved.");
    },
  });

  if (!has("inventory.adjust")) return null;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title="Adjust stock"
      description={`Every change is recorded against ${outletName} with a reason and an owner.`}
      width={470}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Apply adjustment
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

        <Field label="Product" htmlFor="adjust-product" required>
          <Select
            id="adjust-product"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            disabled={!lines.length}
          >
            {lines.length === 0 ? <option value="">No tracked products</option> : null}
            {lines.map((item) => (
              <option key={item.productId} value={item.productId}>
                {item.name} · {formatNumber(item.stock)} {item.unit}
              </option>
            ))}
          </Select>
        </Field>

        {line ? (
          <div className="inset">
            <div className="row between">
              <span className="hint" style={{ margin: 0 }}>
                On hand now
              </span>
              <b className="num">
                {formatNumber(line.stock)} {line.unit}
              </b>
            </div>
            <div className="row between" style={{ marginTop: 5 }}>
              <span className="hint" style={{ margin: 0 }}>
                After this adjustment
              </span>
              <b className="num" style={{ color: resulting < 0 ? "hsl(var(--danger))" : undefined }}>
                {formatNumber(resulting)} {line.unit}
              </b>
            </div>
            {line.cost > 0 ? (
              <div className="row between" style={{ marginTop: 5 }}>
                <span className="hint" style={{ margin: 0 }}>
                  Change in stock value
                </span>
                <span className="num">{formatCurrency(Math.abs(signed || 0) * line.cost, currency)}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Direction">
            <Segmented
              label="Adjustment direction"
              options={[
                { value: "add", label: "Add stock" },
                { value: "remove", label: "Remove" },
              ]}
              value={direction}
              onChange={(value) => setDirection(value as "add" | "remove")}
            />
          </Field>
          <Field
            label={`Quantity${line ? ` (${line.unit})` : ""}`}
            htmlFor="adjust-quantity"
            required
            error={resulting < 0 ? "This would take stock below zero." : undefined}
          >
            <Input
              id="adjust-quantity"
              type="number"
              min="0.0001"
              step="1"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
        </div>

        {direction === "remove" ? (
          <Field
            label="Reason category"
            htmlFor="adjust-type"
            hint="Use the category that best explains why stock is leaving."
          >
            <Select
              id="adjust-type"
              value={type}
              onChange={(event) => setType(event.target.value as InventoryMovement["type"])}
            >
              <option value="adjustment">Count correction</option>
              <option value="damaged">Damaged</option>
              <option value="missing">Missing</option>
              <option value="expired">Expired</option>
              <option value="write_off">Write-off</option>
            </Select>
          </Field>
        ) : null}

        <Field
          label="Reason"
          htmlFor="adjust-reason"
          required
          hint="This appears in the movement log and cannot be edited later."
        >
          <Textarea
            id="adjust-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              direction === "add" ? "For example: delivery from supplier, opening count" : "For example: damaged in storage"
            }
          />
        </Field>

        <div className="row" style={{ gap: 6, alignItems: "flex-start" }}>
          <InfoTip label="How stock adjustments work">
            Positive quantities add stock. Removal quantities subtract stock. Sales and voids update balances
            automatically; use this form only for corrections, damage, loss, or opening stock.
          </InfoTip>
          <span className="hint" style={{ margin: 0 }}>
            Adjustments are auditable and affect stock value immediately.
          </span>
        </div>
      </div>
    </Dialog>
  );
}
