"use client";

// Opt out of instant-navigation validation: these pages render data-dependent client UI.
export const instant = false;


import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Info,
  Printer,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Badge,
  Button,
  Delta,
  EmptyState,
  InfoTip,
  Segmented,
  Skeleton,
} from "@/components/ui/primitives";
import { CategoryBars, PaymentMixBar, SalesAreaChart } from "@/components/ui/charts";
import { DataTable, type Column } from "@/components/ui/table";
import { AccessDenied, InlineError, StatGridSkeleton } from "@/components/ui/states";
import { dashboardMetrics, paymentMethodLabel } from "@/lib/api/reports";
import type { DailySalesRow } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/formatting/currency";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/date-range";
import { useBusiness } from "@/lib/business/context";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";

export default function ReportsPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId, outlet } = useBusiness();
  const [range, setRange] = React.useState<RangeKey>("30d");
  const currency = session?.business.currency ?? "IDR";

  const query = useQuery({
    queryKey: ["reports", range, outletId],
    queryFn: () => dashboardMetrics({ range, outletId }),
    enabled: has("reports.view") && Boolean(outletId),
    staleTime: 60_000,
  });

  if (!has("reports.view")) {
    return <AccessDenied permission="reports.view" />;
  }

  const data = query.data;

  return (
    <>
      <PageHeader
        eyebrow={`${outlet?.name ?? "Workspace"} · performance`}
        title="Reports"
        description="Recorded sales, payment mix, and product performance for the selected outlet."
        actions={
          <>
            <Segmented label="Report period" options={RANGE_OPTIONS} value={range} onChange={setRange} />
            <Button
              variant="secondary"
              onClick={() => {
                if (typeof window !== "undefined") window.print();
              }}
              disabled={!data}
            >
              <Printer aria-hidden="true" />
              Print
            </Button>
          </>
        }
      />

      {query.isError ? (
        <InlineError title="Reports could not be loaded" error={query.error} onRetry={() => query.refetch()} />
      ) : null}

      {query.isLoading || !data ? (
        <>
          <StatGridSkeleton />
          <div className="grid-main">
            <Card>
              <CardHeader title="Sales trend" description="Loading recorded sales…" />
              <CardBody>
                <Skeleton style={{ height: 260 }} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Revenue composition" description="Loading totals…" />
              <CardBody>
                <Skeleton style={{ height: 190 }} />
              </CardBody>
            </Card>
          </div>
        </>
      ) : (
        <ReportContent
          data={data}
          currency={currency}
          canSell={has("sales.create")}
          onRefresh={() => query.refetch()}
          refreshing={query.isFetching}
        />
      )}
    </>
  );
}

