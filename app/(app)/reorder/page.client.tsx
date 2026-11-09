"use client";

// Opt out of instant-navigation validation: this page renders data-dependent client UI.
export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ClipboardList, Flame, PackageSearch, Search, X } from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Badge, Button, Checkbox, EmptyState, Input } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { draftPurchaseOrder, getReorderForecast } from "@/lib/api/reorder";
import type { ReorderDraft, ReorderIngredient } from "@/lib/api/types";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";
import { formatCurrency, formatNumber, formatShortDate } from "@/lib/formatting/currency";

/** Quantities are fractional (grams, millilitres), so keep a point separator. */
function quantity(value: number) {
  return formatNumber(value, "en-GB");
}

function methodLabel(ingredient: ReorderIngredient) {
  switch (ingredient.forecast.method) {
    case "recipe-demand":
      return { label: "Recipe demand", tone: "success" as const };
    case "photo-demand":
      return { label: "Photo demand", tone: "info" as const };
    default:
      return { label: "Blind spot", tone: "neutral" as const };
  }
}

function reorderTone(ingredient: ReorderIngredient) {
  if (ingredient.forecast.currentStock <= 0) return "danger" as const;
  if (ingredient.forecast.reorderQuantity > 0) return "warning" as const;
  return "success" as const;
}

function reorderLabel(ingredient: ReorderIngredient) {
  if (ingredient.forecast.reorderQuantity > 0) {
    return `${quantity(ingredient.forecast.reorderQuantity)} ${ingredient.unit}`;
  }
  if (ingredient.forecast.method === "none") return "No forecast";
  return "Covered";
}

