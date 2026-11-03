"use client";

// Opt out of instant-navigation validation: these pages render data-dependent client UI.
export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, ClipboardCheck, Plus } from "lucide-react";
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
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  cancelStocktake,
  createStocktake,
  listStocktakes,
  postStocktake,
  saveStocktakeCounts,
} from "@/lib/api/stocktakes";
import type { Stocktake } from "@/lib/api/types";
import { formatDateTime, formatNumber } from "@/lib/formatting/currency";
import { useBusiness } from "@/lib/business/context";
import { usePermissions } from "@/lib/auth/auth-context";

type Tab = "all" | "open" | "completed";

const OPEN_STATUSES: Stocktake["status"][] = ["draft", "in_progress"];

export default function StocktakesPage() {
  const { has } = usePermissions();
  const { outlets, outletId } = useBusiness();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<Tab>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [countTarget, setCountTarget] = React.useState<Stocktake | null>(null);
  const [confirmPost, setConfirmPost] = React.useState(false);
  const [counts, setCounts] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const canAdjust = has("inventory.adjust");
  const stocktakesQuery = useQuery({ queryKey: ["stocktakes"], queryFn: listStocktakes });
  const stocktakes = stocktakesQuery.data ?? [];
  const outletName = (id: string) => outlets.find((outlet) => outlet.id === id)?.name ?? "Unknown outlet";

  const filtered = React.useMemo(() => {
    const all = stocktakesQuery.data ?? [];
    if (tab === "open") return all.filter((stocktake) => OPEN_STATUSES.includes(stocktake.status));
    if (tab === "completed") return all.filter((stocktake) => stocktake.status === "completed");
    return all;
  }, [stocktakesQuery.data, tab]);

  const openCount = stocktakes.filter((stocktake) => OPEN_STATUSES.includes(stocktake.status)).length;
  const completedCount = stocktakes.filter((stocktake) => stocktake.status === "completed").length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["stocktakes"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-stock"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-recent-movements"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const openCountSheet = (stocktake: Stocktake) => {
    setFormError(null);
    setConfirmPost(false);
    setCountTarget(stocktake);
    setCounts(Object.fromEntries(stocktake.items.map((item) => [item.id, String(item.countedQuantity)])));
  };

  const rows = (stocktake: Stocktake) =>
    stocktake.items.map((item) => ({
      id: item.id,
      countedQuantity: Number(counts[item.id] ?? 0) || 0,
    }));

  const saveMutation = useMutation({
    mutationFn: () => saveStocktakeCounts(countTarget!.id, { items: rows(countTarget!) }),
    onSuccess: (saved) => {
      invalidate();
      setCountTarget(saved);
      push({ title: "Progress saved", description: "Counted quantities are stored on the count.", variant: "success" });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      await saveStocktakeCounts(countTarget!.id, { items: rows(countTarget!) });
      return postStocktake(countTarget!.id);
    },
    onSuccess: () => {
      invalidate();
      setConfirmPost(false);
      setCountTarget(null);
      push({ title: "Stocktake posted", description: "Stock balances now match the counted quantities.", variant: "success" });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelStocktake(countTarget!.id),
    onSuccess: () => {
      invalidate();
      setCountTarget(null);
      push({ title: "Stocktake cancelled", description: "Stock was not changed.", variant: "success" });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const createMutation = useMutation({
    mutationFn: (input: { outletId: string; notes?: string }) => createStocktake(input),
    onSuccess: (created) => {
      invalidate();
      setCreateOpen(false);
      openCountSheet(created);
      push({
        title: "Count started",
        description: `${created.items.length} tracked product${created.items.length === 1 ? "" : "s"} snapshotted.`,
        variant: "success",
      });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  if (!has("inventory.view")) {
    return <AccessDenied permission="inventory.view" />;
  }

  const columns: Column<Stocktake>[] = [
    {
      id: "count",
      header: "Count",
      cell: (stocktake) => (
        <div className="stack-sm" style={{ gap: 2 }}>
          <b>{stocktake.notes || `Stocktake #${stocktake.id}`}</b>
          <span className="hint">
            {outletName(stocktake.outletId)} · {formatDateTime(stocktake.createdAt)}
          </span>
        </div>
      ),
    },
    {
      id: "lines",
      header: "Lines",
      align: "right",
      cell: (stocktake) => <span className="num">{formatNumber(stocktake.items.length)}</span>,
    },
    {
      id: "variance",
      header: "Variance",
      align: "right",
      cell: (stocktake) => {
        const variance = stocktake.items.reduce((total, item) => total + (item.countedQuantity - item.expectedQuantity), 0);
        if (!variance) return <span className="hint">Balanced</span>;
        return (
          <Badge tone={variance > 0 ? "info" : "warning"}>
            {variance > 0 ? "+" : ""}
            {formatNumber(variance)} units
          </Badge>
        );
      },
    },
    { id: "status", header: "Status", cell: (stocktake) => <StatusBadge status={stocktake.status} /> },
    ...(canAdjust
      ? [
          {
            id: "action",
            header: "Action",
            align: "right" as const,
            cell: (stocktake: Stocktake) =>
              OPEN_STATUSES.includes(stocktake.status) ? (
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    openCountSheet(stocktake);
                  }}
                >
                  {stocktake.status === "draft" ? "Start counting" : "Resume count"}
                </Button>
              ) : (
                <span className="hint">—</span>
              ),
          },
        ]
      : []),
  ];

  const countedRows = countTarget
    ? countTarget.items.filter((item) => Number(counts[item.id] ?? 0) > 0).length
    : 0;
  const varianceTotal = countTarget
    ? countTarget.items.reduce(
        (total, item) => total + (Number(counts[item.id] ?? 0) || 0) - item.expectedQuantity,
        0
      )
    : 0;
  const expectedTotal = countTarget
    ? countTarget.items.reduce((total, item) => total + item.expectedQuantity, 0)
    : 0;
  const countedTotal = countTarget
    ? countTarget.items.reduce((total, item) => total + (Number(counts[item.id] ?? 0) || 0), 0)
    : 0;
  // Counting everything as zero while stock exists would wipe the outlet's
  // balances. Posting is still allowed (the stock really may be gone), but it
  // needs an explicit confirmation that names the impact.
  const zeroWipe =
    Boolean(countTarget) &&
    countTarget!.items.length > 0 &&
    countTarget!.items.every((item) => (Number(counts[item.id] ?? 0) || 0) === 0) &&
    countTarget!.items.some((item) => item.expectedQuantity !== 0);

  return (
    <>
      <PageHeader
        title="Stocktakes"
        eyebrow={outlets.find((outlet) => outlet.id === outletId)?.name ?? "All outlets"}
        description="Count what is on the shelf, review the variance, then post it so stock matches reality."
        actions={
          canAdjust ? (
            <Button
              variant="primary"
              onClick={() => {
                setFormError(null);
                setCreateOpen(true);
              }}
            >
              <Plus aria-hidden="true" /> New count
            </Button>
          ) : undefined
        }
      />

      <div className="grid-3">
        <Stat compact label="Open counts" value={formatNumber(openCount)} info="Drafts and counts still in progress." />
        <Stat compact label="Completed" value={formatNumber(completedCount)} info="Counts that have posted adjustments." />
        <Stat
          compact
          label="Last variance"
          value={
            stocktakes[0]
              ? formatNumber(
                  stocktakes[0].items.reduce((total, item) => total + (item.countedQuantity - item.expectedQuantity), 0)
                )
              : "—"
          }
          info="Units short or over on the most recent count."
        />
      </div>

      <Card>
        <div className="toolbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <Segmented
            label="Stocktake filter"
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

        {stocktakesQuery.isError ? (
          <InlineError
            title="Stocktakes could not be loaded"
            error={stocktakesQuery.error}
            onRetry={() => stocktakesQuery.refetch()}
          />
        ) : (
          <DataTable
            rows={filtered}
            columns={columns}
            rowId={(stocktake) => stocktake.id}
            loading={stocktakesQuery.isLoading}
            dense
            minWidth={760}
            onRowClick={openCountSheet}
            empty={
              <EmptyState
                icon={<ClipboardCheck aria-hidden="true" />}
                title={stocktakes.length === 0 ? "No stocktakes yet" : "No stocktakes match this filter"}
                description={
                  stocktakes.length === 0
                    ? "Start a count to snapshot the tracked products at an outlet."
                    : "Switch the filter to see the other counts."
                }
                actions={
                  stocktakes.length === 0 && canAdjust ? (
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus aria-hidden="true" /> New count
                    </Button>
                  ) : undefined
                }
              />
            }
            mobile={(stocktake) => {
              const variance = stocktake.items.reduce(
                (total, item) => total + (item.countedQuantity - item.expectedQuantity),
                0
              );
              return (
                <div className="record">
                  <div className="record__top">
                    <div style={{ minWidth: 0 }}>
                      <div className="record__title">{stocktake.notes || `Stocktake #${stocktake.id}`}</div>
                      <div className="record__meta">
                        {outletName(stocktake.outletId)} · {formatDateTime(stocktake.createdAt)}
                      </div>
                      <div className="row row-tight" style={{ marginTop: 5 }}>
                        <StatusBadge status={stocktake.status} />
                        {variance ? (
                          <span className="hint" style={{ margin: 0 }}>
                            {variance > 0 ? "+" : ""}
                            {formatNumber(variance)} units
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {canAdjust && OPEN_STATUSES.includes(stocktake.status) ? (
                      <Button variant="secondary" size="sm" onClick={() => openCountSheet(stocktake)}>
                        Count
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            }}
          />
        )}
      </Card>

      <NewStocktakeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultOutletId={outletId ?? outlets[0]?.id ?? ""}
        outlets={outlets.map((outlet) => ({ id: outlet.id, name: outlet.name }))}
        formError={formError}
        setFormError={setFormError}
        pending={createMutation.isPending}
        onCreate={(input) => createMutation.mutate(input)}
      />

      <Dialog
        open={Boolean(countTarget)}
        onClose={() => setCountTarget(null)}
        title={countTarget ? countTarget.notes || `Stocktake #${countTarget.id}` : "Stocktake"}
        description={
          countTarget
            ? `${outletName(countTarget.outletId)} · ${formatDateTime(countTarget.createdAt)}`
            : undefined
        }
        width={760}
        footer={
          countTarget && OPEN_STATUSES.includes(countTarget.status) && canAdjust ? (
            <>
              <Button
                variant="quiet"
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                Cancel count
              </Button>
              <Button variant="secondary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                Save progress
              </Button>
              <Button variant="primary" loading={postMutation.isPending} onClick={() => setConfirmPost(true)}>
                Post count
              </Button>
            </>
          ) : (
            <Button variant="quiet" onClick={() => setCountTarget(null)}>
              Close
            </Button>
          )
        }
      >
        {countTarget ? (
          <div className="stack">
            {formError ? <div className="alert alert--danger">{formError}</div> : null}
            <div className="row row-between">
              <StatusBadge status={countTarget.status} />
              <span className="hint" style={{ margin: 0 }}>
                {countedRows}/{countTarget.items.length} counted · variance{" "}
                {varianceTotal > 0 ? "+" : ""}
                {formatNumber(varianceTotal)} units
              </span>
            </div>

            {countTarget.items.length === 0 ? (
              <p className="hint">No tracked products at this outlet yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: "right" }}>Expected</th>
                      <th style={{ textAlign: "right" }}>Counted</th>
                      <th style={{ textAlign: "right" }}>Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countTarget.items.map((item) => {
                      const counted = Number(counts[item.id] ?? 0) || 0;
                      const variance = counted - item.expectedQuantity;
                      const editable = canAdjust && OPEN_STATUSES.includes(countTarget.status);
                      return (
                        <tr key={item.id}>
                          <td>
                            <div style={{ fontWeight: 550 }}>{item.productName || `Product ${item.productId}`}</div>
                            {item.sku ? <div className="hint mono">{item.sku}</div> : null}
                          </td>
                          <td className="num" style={{ textAlign: "right" }}>
                            {formatNumber(item.expectedQuantity)}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {editable ? (
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={counts[item.id] ?? ""}
                                aria-label={`Counted quantity for ${item.productName ?? item.productId}`}
                                onChange={(event) =>
                                  setCounts((current) => ({ ...current, [item.id]: event.target.value }))
                                }
                                style={{ width: 100, textAlign: "right" }}
                              />
                            ) : (
                              <span className="num">{formatNumber(item.countedQuantity)}</span>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {variance ? (
                              <Badge tone={variance > 0 ? "info" : "warning"}>
                                {variance > 0 ? "+" : ""}
                                {formatNumber(variance)}
                              </Badge>
                            ) : (
                              <span className="hint">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {countTarget.status === "completed" ? (
              <p className="hint" style={{ margin: 0 }}>
                Posted {countTarget.completedAt ? formatDateTime(countTarget.completedAt) : ""}. Balances and movement
                log now reflect these counts.
              </p>
            ) : (
              <p className="hint" style={{ margin: 0 }}>
                Posting writes the difference between counted and expected as an inventory adjustment.
              </p>
            )}
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirmPost && Boolean(countTarget)}
        onClose={() => setConfirmPost(false)}
        onConfirm={() => {
          setConfirmPost(false);
          postMutation.mutate();
        }}
        title={zeroWipe ? "Post an all-zero count?" : "Post this stocktake?"}
        confirmLabel="Post count"
        tone={zeroWipe ? "danger" : "primary"}
        loading={postMutation.isPending}
        description={
          countTarget ? (
            <>
              {zeroWipe ? (
                <>
                  Every line is counted as zero, but the outlet currently holds <b>{formatNumber(expectedTotal)} units</b>.
                  Posting writes that difference as an inventory adjustment and leaves these products at zero.{" "}
                </>
              ) : (
                <>
                  {countedRows} of {countTarget.items.length} lines have a counted quantity.{" "}
                </>
              )}
              Expected {formatNumber(expectedTotal)} units, counted {formatNumber(countedTotal)} units, variance{" "}
              {varianceTotal > 0 ? "+" : ""}
              {formatNumber(varianceTotal)} units. Posting closes the count.
            </>
          ) : null
        }
      />
    </>
  );
}

function NewStocktakeDialog({
  open,
  onClose,
  defaultOutletId,
  outlets,
  formError,
  setFormError,
  pending,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  defaultOutletId: string;
  outlets: { id: string; name: string }[];
  formError: string | null;
  setFormError: (message: string | null) => void;
  pending: boolean;
  onCreate: (input: { outletId: string; notes?: string }) => void;
}) {
  const [outlet, setOutlet] = React.useState(defaultOutletId);
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setOutlet(defaultOutletId);
    setNotes("");
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New stocktake"
      description="Snapshots every tracked product at the outlet so you can enter counted quantities."
      width={460}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!outlet}
            onClick={() => onCreate({ outletId: outlet, notes: notes.trim() || undefined })}
          >
            Start count
          </Button>
        </>
      }
    >
      <div className="stack">
        {formError ? <div className="alert alert--danger">{formError}</div> : null}
        <Field label="Outlet" htmlFor="stocktake-outlet" required>
          <Select id="stocktake-outlet" value={outlet} onChange={(event) => setOutlet(event.target.value)}>
            <option value="">Choose an outlet</option>
            {outlets.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" htmlFor="stocktake-notes" hint="For example: weekly bar count, month end.">
          <Textarea
            id="stocktake-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional"
          />
        </Field>
      </div>
    </Dialog>
  );
}
