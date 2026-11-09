"use client";

// Opt out of instant-navigation validation: this page renders data-dependent client UI.
export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChefHat, FlaskConical, Search, X } from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Button, EmptyState, Input } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { getIngredientDashboard } from "@/lib/api/ingredients";
import type { IngredientUsage, IngredientUsageProduct } from "@/lib/api/types";
import { usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";
import { formatNumber } from "@/lib/formatting/currency";

/** Ingredient quantities are fractional, so keep the decimal separator a point. */
function quantity(value: number) {
  return formatNumber(value, "en-GB");
}

function producibleLabel(product: IngredientUsageProduct) {
  if (product.producible === null) return "unlimited";
  if (product.producible <= 0) return "0 left";
  return `${formatNumber(product.producible, "en-GB")} left`;
}

function usageSummary(products: IngredientUsageProduct[]) {
  if (!products.length) return "Not used in any recipe";
  const shown = products.slice(0, 2).map((product) => ({
    name: product.productName ?? "Product",
    label: producibleLabel(product),
  }));
  const rest = products.length - shown.length;
  return (
    <>
      {shown.map((entry, index) => (
        <span key={`${entry.name}-${index}`}>
          {index > 0 ? " · " : ""}
          {entry.name} <span className="hint">{entry.label}</span>
        </span>
      ))}
      {rest > 0 ? <span className="hint"> · +{rest} more</span> : null}
    </>
  );
}

export default function IngredientsPage() {
  const { has } = usePermissions();
  const { outletId, outlet } = useBusiness();

  const [search, setSearch] = React.useState("");
  const [detail, setDetail] = React.useState<IngredientUsage | null>(null);

  const canView = has("ingredients.view");

  const usageQuery = useQuery({
    queryKey: ["ingredient-usage", outletId],
    queryFn: () => getIngredientDashboard(outletId ?? undefined),
    enabled: canView && Boolean(outletId),
    staleTime: 30_000,
  });

  if (!canView) {
    return <AccessDenied permission="ingredients.view" />;
  }

  const rows = usageQuery.data ?? [];
  const query = search.trim().toLowerCase();
  const filtered = rows.filter(
    (row) =>
      !query ||
      row.name.toLowerCase().includes(query) ||
      (row.sku ?? "").toLowerCase().includes(query)
  );

  const lowStock = rows.filter((row) => row.trackInventory && row.lowStock);
  const tracked = rows.filter((row) => row.trackInventory);
  const blockedProducts = new Set<string>();
  rows.forEach((row) => {
    row.products.forEach((product) => {
      if (product.producible !== null && product.producible <= 0) {
        blockedProducts.add(
          `${product.productId}:${product.productVariantId ?? "base"}`
        );
      }
    });
  });

  const columns: Column<IngredientUsage>[] = [
    {
      id: "name",
      header: "Ingredient",
      sortable: true,
      sortValue: (row) => row.name,
      cell: (row) => (
        <div style={{ minWidth: 0 }}>
          <div className="row row-tight">
            <span style={{ fontWeight: 600 }}>{row.name}</span>
            {!row.trackInventory ? <Badge tone="neutral">Untracked</Badge> : null}
            {row.trackInventory && row.critical ? <Badge tone="danger">Critical</Badge> : null}
            {row.trackInventory && !row.critical && row.lowStock ? (
              <Badge tone="warning">Low</Badge>
            ) : null}
          </div>
          <div className="hint">
            {row.sku ? `${row.sku} · ` : ""}
            reorder at {quantity(row.reorderLevel)} {row.unit}
            {row.safetyStock > 0 ? ` · safety at ${quantity(row.safetyStock)} ${row.unit}` : ""}
          </div>
        </div>
      ),
    },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      sortable: true,
      sortValue: (row) => row.remaining,
      cell: (row) =>
        row.trackInventory ? (
          <div>
            <div style={{ fontWeight: 600 }}>
              {quantity(row.remaining)} <span className="hint">{row.unit}</span>
            </div>
            <div className="hint">
              received {quantity(row.received)} · used {quantity(row.consumed)}
            </div>
          </div>
        ) : (
          <span className="cell-muted">Not tracked</span>
        ),
    },
    {
      id: "products",
      header: "Used by",
      cell: (row) => (
        <span className="cell-muted" style={{ fontSize: 12.5 }}>
          {usageSummary(row.products)}
        </span>
      ),
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
        title="Ingredients"
        description="One stock balance per ingredient. See what is left, what sales consumed, and which menu items each ingredient limits."
        actions={
          <Link href="/recipes" className="btn btn--secondary btn--sm">
            <ChefHat aria-hidden="true" />
            Recipes
          </Link>
        }
      />

      {!outletId ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<FlaskConical aria-hidden="true" />}
              title="Pick an outlet"
              description="Ingredient balances are counted per outlet. Choose one in the outlet switcher to see its stock."
            />
          </CardBody>
        </Card>
      ) : usageQuery.isError ? (
        <InlineError
          title="Ingredients could not be loaded"
          error={usageQuery.error}
          onRetry={() => usageQuery.refetch()}
        />
      ) : (
        <>
          <div className="grid-3">
            <Stat
              label="Tracked ingredients"
              value={formatNumber(tracked.length)}
              foot={outlet ? `${outlet.name} stock` : "Active outlet"}
              compact
            />
            <Stat
              label="At or below reorder level"
              value={formatNumber(lowStock.length)}
              foot={
                lowStock.length
                  ? lowStock
                      .slice(0, 2)
                      .map((row) => row.name)
                      .join(", ")
                  : "Everything is above its reorder level"
              }
              emphasis={lowStock.length > 0}
              compact
            />
            <Stat
              label="Menu items at zero"
              value={formatNumber(blockedProducts.size)}
              foot={
                blockedProducts.size
                  ? "Cannot be sold until restocked"
                  : "Every recipe can still be made"
              }
              emphasis={blockedProducts.size > 0}
              compact
            />
          </div>

          <Card>
            <CardHeader
              title="Stock and usage"
              description="Remaining stock, what has been consumed, and the products each ingredient feeds."
            />
            <CardBody>
              <label className="input-affix" style={{ maxWidth: 420, marginBottom: 14 }}>
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

              <DataTable
                rows={filtered}
                columns={columns}
                rowId={(row) => row.ingredientId}
                loading={usageQuery.isLoading}
                initialSort={{ id: "remaining", dir: "asc" }}
                empty={
                  <EmptyState
                    compact
                    icon={<FlaskConical aria-hidden="true" />}
                    title={rows.length ? "No ingredients match" : "No ingredients yet"}
                    description={
                      rows.length
                        ? "Try a different name or SKU."
                        : "Add ingredients from the Recipes tab, then attach them to products."
                    }
                  />
                }
              />
            </CardBody>
          </Card>
        </>
      )}

      <IngredientUsageDialog ingredient={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Per-product breakdown                                                       */
/* -------------------------------------------------------------------------- */

function IngredientUsageDialog({
  ingredient,
  onClose,
}: {
  ingredient: IngredientUsage | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(ingredient)}
      onClose={onClose}
      title={ingredient ? `${ingredient.name} usage` : "Usage"}
      description="How much one unit of each product takes, and how many are still producible."
      width={540}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {!ingredient ? null : (
        <div className="stack">
          <div className="row between" style={{ gap: 10 }}>
            <span className="hint" style={{ margin: 0 }}>
              {ingredient.trackInventory
                ? `${quantity(ingredient.remaining)} ${ingredient.unit} remaining`
                : "Stock is not tracked for this ingredient"}
            </span>
            <span className="hint" style={{ margin: 0 }}>
              received {quantity(ingredient.received)} · used {quantity(ingredient.consumed)}
            </span>
          </div>

          {ingredient.products.length === 0 ? (
            <EmptyState
              compact
              icon={<ChefHat aria-hidden="true" />}
              title="Not used in any recipe"
              description="Attach this ingredient to a product recipe to consume it on sales."
            />
          ) : (
            <div className="stack-sm">
              {ingredient.products.map((product) => (
                <div
                  className="row between"
                  key={`${product.productId}:${product.productVariantId ?? "base"}`}
                  style={{ gap: 10, alignItems: "flex-start" }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {product.productName ?? "Product"}
                      {product.productVariantId ? <span className="hint"> · variant</span> : null}
                    </div>
                    <div className="hint">
                      {quantity(product.quantity)} {product.unit} per unit ·{" "}
                      {quantity(product.quantityInIngredientUnit)} {ingredient.unit} from stock
                    </div>
                  </div>
                  <Badge
                    tone={
                      product.producible === null
                        ? "neutral"
                        : product.producible <= 0
                          ? "danger"
                          : product.producible <= 5
                            ? "warning"
                            : "success"
                    }
                  >
                    {producibleLabel(product)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