export default function ReorderPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId, outlet } = useBusiness();

  const [search, setSearch] = React.useState("");
  const [onlyReorder, setOnlyReorder] = React.useState(false);
  const [detail, setDetail] = React.useState<ReorderIngredient | null>(null);

  const canManage = has("purchasing.manage");

  const forecastQuery = useQuery({
    queryKey: ["reorder-forecast", outletId],
    queryFn: () => getReorderForecast(),
    enabled: canManage,
    staleTime: 60_000,
  });

  const [draft, setDraft] = React.useState<ReorderDraft | null>(null);

  const draftMutation = useMutation({
    mutationFn: () => draftPurchaseOrder(),
    onSuccess: (result) => {
      setDraft(result);
      forecastQuery.refetch();
    },
  });

  if (!canManage) {
    return <AccessDenied permission="purchasing.manage" />;
  }

  const forecast = forecastQuery.data;
  const rows = forecast?.ingredients ?? [];
  const currency =
    forecast?.purchaseMoneyBudget.currency ?? session?.business.currency ?? "IDR";

  const query = search.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (onlyReorder && row.forecast.reorderQuantity <= 0) return false;
    if (!query) return true;
    return (
      row.name.toLowerCase().includes(query) || (row.sku ?? "").toLowerCase().includes(query)
    );
  });

  const toReorder = rows.filter((row) => row.forecast.reorderQuantity > 0);
  const blindSpots = rows.filter((row) => row.forecast.method === "none");
  const belowLevel = rows.filter(
    (row) => row.forecast.currentStock < row.reorderLevel
  );

  const columns: Column<ReorderIngredient>[] = [
    {
      id: "name",
      header: "Ingredient",
      sortable: true,
      sortValue: (row) => row.name,
      cell: (row) => {
        const method = methodLabel(row);
        return (
          <div style={{ minWidth: 0 }}>
            <div className="row row-tight">
              <span style={{ fontWeight: 600 }}>{row.name}</span>
              <Badge tone={method.tone}>{method.label}</Badge>
            </div>
            <div className="hint">
              {row.sku ? `${row.sku} · ` : ""}
              {row.unit} ·{" "}
              {row.shelfLifeDays > 0
                ? `${formatNumber(row.shelfLifeDays, "en-GB")}-day shelf life`
                : "no shelf life on record"}
            </div>
          </div>
        );
      },
    },
    {
      id: "stock",
      header: "On hand",
      align: "right",
      sortable: true,
      sortValue: (row) => row.forecast.currentStock,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {quantity(row.forecast.currentStock)} <span className="hint">{row.unit}</span>
          </div>
          <div className="hint">
            {row.forecast.targetStock === null
              ? "no target stock"
              : `target ${quantity(row.forecast.targetStock)}`}
          </div>
        </div>
      ),
    },
    {
      id: "demand",
      header: "Demand",
      align: "right",
      sortable: true,
      sortValue: (row) => row.forecast.dailyDemand,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {quantity(Number(row.forecast.dailyDemand.toFixed(2)))}{" "}
            <span className="hint">{row.unit}/day</span>
          </div>
          <div className="hint">
            {row.forecast.method === "none"
              ? "no sales evidence"
              : `${quantity(row.consumption.soldUnits)} sold in ${forecast?.lookback.days ?? 14} days`}
          </div>
        </div>
      ),
    },
    {
      id: "reorder",
      header: "Reorder",
      align: "right",
      sortable: true,
      sortValue: (row) => row.forecast.reorderQuantity,
      cell: (row) => (
        <div>
          <Badge tone={reorderTone(row)}>{reorderLabel(row)}</Badge>
          <div className="hint">
            {row.forecast.reorderQuantity > 0
              ? formatCurrency(
                  row.forecast.reorderQuantity * row.costPerUnit,
                  currency
                )
              : row.forecast.reorderReason}
          </div>
        </div>
      ),
    },
    {
      id: "lead",
      header: "Lead time",
      align: "right",
      sortable: true,
      sortValue: (row) => row.forecast.leadTimeDays ?? 0,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {row.forecast.leadTimeDays === null
              ? "—"
              : `${formatNumber(row.forecast.leadTimeDays, "en-GB")} days`}
          </div>
          <div className="hint">
            {row.forecast.method === "none"
              ? "no delivery modelled"
              : `${quantity(row.forecast.predictedStockAtReorderDate)} ${row.unit} left at next delivery`}
          </div>
        </div>
      ),
    },
    {
      id: "risk",
      header: "Risk",
      cell: (row) => {
        if (row.forecast.wasteRisk && row.forecast.wasteRisk.likelyWasteQuantity > 0) {
          return (
            <div>
              <Badge tone="danger">Waste</Badge>
              <div className="hint">
                ~{quantity(row.forecast.wasteRisk.likelyWasteQuantity)} {row.unit} may expire
              </div>
            </div>
          );
        }
        if (row.forecast.method === "none") {
          return <span className="cell-muted">Refine recipe or pattern</span>;
        }
        return <span className="cell-muted">{row.forecast.reorderReason}</span>;
      },
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button variant="secondary" size="sm" onClick={() => setDetail(row)}>
          Breakdown
        </Button>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Catalog & stock"
        title="Reorder copilot"
        description="Demand from recipes and completed sales, projected against lead time and shelf life. Drafting writes a purchase order; nothing is sent to a supplier."
        actions={
          <>
            <Button
              size="sm"
              loading={draftMutation.isPending}
              disabled={toReorder.length === 0}
              onClick={() => draftMutation.mutate()}
            >
              <PackageSearch aria-hidden="true" />
              Draft purchase order
            </Button>
            <Link href="/ingredients" className="btn btn--secondary btn--sm">
              Ingredients
            </Link>
            <Link href="/purchasing" className="btn btn--secondary btn--sm">
              <ClipboardList aria-hidden="true" />
              Purchase orders
            </Link>
          </>
        }
      />

      {forecastQuery.isError ? (
        <InlineError
          title="The reorder forecast could not be loaded"
          error={forecastQuery.error}
          onRetry={() => forecastQuery.refetch()}
        />
      ) : (
        <>
          <div className="grid-3">
            <Stat
              label="Needs a reorder"
              value={formatNumber(toReorder.length)}
              foot={
                toReorder.length
                  ? toReorder
                      .slice(0, 2)
                      .map((row) => row.name)
                      .join(", ")
                  : "Everything is covered until the next delivery"
              }
              emphasis={toReorder.length > 0}
              compact
            />
            <Stat
              label="Estimated spend"
              value={formatCurrency(forecast?.purchaseMoneyBudget.amount ?? 0, currency)}
              foot={
                belowLevel.length
                  ? `${formatNumber(belowLevel.length)} at or below the reorder level`
                  : "At today's ingredient cost"
              }
              compact
            />
            <Stat
              label="Blind spots"
              value={formatNumber(blindSpots.length)}
              foot={
                blindSpots.length
                  ? "No recipe or sales demand to forecast from"
                  : "Every tracked ingredient has a demand signal"
              }
              emphasis={blindSpots.length > 0}
              compact
            />
          </div>

          {draft ? (
            <Alert tone="success" title="Draft purchase order created">
              {draft.purchaseOrder.number} · {formatNumber(draft.purchaseOrder.itemCount)}{" "}
              {draft.purchaseOrder.itemCount === 1 ? "line" : "lines"} ·{" "}
              {formatCurrency(draft.purchaseOrder.total, currency)}.{" "}
              <Link href="/purchasing">Review and approve it in Purchasing</Link>.
            </Alert>
          ) : null}
          {draftMutation.isError ? (
            <Alert tone="danger" title="Could not draft a purchase order">
              {draftMutation.error instanceof Error
                ? draftMutation.error.message
                : "Try again once the forecast has loaded."}
            </Alert>
          ) : null}

          <Card>
            <CardHeader
              title="Forecast"
              description={
                forecast
                  ? `${formatNumber(forecast.lookback.days)}-day lookback from ${formatShortDate(forecast.lookback.from)} · ${formatNumber(forecast.settings.defaultLeadDays)}-day default lead time${outlet ? ` · ${outlet.name}` : ""}`
                  : "Stock, demand and the quantity to buy next."
              }
            />
            <CardBody>
              <div className="row" style={{ gap: 18, marginBottom: 14, flexWrap: "wrap" }}>
                <label className="input-affix" style={{ maxWidth: 420, flex: "1 1 260px" }}>
                  <Search aria-hidden="true" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search ingredients by name or SKU"
                    aria-label="Search ingredients"
                  />
                  {search ? (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <X aria-hidden="true" />
                    </button>
                  ) : null}
                </label>
                <Checkbox
                  label="Only what needs a reorder"
                  checked={onlyReorder}
                  onChange={(event) => setOnlyReorder(event.target.checked)}
                />
              </div>

              <DataTable
                rows={filtered}
                columns={columns}
                rowId={(row) => row.id}
                loading={forecastQuery.isLoading}
                initialSort={{ id: "reorder", dir: "desc" }}
                empty={
                  <EmptyState
                    compact
                    icon={<PackageSearch aria-hidden="true" />}
                    title={
                      rows.length
                        ? onlyReorder || query
                          ? "No ingredients match"
                          : "Nothing needs reordering"
                        : "No tracked ingredients yet"
                    }
                    description={
                      rows.length
                        ? onlyReorder || query
                          ? "Clear the filters to see the whole forecast."
                          : "Every tracked ingredient is covered until its next delivery."
                        : "Add ingredients and attach them to recipes so sales can drive a forecast."
                    }
                  />
                }
              />
            </CardBody>
          </Card>
        </>
      )}

      <ReorderDetailDialog
        ingredient={detail}
        currency={currency}
        lookbackDays={forecast?.lookback.days ?? 14}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Per-ingredient breakdown                                                    */
/* -------------------------------------------------------------------------- */

function ReorderDetailDialog({
  ingredient,
  currency,
  lookbackDays,
  onClose,
}: {
  ingredient: ReorderIngredient | null;
  currency: string;
  lookbackDays: number;
  onClose: () => void;
}) {
  const method = ingredient ? methodLabel(ingredient) : null;

  return (
    <Dialog
      open={Boolean(ingredient)}
      onClose={onClose}
      title={ingredient ? `${ingredient.name} forecast` : "Forecast"}
      description="Demand is projected from recipe usage and completed sales, then compared with the stock on hand."
      width={560}
      footer={
        <>
          <span className="hint" style={{ margin: 0, flex: 1 }}>
            Drafting a purchase order from here is not available yet.
          </span>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {!ingredient ? null : (
        <div className="stack">
          <div className="row row-tight">
            {method ? <Badge tone={method.tone}>{method.label}</Badge> : null}
            <Badge tone={reorderTone(ingredient)}>{reorderLabel(ingredient)}</Badge>
            {ingredient.forecast.wasteRisk &&
            ingredient.forecast.wasteRisk.likelyWasteQuantity > 0 ? (
              <Badge tone="danger">
                <Flame aria-hidden="true" /> Waste risk
              </Badge>
            ) : null}
          </div>

          <div className="grid-2" style={{ gap: 14 }}>
            <DetailMetric
              label="On hand"
              value={`${quantity(ingredient.forecast.currentStock)} ${ingredient.unit}`}
              hint={`reorder at ${quantity(ingredient.reorderLevel)} ${ingredient.unit}`}
            />
            <DetailMetric
              label="Target stock"
              value={
                ingredient.forecast.targetStock === null
                  ? "—"
                  : `${quantity(ingredient.forecast.targetStock)} ${ingredient.unit}`
              }
              hint={`${formatNumber(lookbackDays)}-day lookback`}
            />
            <DetailMetric
              label="Daily demand"
              value={`${quantity(Number(ingredient.forecast.dailyDemand.toFixed(2)))} ${ingredient.unit}`}
              hint={`${quantity(ingredient.consumption.theoretical)} ${ingredient.unit} over the lookback`}
            />
            <DetailMetric
              label="Lead-time demand"
              value={`${quantity(ingredient.forecast.leadTimeDemand)} ${ingredient.unit}`}
              hint={
                ingredient.forecast.leadTimeDays === null
                  ? "no lead time modelled"
                  : `${formatNumber(ingredient.forecast.leadTimeDays)}-day lead time`
              }
            />
            <DetailMetric
              label="Reorder quantity"
              value={`${quantity(ingredient.forecast.reorderQuantity)} ${ingredient.unit}`}
              hint={formatCurrency(
                ingredient.forecast.reorderQuantity * ingredient.costPerUnit,
                currency
              )}
            />
            <DetailMetric
              label="Stock at next delivery"
              value={`${quantity(ingredient.forecast.predictedStockAtReorderDate)} ${ingredient.unit}`}
              hint={
                ingredient.forecast.daysOfStockRemaining === null
                  ? "no steady demand"
                  : `${quantity(Number(ingredient.forecast.daysOfStockRemaining.toFixed(1)))} days of stock left`
              }
            />
          </div>

          <div className="stack-sm">
            <div className="hint" style={{ margin: 0 }}>
              {ingredient.forecast.reorderReason}
            </div>
            {ingredient.consumption.soldUnits > 0 ? (
              <div className="hint">
                {quantity(ingredient.consumption.soldUnits)} product units sold in the
                lookback window; the recipes account for{" "}
                {quantity(ingredient.consumption.theoretical)} {ingredient.unit}.
              </div>
            ) : null}
            {ingredient.forecast.shelfLifeNote ? (
              <div className="hint">{ingredient.forecast.shelfLifeNote}</div>
            ) : null}
            {ingredient.forecast.blindSpot ? (
              <div className="hint">{ingredient.forecast.blindSpot}</div>
            ) : null}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function DetailMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="hint" style={{ margin: 0 }}>
        {label}
      </div>
      <div style={{ fontWeight: 600, fontSize: 15 }}>{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}
