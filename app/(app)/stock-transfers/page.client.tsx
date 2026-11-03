"use client";

// Opt out of instant-navigation validation: these pages render data-dependent client UI.
export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Boxes, Package, Plus, Trash2, Truck } from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Segmented,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { completeStockTransfer, createStockTransfer, listStockTransfers } from "@/lib/api/stock-transfers";
import { listProducts } from "@/lib/api/products";
import { stockByOutlet } from "@/lib/api/inventory";
import type { StockTransfer } from "@/lib/api/types";
import { formatDateTime, formatNumber } from "@/lib/formatting/currency";
import { useBusiness } from "@/lib/business/context";
import { usePermissions } from "@/lib/auth/auth-context";

type Tab = "all" | "open" | "completed";

type DraftLine = { productId: string; quantity: number };

const OPEN_STATUSES: StockTransfer["status"][] = ["draft", "approved", "in_transit"];

export default function StockTransfersPage() {
  const { has } = usePermissions();
  const { outlets, outletId } = useBusiness();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<Tab>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<StockTransfer | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const canAdjust = has("inventory.adjust");

  const transfersQuery = useQuery({ queryKey: ["stock-transfers"], queryFn: listStockTransfers });
  const productsQuery = useQuery({
    queryKey: ["stock-transfer-products"],
    queryFn: () => listProducts({ pageSize: 200 }),
    enabled: has("inventory.view"),
    staleTime: 60_000,
  });

  const transfers = transfersQuery.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const outletName = (id: string) => outlets.find((outlet) => outlet.id === id)?.name ?? "Unknown outlet";
  const productName = (id: string) => products.find((product) => product.id === id)?.name ?? `Product ${id}`;

  const filtered = React.useMemo(() => {
    const all = transfersQuery.data ?? [];
    if (tab === "open") return all.filter((transfer) => OPEN_STATUSES.includes(transfer.status));
    if (tab === "completed") return all.filter((transfer) => transfer.status === "completed");
    return all;
  }, [transfersQuery.data, tab]);

  const openCount = transfers.filter((transfer) => OPEN_STATUSES.includes(transfer.status)).length;
  const completedCount = transfers.filter((transfer) => transfer.status === "completed").length;
  const unitsMoved = transfers
    .filter((transfer) => transfer.status === "completed")
    .reduce((total, transfer) => total + transfer.items.reduce((sum, item) => sum + item.quantity, 0), 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-stock"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-recent-movements"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeStockTransfer(id),
    onSuccess: (transfer) => {
      invalidate();
      setDetail(null);
      push({
        title: "Transfer completed",
        description: `${transfer.items.length} line${transfer.items.length === 1 ? "" : "s"} moved from ${outletName(transfer.fromOutletId)} to ${outletName(transfer.toOutletId)}.`,
        variant: "success",
      });
    },
    onError: (error: Error) => push({ title: "Could not complete transfer", description: error.message, variant: "error" }),
  });

  if (!has("inventory.view")) {
    return <AccessDenied permission="inventory.view" />;
  }

  const columns: Column<StockTransfer>[] = [
    {
      id: "route",
      header: "Transfer",
      cell: (transfer) => (
        <div className="stack-sm" style={{ gap: 2 }}>
          <span className="row row-tight" style={{ gap: 6, fontWeight: 650 }}>
            {outletName(transfer.fromOutletId)}
            <ArrowRight aria-hidden="true" style={{ width: 13, height: 13 }} />
            {outletName(transfer.toOutletId)}
          </span>
          <span className="hint">{transfer.notes || "No notes"}</span>
        </div>
      ),
    },
    {
      id: "items",
      header: "Lines",
      align: "right",
      cell: (transfer) => <span className="num">{formatNumber(transfer.items.length)}</span>,
    },
    {
      id: "units",
      header: "Units",
      align: "right",
      cell: (transfer) => (
        <span className="num">{formatNumber(transfer.items.reduce((sum, item) => sum + item.quantity, 0))}</span>
      ),
    },
    {
      id: "created",
      header: "Created",
      cell: (transfer) => <span className="cell-muted">{formatDateTime(transfer.createdAt)}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (transfer) => <StatusBadge status={transfer.status} />,
    },
    ...(canAdjust
      ? [
          {
            id: "action",
            header: "Action",
            align: "right" as const,
            cell: (transfer: StockTransfer) =>
              transfer.status === "draft" ? (
                <Button
                  variant="quiet"
                  size="sm"
                  loading={completeMutation.isPending && completeMutation.variables === transfer.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    completeMutation.mutate(transfer.id);
                  }}
                >
                  Complete
                </Button>
              ) : (
                <span className="hint">—</span>
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Stock transfers"
        eyebrow={outlets.find((outlet) => outlet.id === outletId)?.name ?? "All outlets"}
        description="Move stock between outlets: draft the transfer, then complete it to update both balances."
        actions={
          canAdjust ? (
            <Button
              variant="primary"
              onClick={() => {
                setFormError(null);
                setCreateOpen(true);
              }}
            >
              <Plus aria-hidden="true" /> New transfer
            </Button>
          ) : undefined
        }
      />

      <div className="grid-3">
        <Stat compact label="Open transfers" value={formatNumber(openCount)} info="Drafts and transfers still in transit." />
        <Stat compact label="Completed" value={formatNumber(completedCount)} info="Transfers whose stock has moved." />
        <Stat compact label="Units moved" value={formatNumber(unitsMoved)} info="Units across completed transfers." />
      </div>

      <Card>
        <div className="toolbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <Segmented
            label="Transfer filter"
            options={[
              { value: "all", label: "All" },
              { value: "open", label: "Open" },
              { value: "completed", label: "Completed" },
            ]}
            value={tab}
            onChange={(value) => setTab(value as Tab)}
          />
          <div className="spacer" />
          <Link href="/inventory" className="btn btn--link btn--sm">
            <Boxes aria-hidden="true" /> Stock on hand
          </Link>
        </div>

        {transfersQuery.isError ? (
          <InlineError
            title="Transfers could not be loaded"
            error={transfersQuery.error}
            onRetry={() => transfersQuery.refetch()}
          />
        ) : (
          <DataTable
            rows={filtered}
            columns={columns}
            rowId={(transfer) => transfer.id}
            loading={transfersQuery.isLoading}
            dense
            minWidth={760}
            onRowClick={(transfer) => setDetail(transfer)}
            empty={
              <EmptyState
                icon={<Truck aria-hidden="true" />}
                title={transfers.length === 0 ? "No stock transfers yet" : "No transfers match this filter"}
                description={
                  transfers.length === 0
                    ? "Draft a transfer to move stock from one outlet to another."
                    : "Switch the filter to see the other transfers."
                }
                actions={
                  transfers.length === 0 && canAdjust ? (
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus aria-hidden="true" /> New transfer
                    </Button>
                  ) : undefined
                }
              />
            }
            mobile={(transfer) => (
              <div className="record">
                <div className="record__top">
                  <div style={{ minWidth: 0 }}>
                    <div className="record__title">
                      {outletName(transfer.fromOutletId)} → {outletName(transfer.toOutletId)}
                    </div>
                    <div className="record__meta">
                      {formatNumber(transfer.items.length)} lines · {formatDateTime(transfer.createdAt)}
                    </div>
                    <div style={{ marginTop: 5 }}>
                      <StatusBadge status={transfer.status} />
                    </div>
                  </div>
                  {canAdjust && transfer.status === "draft" ? (
                    <Button variant="secondary" size="sm" onClick={() => completeMutation.mutate(transfer.id)}>
                      Complete
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          />
        )}
      </Card>

      <CreateTransferDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultOutletId={outletId ?? outlets[0]?.id ?? ""}
        outlets={outlets.map((outlet) => ({ id: outlet.id, name: outlet.name }))}
        products={products.map((product) => ({ id: product.id, name: product.name, sku: product.sku }))}
        formError={formError}
        setFormError={setFormError}
        onSaved={(transfer) => {
          setCreateOpen(false);
          invalidate();
          push({
            title: "Transfer drafted",
            description: `${transfer.items.length} line${transfer.items.length === 1 ? "" : "s"} ready to move.`,
            variant: "success",
          });
        }}
      />

      <Dialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Transfer detail"
        description={
          detail ? `${outletName(detail.fromOutletId)} → ${outletName(detail.toOutletId)}` : undefined
        }
        width={520}
        footer={
          <>
            <Button variant="quiet" onClick={() => setDetail(null)}>
              Close
            </Button>
            {detail && detail.status === "draft" && canAdjust ? (
              <Button
                variant="primary"
                loading={completeMutation.isPending}
                onClick={() => completeMutation.mutate(detail.id)}
              >
                Complete transfer
              </Button>
            ) : null}
          </>
        }
      >
        {detail ? (
          <div className="stack">
            <div className="row row-between">
              <StatusBadge status={detail.status} />
              <span className="hint">
                Drafted {formatDateTime(detail.createdAt)}
                {detail.completedAt ? ` · completed ${formatDateTime(detail.completedAt)}` : ""}
              </span>
            </div>
            {detail.notes ? <p className="hint">{detail.notes}</p> : null}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ textAlign: "right" }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productName || productName(item.productId)}</td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {formatNumber(item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detail.status === "draft" ? (
              <p className="hint" style={{ margin: 0 }}>
                Completing moves these units out of {outletName(detail.fromOutletId)} and into{" "}
                {outletName(detail.toOutletId)}.
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

function CreateTransferDialog({
  open,
  onClose,
  defaultOutletId,
  outlets,
  products,
  formError,
  setFormError,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  defaultOutletId: string;
  outlets: { id: string; name: string }[];
  products: { id: string; name: string; sku: string }[];
  formError: string | null;
  setFormError: (message: string | null) => void;
  onSaved: (transfer: StockTransfer) => void;
}) {
  const [fromOutletId, setFromOutletId] = React.useState(defaultOutletId);
  const [toOutletId, setToOutletId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [productId, setProductId] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");

  const stockQuery = useQuery({
    queryKey: ["stock-transfer-stock", fromOutletId],
    queryFn: () => stockByOutlet(fromOutletId),
    enabled: open && Boolean(fromOutletId),
  });
  const stockMap = React.useMemo(
    () => new Map((stockQuery.data ?? []).map((row) => [row.productId, row.stock])),
    [stockQuery.data]
  );

  React.useEffect(() => {
    if (!open) return;
    setFromOutletId(defaultOutletId);
    setToOutletId(outlets.find((outlet) => outlet.id !== defaultOutletId)?.id ?? "");
    setNotes("");
    setLines([]);
    setProductId("");
    setQuantity("1");
    setFormError(null);
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addLine = () => {
    const amount = Number(quantity);
    if (!productId) {
      setFormError("Choose a product to add");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter a quantity greater than zero");
      return;
    }
    setFormError(null);
    setLines((current) => {
      const existing = current.find((line) => line.productId === productId);
      if (existing) {
        return current.map((line) =>
          line.productId === productId ? { ...line, quantity: line.quantity + amount } : line
        );
      }
      return [...current, { productId, quantity: amount }];
    });
    setProductId("");
    setQuantity("1");
  };

  const mutation = useMutation({
    mutationFn: () =>
      createStockTransfer({
        fromOutletId,
        toOutletId,
        notes: notes.trim() || undefined,
        items: lines,
      }),
    onSuccess: onSaved,
    onError: (error: Error) => setFormError(error.message),
  });

  const productName = (id: string) => products.find((product) => product.id === id)?.name ?? `Product ${id}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New stock transfer"
      description="Units leave the source outlet and arrive at the destination when you complete it."
      width={620}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={!fromOutletId || !toOutletId || lines.length === 0}
            onClick={() => mutation.mutate()}
          >
            Save draft
          </Button>
        </>
      }
    >
      <div className="stack">
        {formError ? <div className="alert alert--danger">{formError}</div> : null}

        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="From outlet" htmlFor="transfer-from" required>
            <Select
              id="transfer-from"
              value={fromOutletId}
              onChange={(event) => setFromOutletId(event.target.value)}
            >
              <option value="">Choose an outlet</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To outlet" htmlFor="transfer-to" required>
            <Select id="transfer-to" value={toOutletId} onChange={(event) => setToOutletId(event.target.value)}>
              <option value="">Choose an outlet</option>
              {outlets
                .filter((outlet) => outlet.id !== fromOutletId)
                .map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        <div className="stack-sm">
          <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
            <Field label="Product" htmlFor="transfer-product" required>
              <Select id="transfer-product" value={productId} onChange={(event) => setProductId(event.target.value)}>
                <option value="">Choose a product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {stockMap.has(product.id) ? ` · ${formatNumber(stockMap.get(product.id) ?? 0)} on hand` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity" htmlFor="transfer-quantity" required>
              <Input
                id="transfer-quantity"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                style={{ width: 120 }}
              />
            </Field>
            <Button variant="secondary" onClick={addLine}>
              <Plus aria-hidden="true" /> Add
            </Button>
          </div>

          {lines.length === 0 ? (
            <p className="hint" style={{ margin: 0 }}>
              Add the products this transfer should move.
            </p>
          ) : (
            <div className="stack-sm">
              {lines.map((line) => (
                <div key={line.productId} className="row row-between" style={{ gap: 8 }}>
                  <span className="row row-tight" style={{ gap: 6 }}>
                    <Package aria-hidden="true" style={{ width: 14, height: 14 }} />
                    {productName(line.productId)}
                    {stockMap.has(line.productId) ? (
                      <span className="hint" style={{ margin: 0 }}>
                        ({formatNumber(stockMap.get(line.productId) ?? 0)} on hand)
                      </span>
                    ) : null}
                  </span>
                  <span className="row row-tight" style={{ gap: 8 }}>
                    <Badge tone="neutral">{formatNumber(line.quantity)}</Badge>
                    <Button
                      variant="quiet"
                      size="sm"
                      aria-label={`Remove ${productName(line.productId)}`}
                      onClick={() => setLines((current) => current.filter((item) => item.productId !== line.productId))}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Field label="Notes" htmlFor="transfer-notes">
          <Textarea
            id="transfer-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional — why is this stock moving?"
          />
        </Field>
      </div>
    </Dialog>
  );
}
