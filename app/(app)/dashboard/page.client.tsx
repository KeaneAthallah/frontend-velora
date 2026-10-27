"use client";

// Opt out of instant-navigation validation: these pages render data-dependent client UI.
export const instant = false;


import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  PackageOpen,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge, Button, Delta, EmptyState, InfoTip, Segmented, Skeleton } from "@/components/ui/primitives";
import { SalesAreaChart, PaymentMixBar, CategoryBars } from "@/components/ui/charts";
import { AccessDenied, InlineError, StatGridSkeleton } from "@/components/ui/states";
import { dashboardMetrics, paymentMethodLabel } from "@/lib/api/reports";
import { formatCurrency, formatNumber, formatRelative } from "@/lib/formatting/currency";
import { itemCount, transactionLabel, transactionTone } from "@/lib/formatting/transaction";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/date-range";
import { useBusiness } from "@/lib/business/context";
import { usePermissions } from "@/lib/auth/auth-context";
import { useAuth } from "@/lib/auth/auth-context";

export default function OverviewPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId, outlet } = useBusiness();
  const [range, setRange] = React.useState<RangeKey>("7d");
  const currency = session?.business.currency ?? "IDR";

  const query = useQuery({
    queryKey: ["dashboard", range, outletId],
    queryFn: () => dashboardMetrics({ range, outletId }),
    enabled: has("reports.view") && Boolean(outletId),
    staleTime: 30_000,
  });

  if (!has("reports.view")) {
    return <AccessDenied permission="reports.view" />;
  }

  return (
    <>
      <PageHeader
        eyebrow={`${outlet?.name ?? session?.business.name ?? "Workspace"} · ${query.data?.period.label ?? "Today"}`}
        title="Overview"
        description="A live read of the store, built only from recorded sales, stock, and products."
        actions={
          <>
            <Segmented
              label="Reporting period"
              options={RANGE_OPTIONS}
              value={range}
              onChange={setRange}
            />
            {has("sales.create") ? (
              <Link href="/sales" className="btn btn--primary">
                <ShoppingCart aria-hidden="true" />
                New sale
              </Link>
            ) : null}
          </>
        }
      />

      {query.isError ? (
        <InlineError
          title="The overview could not be loaded"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      ) : null}

      {query.isLoading || !query.data ? (
        <OverviewSkeleton />
      ) : (
        <OverviewContent
          data={query.data}
          currency={currency}
          canSell={has("sales.create")}
          canSeeInventory={has("inventory.view")}
          canSeeReports={has("reports.view")}
          onRangeChange={setRange}
        />
      )}
    </>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <StatGridSkeleton />
      <div className="grid-main">
        <Card>
          <CardHeader title="Sales rhythm" description="Loading recorded sales…" />
          <CardBody>
            <Skeleton style={{ height: 248 }} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Payment mix" description="Loading payment records…" />
          <CardBody>
            <Skeleton style={{ height: 150 }} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function OverviewContent({
  data,
  currency,
  canSell,
  canSeeInventory,
  canSeeReports,
  onRangeChange,
}: {
  data: Awaited<ReturnType<typeof dashboardMetrics>>;
  currency: string;
  canSell: boolean;
  canSeeInventory: boolean;
  canSeeReports: boolean;
  onRangeChange: (range: RangeKey) => void;
}) {
  const { current, previous, changes, trend, previousTrend, period } = data;
  const hasSales = current.transactions > 0;
  const peak = React.useMemo(
    () => [...trend].sort((a, b) => b.value - a.value).find((point) => point.value > 0),
    [trend]
  );
  const comparisonAvailable = Boolean(previous && (previous.transactions > 0 || previous.netSales > 0));
  const timeLabel = period.key === "today" ? "today" : period.label.toLowerCase();

  return (
    <>
      <div className="grid-4">
        <Stat
          label="Net sales"
          value={formatCurrency(current.netSales, currency)}
          info="Recorded sales after discounts and excluding tax. Voided and refunded receipts are excluded."
          foot={
            <>
              <Delta value={changes.netSales} />
              <span>{period.comparisonLabel}</span>
            </>
          }
        />
        <Stat
          label="Transactions"
          value={formatNumber(current.transactions)}
          info="Completed receipts in the selected period. Voided and refunded receipts are excluded."
          foot={
            <>
              <Delta value={changes.transactions} />
              <span>{comparisonAvailable ? period.comparisonLabel : "No earlier period to compare"}</span>
            </>
          }
        />
        <Stat
          label="Average sale"
          value={formatCurrency(current.avgTransaction, currency)}
          info="Net sales divided by completed transactions in this period."
          foot={
            <>
              <Delta value={changes.avgTransaction} />
              <span>{comparisonAvailable ? period.comparisonLabel : "First recorded period"}</span>
            </>
          }
        />
        <Stat
          label="Items sold"
          value={formatNumber(current.itemsSold)}
          info="Units sold across completed receipts. Product totals come from the sales-by-product report."
          foot={
            <>
              <Delta value={changes.itemsSold} />
              <span>{comparisonAvailable ? period.comparisonLabel : "First recorded period"}</span>
            </>
          }
        />
      </div>

      {!hasSales ? (
        <Card>
          <CardBody>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
                justifyContent: "space-between",
              }}
            >
              <div className="row" style={{ gap: 12, alignItems: "flex-start", minWidth: 260 }}>
                <span className="empty__icon" style={{ width: 38, height: 38, flexShrink: 0 }}>
                  <PackageOpen aria-hidden="true" />
                </span>
                <div>
                  <h2 style={{ fontSize: 14, marginBottom: 2 }}>No sales recorded {timeLabel}</h2>
                  <p className="hint" style={{ margin: 0, maxWidth: 560 }}>
                    Totals will fill in as receipts are completed. You can widen the period or start the
                    first sale from the register.
                  </p>
                </div>
              </div>
              <div className="row row-tight">
                {period.key !== "30d" ? (
                  <Button variant="secondary" onClick={() => onRangeChange("30d")}>
                    Widen to 30 days
                  </Button>
                ) : null}
                {canSell ? (
                  <Link href="/sales" className="btn btn--primary">
                    <ShoppingCart aria-hidden="true" />
                    Open register
                  </Link>
                ) : null}
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid-main">
        <Card>
          <CardHeader
            title="Sales rhythm"
            description={`Net sales by day · ${period.label}`}
            actions={
              <div className="chart-legend">
                <span>
                  <i style={{ background: "hsl(var(--chart-1))" }} aria-hidden="true" />
                  Net sales
                </span>
                {previousTrend.length ? (
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
                data={trend}
                compare={previousTrend}
                currency={currency}
                ariaLabel={`Net sales by day for ${period.label}. ${formatCurrency(current.netSales, currency)} total.`}
              />
            ) : (
              <EmptyState
                compact
                icon={<BarChart3 aria-hidden="true" />}
                title="Nothing to chart yet"
                description="A daily line appears once the first sale is completed in this period."
              />
            )}
          </CardBody>
          <CardFooter className="row between wrap" style={{ gap: 10 }}>
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
              {!data.trendComplete
                ? "Trend uses a recent sample of receipts; card totals are exact."
                : `${formatNumber(current.transactions)} receipts in the period`}
            </span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader
            title="Payment mix"
            description="How customers settled completed sales."
            actions={
              <InfoTip label="About the payment mix">
                Payments are grouped by the method recorded at checkout. There can be more than one
                payment per sale.
              </InfoTip>
            }
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
                description="Payment methods show up here after completed sales."
              />
            )}
          </CardBody>
          <CardFooter className="row between">
            <span className="hint" style={{ margin: 0 }}>
              {data.trendComplete
                ? current.transactions
                  ? `${formatNumber(current.transactions)} completed`
                  : "Awaiting first payment"
                : "Based on a capped receipt sample"}
            </span>
            {!data.trendComplete ? (
              <Badge tone="warning">Sampled</Badge>
            ) : (
              <span className="hint" style={{ margin: 0 }}>
                Amounts include tax
              </span>
            )}
          </CardFooter>
        </Card>
      </div>

      <div className="grid-main">
        <Card>
          <CardHeader
            title="Recent sales"
            description="The latest completed receipts in this period."
            actions={
              <Link href="/transactions" className="btn btn--quiet btn--sm">
                All transactions
                <ArrowRight aria-hidden="true" />
              </Link>
            }
          />
          <CardBody flush>
            {data.recentTransactions.length ? (
              <div className="record-list">
                {data.recentTransactions.map((transaction) => (
                  <Link
                    key={transaction.id}
                    href={`/transactions?q=${encodeURIComponent(transaction.receiptNumber)}`}
                    className="record"
                    style={{ color: "inherit" }}
                  >
                    <div className="record__top">
                      <div style={{ minWidth: 0 }}>
                        <div className="record__title">
                          <span className="mono" style={{ fontSize: 12 }}>
                            {transaction.receiptNumber}
                          </span>
                        </div>
                        <div className="record__meta">
                          {transaction.customerName || "Walk-in guest"} · {transaction.cashierName || "Cashier"} ·{" "}
                          {formatRelative(transaction.createdAt)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <b className="num" style={{ display: "block", fontSize: 13 }}>
                          {formatCurrency(transaction.total, currency)}
                        </b>
                        <div className="row row-tight" style={{ justifyContent: "flex-end", marginTop: 3 }}>
                          <Badge tone={transactionTone(transaction)} dot>
                            {transactionLabel(transaction)}
                          </Badge>
                          <span className="hint" style={{ margin: 0, fontSize: 10 }}>
                            {itemCount(transaction)} items
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                icon={<Receipt aria-hidden="true" />}
                title="No receipts in this period"
                description={canSell ? "Complete a sale to see it here immediately." : "Completed sales will appear here."}
                actions={
                  canSell ? (
                    <Link href="/sales" className="btn btn--secondary btn--sm">
                      Open register
                    </Link>
                  ) : undefined
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Top products"
            description="Ranked by revenue in this period."
            actions={
              canSeeReports ? (
                <Link href="/reports" className="btn btn--quiet btn--sm">
                  Reports
                </Link>
              ) : null
            }
          />
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
                title="No product sales"
                description="Product rankings appear after completed receipts."
              />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid-3">
        <Card>
          <CardHeader title="Sales by category" description="Revenue split from recorded line items." />
          <CardBody>
            {data.salesByCategory.length ? (
              <CategoryBars data={data.salesByCategory.slice(0, 6)} currency={currency} />
            ) : (
              <EmptyState
                compact
                icon={<BarChart3 aria-hidden="true" />}
                title="No category data"
                description="Categories fill in when products are attached to sales."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Low stock"
            description={`At or below ${data.lowStockThreshold} units · selected outlet`}
            actions={
              canSeeInventory ? (
                <Link href="/inventory" className="btn btn--quiet btn--sm">
                  Inventory
                </Link>
              ) : null
            }
          />
          <CardBody flush>
            {data.lowStock.length ? (
              <div className="record-list">
                {data.lowStock.slice(0, 6).map((row) => (
                  <div className="record" key={`${row.productId}-${row.outlet}`}>
                    <div className="record__top">
                      <div style={{ minWidth: 0 }}>
                        <div className="record__title">{row.name}</div>
                        <div className="record__meta">{row.outlet}</div>
                      </div>
                      <Badge tone={row.stock <= 0 ? "danger" : "warning"} dot>
                        {row.stock <= 0 ? "Out of stock" : `${formatNumber(row.stock)} left`}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                icon={<Boxes aria-hidden="true" />}
                title="Stock looks healthy"
                description="No tracked product is at or below the low-stock threshold for this outlet."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Throughput" description="What the period actually contains." />
          <CardBody>
            <dl className="kv">
              <div>
                <dt>Gross sales</dt>
                <dd className="num">{formatCurrency(current.grossSales, currency)}</dd>
              </div>
              <div>
                <dt>Discounts</dt>
                <dd className="num">{formatCurrency(current.discounts, currency)}</dd>
              </div>
              <div>
                <dt>Tax collected</dt>
                <dd className="num">{formatCurrency(current.tax, currency)}</dd>
              </div>
              <div>
                <dt>Refunds</dt>
                <dd className="num">
                  {data.refundsComplete ? formatCurrency(current.refunds, currency) : "Partial sample"}
                </dd>
              </div>
              <div>
                <dt>Items sold</dt>
                <dd className="num">{formatNumber(current.itemsSold)}</dd>
              </div>
            </dl>
          </CardBody>
          <CardFooter>
            <span className="hint" style={{ margin: 0 }}>
              Tax is money collected for the tax authority, not store revenue.
            </span>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