function ReportContent({
  data,
  currency,
  canSell,
  onRefresh,
  refreshing,
}: {
  data: Awaited<ReturnType<typeof dashboardMetrics>>;
  currency: string;
  canSell: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [showAllDays, setShowAllDays] = React.useState(false);
  const { current, previous, changes, period, daily } = data;
  const hasSales = current.transactions > 0;
  const days = showAllDays ? daily : daily.slice(-14);
  const peak = [...data.trend].sort((a, b) => b.value - a.value).find((point) => point.value > 0);
  const comparisonAvailable = Boolean(previous && (previous.transactions > 0 || previous.netSales > 0));
  const sampled = !data.trendComplete || !data.refundsComplete;

  const dailyColumns: Column<DailySalesRow>[] = [
    {
      id: "date",
      header: "Day",
      cell: (row) => <span style={{ fontWeight: 550 }}>{row.label}</span>,
    },
    {
      id: "orders",
      header: "Receipts",
      align: "right",
      cell: (row) => <span className="cell-muted num">{formatNumber(row.orders)}</span>,
    },
    {
      id: "gross",
      header: "Gross",
      align: "right",
      cell: (row) => <span className="cell-muted num">{formatCurrency(row.grossSales, currency)}</span>,
    },
    {
      id: "discounts",
      header: "Discounts",
      align: "right",
      cell: (row) => (
        <span className="cell-muted num">
          {row.discounts ? `−${formatCurrency(row.discounts, currency)}` : "—"}
        </span>
      ),
    },
    {
      id: "tax",
      header: "Tax",
      align: "right",
      cell: (row) => <span className="cell-muted num">{formatCurrency(row.tax, currency)}</span>,
    },
    {
      id: "net",
      header: "Net sales",
      align: "right",
      cell: (row) => (
        <span className="num" style={{ fontWeight: 650 }}>
          {formatCurrency(row.netSales, currency)}
        </span>
      ),
    },
    {
      id: "items",
      header: "Items",
      align: "right",
      cell: (row) => <span className="cell-muted num">{formatNumber(row.itemsSold)}</span>,
    },
  ];

  return (
    <>
      {!hasSales ? (
        <div className="alert alert--info" role="status">
          <Info aria-hidden="true" />
          <div>
            <b>No sales in this period.</b>
            <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
              Report totals are zero because no completed receipts fall inside {period.label.toLowerCase()}. Try a
              wider period{canSell ? " or record the first sale" : ""}.
            </p>
            {canSell ? (
              <Link href="/sales" className="btn btn--secondary btn--sm" style={{ marginTop: 8 }}>
                Open register
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {sampled ? (
        <div className="alert alert--warning" role="status">
          <AlertTriangle aria-hidden="true" />
          <div>
            <b>Some breakdowns use a capped sample.</b>
            <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
              Headline totals and product totals are exact. Daily trend, payment mix, category mix
              {data.refundsComplete ? "" : ", and refunds"} are assembled from a capped set of receipts in this
              period, so they can undercount a very busy period.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid-4">
        <Stat
          label="Net sales"
          value={formatCurrency(current.netSales, currency)}
          info="Recorded receipts after discounts and excluding tax. Voided and refunded receipts are excluded."
          foot={
            <>
              <Delta value={changes.netSales} />
              <span>{period.comparisonLabel}</span>
            </>
          }
        />
        <Stat
          label="Receipts"
          value={formatNumber(current.transactions)}
          info="Completed receipts in the selected period."
          foot={
            <>
              <Delta value={changes.transactions} />
              <span>{comparisonAvailable ? period.comparisonLabel : "No prior period"}</span>
            </>
          }
        />
        <Stat
          label="Average sale"
          value={formatCurrency(current.avgTransaction, currency)}
          info="Net sales divided by completed receipts. Tax is excluded from both."
          foot={
            <>
              <Delta value={changes.avgTransaction} />
              <span>{comparisonAvailable ? period.comparisonLabel : "No prior period"}</span>
            </>
          }
        />
        <Stat
          label="Items sold"
          value={formatNumber(current.itemsSold)}
          info="Units across the sales-by-product report for this period and outlet."
          foot={
            <>
              <Delta value={changes.itemsSold} />
              <span>{comparisonAvailable ? period.comparisonLabel : "No prior period"}</span>
            </>
          }
        />
      </div>

      <div className="grid-main">
        <Card>
          <CardHeader
            title="Sales trend"
            description={`Net sales by day · ${period.label}`}
            actions={
              <div className="chart-legend">
                <span>
                  <i style={{ background: "hsl(var(--chart-1))" }} aria-hidden="true" />
                  Net sales
                </span>
                {data.previousTrend.length ? (
                  <span>
                    <i
                      style={{
                        background: "transparent",
                        borderTop: "2px dashed hsl(var(--ink-3))",
                        height: 1,
                      }}
                      aria-hidden="true"
                    />
                    Previous
                  </span>
                ) : null}
              </div>
            }
          />
          <CardBody>
            {hasSales ? (
              <SalesAreaChart
                data={data.trend}
                compare={data.previousTrend}
                currency={currency}
                height={270}
                ariaLabel={`Net sales by day for ${period.label}. Total ${formatCurrency(current.netSales, currency)}.`}
              />
            ) : (
              <EmptyState
                compact
                icon={<BarChart3 aria-hidden="true" />}
                title="No daily trend to chart"
                description="Complete a sale inside this period to start the trend."
              />
            )}
          </CardBody>
          <CardFooter className="row between wrap">
            {peak ? (
              <span className="hint" style={{ margin: 0 }}>
                <TrendingUp
                  aria-hidden="true"
                  style={{ width: 13, height: 13, display: "inline", marginRight: 5, verticalAlign: -2 }}
                />
                Peak day <b>{peak.fullLabel}</b> · {formatCurrency(peak.value, currency)}
              </span>
            ) : (
              <span className="hint" style={{ margin: 0 }}>
                No peak day to report
              </span>
            )}
            <span className="hint" style={{ margin: 0 }}>
              {data.trendComplete ? "All daily receipts included" : "Sampled daily data"}
            </span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader
            title="Revenue composition"
            description="How recorded sales break down."
            actions={
              <InfoTip label="About revenue composition">
                Net sales are receipts after discounts and excluding tax. Tax is collected for the tax authority and
                is not store revenue. Gross sales are shown before discounts; where prices include tax, that embedded
                tax is part of the recorded item price.
              </InfoTip>
            }
          />
          <CardBody>
            <dl className="ledger">
              <div className="ledger__row">
                <dt>Gross sales</dt>
                <dd className="num">{formatCurrency(current.grossSales, currency)}</dd>
              </div>
              <div className="ledger__row">
                <dt>Discounts</dt>
                <dd className="num">{current.discounts ? `−${formatCurrency(current.discounts, currency)}` : "—"}</dd>
              </div>
              <div className="ledger__row">
                <dt>Tax collected</dt>
                <dd className="num">{formatCurrency(current.tax, currency)}</dd>
              </div>
              <div className="ledger__row ledger__row--total">
                <dt>Net sales</dt>
                <dd className="num">{formatCurrency(current.netSales, currency)}</dd>
              </div>
              <div className="ledger__row">
                <dt>Collected from customers</dt>
                <dd className="num">{formatCurrency(current.netSales + current.tax, currency)}</dd>
              </div>
              <div className="ledger__row">
                <dt>Refunded</dt>
                <dd className="num">
                  {data.refundsComplete ? formatCurrency(current.refunds, currency) : "Partial sample"}
                </dd>
              </div>
            </dl>
          </CardBody>
          <CardFooter>
            <span className="hint" style={{ margin: 0 }}>
              {data.refundsComplete
                ? "Refunds are shown as a separate outflow and are not netted into sales."
                : "The refund sample was capped; the amount is a lower bound."}
            </span>
          </CardFooter>
        </Card>
      </div>

      <div className="grid-2">
        <Card>
          <CardHeader
            title="Payment mix"
            description="Settlement methods across completed sales."
            actions={!data.trendComplete ? <Badge tone="warning">Sampled</Badge> : null}
          />
          <CardBody>
            {data.salesByPayment.length ? (
              <PaymentMixBar
                data={data.salesByPayment.map((row) => ({ ...row, method: paymentMethodLabel(row.method) }))}
                currency={currency}
              />
            ) : (
              <EmptyState
                compact
                icon={<Receipt aria-hidden="true" />}
                title="No payments to group"
                description="Payment methods appear after completed receipts."
              />
            )}
          </CardBody>
          <CardFooter>
            <span className="hint" style={{ margin: 0 }}>
              Amounts include tax and are based on the payment records attached to each sale.
            </span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader
            title="Sales by category"
            description="Revenue from recorded line items."
            actions={!data.trendComplete ? <Badge tone="warning">Sampled</Badge> : null}
          />
          <CardBody>
            {data.salesByCategory.length ? (
              <CategoryBars data={data.salesByCategory.slice(0, 8)} currency={currency} />
            ) : (
              <EmptyState
                compact
                icon={<BarChart3 aria-hidden="true" />}
                title="No category data"
                description="Assign product categories to see how sales split between them."
              />
            )}
          </CardBody>
          <CardFooter>
            <span className="hint" style={{ margin: 0 }}>
              Categories come from the current product catalog.
            </span>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Daily breakdown"
          description={`${daily.length} ${daily.length === 1 ? "day" : "days"} in ${period.label.toLowerCase()}`}
          actions={
            daily.length > 14 ? (
              <Button variant="quiet" size="sm" onClick={() => setShowAllDays((current) => !current)}>
                {showAllDays ? "Show last 14 days" : `Show all ${daily.length} days`}
              </Button>
            ) : null
          }
        />
        <div
          className="task-meta"
          style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "10px 16px", borderBottom: "1px solid hsl(var(--border))" }}
        >
          <span className="hint" style={{ margin: 0 }}>
            Showing {days.length} of {daily.length} days
          </span>
          <span className="hint" style={{ margin: 0 }}>
            Net total{" "}
            <b className="num" style={{ color: "hsl(var(--ink))" }}>
              {formatCurrency(daily.reduce((sum, row) => sum + row.netSales, 0), currency)}
            </b>
          </span>
          {!data.trendComplete ? <Badge tone="warning">Sampled daily rows</Badge> : null}
        </div>
        <DataTable
          rows={days}
          columns={dailyColumns}
          rowId={(row) => row.date}
          loading={refreshing}
          minWidth={720}
          empty={
            <EmptyState
              compact
              icon={<BarChart3 aria-hidden="true" />}
              title="No daily rows"
              description="A day appears here as soon as it contains a completed sale."
            />
          }
          mobile={(row) => (
            <div className="record">
              <div className="record__top">
                <div>
                  <div className="record__title">{row.label}</div>
                  <div className="record__meta">
                    {formatNumber(row.orders)} receipts · {formatNumber(row.itemsSold)} items
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <b className="num">{formatCurrency(row.netSales, currency)}</b>
                  <div className="hint">net sales</div>
                </div>
              </div>
            </div>
          )}
          footer={
            <div className="table-pagination" style={{ justifyContent: "flex-end" }}>
              <span className="hint" style={{ margin: 0 }}>
                Net{" "}
                <b className="num" style={{ color: "hsl(var(--ink))" }}>
                  {formatCurrency(daily.reduce((sum, row) => sum + row.netSales, 0), currency)}
                </b>{" "}
                · Tax {formatCurrency(daily.reduce((sum, row) => sum + row.tax, 0), currency)}
              </span>
            </div>
          }
        />
        <CardFooter className="row between wrap">
          <span className="hint" style={{ margin: 0 }}>
            {!data.trendComplete ? "Daily rows cover a capped sample of receipts." : "Daily rows include every completed receipt."}
          </span>
          <Button variant="quiet" size="sm" onClick={onRefresh} loading={refreshing}>
            Refresh
          </Button>
        </CardFooter>
      </Card>

      <div className="grid-main">
        <Card>
          <CardHeader title="Top products" description="Ranked by line-item revenue this period." />
          <CardBody flush>
            {data.topProducts.length ? (
              <div className="rank-list" style={{ padding: "8px 16px 12px" }}>
                {data.topProducts.map((product, index) => (
                  <div className="rank-row" key={product.productId || product.name}>
                    <span className="rank-row__n">{String(index + 1).padStart(2, "0")}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="rank-row__name">{product.name}</div>
                      <div className="rank-row__sub">{formatNumber(product.quantity)} sold</div>
                    </div>
                    <span className="rank-row__value">{formatCurrency(product.revenue, currency)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                icon={<ShoppingCart aria-hidden="true" />}
                title="No product revenue"
                description="Product rankings appear after completed receipts."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Data basis" description="What is exact and what is a sample." />
          <CardBody>
            <div className="stack-sm" style={{ gap: 12 }}>
              <div className="row" style={{ gap: 9, alignItems: "flex-start" }}>
                <Badge tone="success">Exact</Badge>
                <span className="hint" style={{ margin: 0 }}>
                  Net sales, gross sales, discounts, tax, receipts, and the sales-by-product report come from
                  period summary endpoints.
                </span>
              </div>
              <div className="row" style={{ gap: 9, alignItems: "flex-start" }}>
                <Badge tone={sampled ? "warning" : "success"}>{sampled ? "Sampled" : "Exact"}</Badge>
                <span className="hint" style={{ margin: 0 }}>
                  Daily trend, payment mix, category split, and refunds are assembled from receipt pages. The
                  interface says when those pages are capped.
                </span>
              </div>
              <p className="hint" style={{ margin: 0 }}>
                No targets, forecasts, or comparative industry data are shown. Previous-period comparisons use the
                previous summary period only.
              </p>
              <Link href="/transactions" className="btn btn--secondary btn--sm">
                Browse receipts
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
