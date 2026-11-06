"use client";

export const instant = false;

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { PageHeader, Stat, StatDelta } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Field, Input } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { AccessDenied, InlineError } from "@/components/ui/states";
import {
  getComparisonReport,
  getFinancialAnalytics,
  getOperationalAnalytics,
  getProductAnalytics,
  type ProductAnalyticsRow,
} from "@/lib/api/analytics";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatting/currency";

const TABS = [
  { id: "products", label: "Products" },
  { id: "operations", label: "Operations" },
  { id: "finance", label: "Finance" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AnalyticsPage() {
  const { has } = usePermissions();
  const [from, setFrom] = React.useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return date.toISOString().slice(0, 10);
  });
  const [to, setTo] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [tab, setTab] = React.useState<TabId>("products");
  const range = { from, to };

  const comparison = useQuery({
    queryKey: ["analytics", "comparison", from, to],
    queryFn: () => getComparisonReport(range),
    enabled: has("analytics.view"),
    staleTime: 60_000,
  });
  const products = useQuery({
    queryKey: ["analytics", "products", from, to],
    queryFn: () => getProductAnalytics(range),
    enabled: has("analytics.view"),
  });
  const operations = useQuery({
    queryKey: ["analytics", "operations", from, to],
    queryFn: () => getOperationalAnalytics(range),
    enabled: has("analytics.view") && tab === "operations",
  });
  const finance = useQuery({
    queryKey: ["analytics", "finance", from, to],
    queryFn: () => getFinancialAnalytics(range),
    enabled: has("analytics.view") && tab === "finance",
  });

  if (!has("analytics.view")) {
    return <AccessDenied permission="analytics.view" />;
  }

  const revenue = comparison.data?.metrics.revenue;
  const orders = comparison.data?.metrics.orders;
  const aov = comparison.data?.metrics.average_order_value;
  const profit = comparison.data?.metrics.gross_profit;

  const columns: Column<ProductAnalyticsRow>[] = [
    {
      id: "name",
      header: "Product",
      sortable: true,
      sortValue: (row) => row.name,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div className="hint">{row.sku || "No SKU"}</div>
        </div>
      ),
    },
    { id: "qty", header: "Qty", align: "right", sortable: true, sortValue: (row) => row.quantity, cell: (row) => formatNumber(row.quantity) },
    { id: "revenue", header: "Revenue", align: "right", sortable: true, sortValue: (row) => row.revenue, cell: (row) => formatCurrency(row.revenue) },
    { id: "margin", header: "Margin", align: "right", sortable: true, sortValue: (row) => row.margin, cell: (row) => formatCurrency(row.margin) },
    { id: "share", header: "Share", align: "right", cell: (row) => formatPercent(row.revenueSharePercent, 1) },
    {
      id: "abc",
      header: "ABC",
      align: "center",
      cell: (row) => <Badge tone={row.abcClass === "A" ? "success" : row.abcClass === "B" ? "warning" : "neutral"}>{row.abcClass}</Badge>,
    },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Analyze"
        title="Analytics"
        description="Revenue, product performance and the operational picture for the selected period."
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Field label="From" htmlFor="analytics-from">
              <Input id="analytics-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="To" htmlFor="analytics-to">
              <Input id="analytics-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
          </div>
        }
      />

      {comparison.isError ? <InlineError title="Could not load the comparison" error={comparison.error} onRetry={() => comparison.refetch()} /> : null}

      <div className="stat-grid">
        <Stat
          label="Revenue"
          value={formatCurrency(revenue?.current ?? 0)}
          foot={<StatDelta value={revenue?.changePercent ?? null} label="vs previous period" />}
        />
        <Stat
          label="Orders"
          value={formatNumber(orders?.current ?? 0)}
          foot={<StatDelta value={orders?.changePercent ?? null} label="vs previous period" />}
        />
        <Stat
          label="Average order"
          value={formatCurrency(aov?.current ?? 0)}
          foot={<StatDelta value={aov?.changePercent ?? null} label="vs previous period" />}
        />
        <Stat
          label="Gross profit"
          value={formatCurrency(profit?.current ?? 0)}
          foot={<StatDelta value={profit?.changePercent ?? null} label="vs previous period" />}
        />
      </div>

      <div className="tabs" role="tablist" aria-label="Analytics views">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className="tab"
            data-active={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "products" ? (
        <Card>
          <CardHeader title="Product performance" description="Margin, revenue share and ABC class for the period." />
          <CardBody>
            {products.isError ? (
              <InlineError title="Could not load product analytics" error={products.error} onRetry={() => products.refetch()} />
            ) : (
              <DataTable
                rows={products.data?.products ?? []}
                columns={columns}
                rowId={(row) => row.productId}
                loading={products.isPending}
                empty={<p className="hint">No product sales in this period.</p>}
                mobile={(row) => (
                  <div className="record">
                    <div className="record__head">
                      <strong>{row.name}</strong>
                      <span>{formatCurrency(row.revenue)}</span>
                    </div>
                    <div className="record__meta">
                      <span>{formatNumber(row.quantity)} sold</span>
                      <span>Margin {formatPercent(row.marginPercent, 1)}</span>
                    </div>
                  </div>
                )}
              />
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === "operations" ? (
        <div className="grid-2">
          <Card>
            <CardHeader title="Order flow" />
            <CardBody>
              {operations.isError ? (
                <InlineError title="Could not load operations" error={operations.error} onRetry={() => operations.refetch()} />
              ) : (
                <div className="stack-sm">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span>Open orders</span>
                    <strong>{formatNumber(operations.data?.orders.open ?? 0)}</strong>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span>Average prep time</span>
                    <strong>{Math.round(operations.data?.orders.averagePrepMinutes ?? 0)} min</strong>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span>Average order value</span>
                    <strong>{formatCurrency(operations.data?.orders.averageOrderValue ?? 0)}</strong>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span>Low stock items</span>
                    <strong>{formatNumber(operations.data?.lowStockCount ?? 0)}</strong>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Orders by hour" />
            <CardBody>
              <div className="stack-sm">
                {(operations.data?.orders.byHour ?? []).map((row) => (
                  <div key={row.hour} className="row" style={{ gap: 10 }}>
                    <span className="hint num" style={{ width: 48 }}>{String(row.hour).padStart(2, "0")}:00</span>
                    <div style={{ flex: 1, background: "hsl(var(--muted))", borderRadius: 4, height: 8 }}>
                      <div
                        style={{
                          width: `${Math.min(100, row.orders * 12)}%`,
                          height: "100%",
                          borderRadius: 4,
                          background: "hsl(var(--primary))",
                        }}
                      />
                    </div>
                    <span className="num">{row.orders}</span>
                  </div>
                ))}
                {!operations.data?.orders.byHour.length ? <p className="hint">No orders recorded yet.</p> : null}
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "finance" ? (
        <Card>
          <CardHeader title="Financial summary" description="Revenue through profit for the selected period." />
          <CardBody>
            {finance.isError ? (
              <InlineError title="Could not load financial analytics" error={finance.error} onRetry={() => finance.refetch()} />
            ) : (
              <div className="stat-grid">
                <Stat label="Revenue" value={formatCurrency(finance.data?.revenue ?? 0)} />
                <Stat label="COGS" value={formatCurrency(finance.data?.cogs ?? 0)} />
                <Stat label="Gross profit" value={formatCurrency(finance.data?.grossProfit ?? 0)} foot={`${formatPercent(finance.data?.grossMarginPercent ?? 0, 1)} margin`} />
                <Stat label="Expenses" value={formatCurrency(finance.data?.expenses ?? 0)} />
                <Stat label="Net profit" value={formatCurrency(finance.data?.netProfit ?? 0)} emphasis />
                <Stat label="Cash collected" value={formatCurrency(finance.data?.cashCollected ?? 0)} />
                <Stat label="Receivable" value={formatCurrency(finance.data?.receivableOutstanding ?? 0)} />
                <Stat label="Payable" value={formatCurrency(finance.data?.payableOutstanding ?? 0)} />
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      <p className="hint row" style={{ gap: 6 }}>
        <TrendingUp aria-hidden="true" size={14} /> Comparisons use the previous period of equal length.
      </p>
    </div>
  );
}
