"use client";

import * as React from "react";
import Link from "next/link";
import { Boxes, ShoppingCart, Receipt, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/page-header";
import { Badge, Button, Delta, EmptyState, InfoTip, Segmented, Skeleton } from "@/components/ui/primitives";
import { SalesAreaChart, PaymentMixBar, CategoryBars } from "@/components/ui/charts";
import { AccessDenied, InlineError, StatGridSkeleton } from "@/components/ui/states";
import { dashboardMetrics } from "@/lib/api/reports";
import { formatCurrency, formatNumber, formatRelative } from "@/lib/formatting/currency";
import { itemCount, transactionLabel, transactionTone } from "@/lib/formatting/transaction";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/date-range";
import { useAuth } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";
import { usePermissions } from "@/lib/auth/auth-context";

export default function OverviewPage() {
  const { session } = useAuth();
  const { outlet, outletId } = useBusiness();
  const { has } = usePermissions();
  const [range, setRange] = React.useState<RangeKey>("30d");
  const widenTo30Days = React.useCallback(() => setRange("30d"), [setRange]);
  const currency = session?.business.currency ?? "IDR";

  const query = React.useMemo(() => {
    const enabled = Boolean(outletId) && has("reports.view");
    return { enabled, staleTime: 30_000 } as const;
  }, [has, outletId]);

  const [data, setData] = React.useState<Awaited<ReturnType<typeof dashboardMetrics>> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);

  React.useEffect(() => {
    if (!query.enabled) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    dashboardMetrics({ range, outletId })
      .then((value) => {
        setData(value ?? null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [range, outletId, query.enabled]);

  if (!has("reports.view") && data === null && !loading) {
    return <AccessDenied permission="reports.view" />;
  }

  return (
    <>
      <PageHeader
        eyebrow={outlet?.name ?? session?.business.name ?? "Workspace"}
        title="Overview"
        description="A live read of the store: recorded sales, stock, and how the period actually performed."
        actions={
          <Segmented
            label="Reporting period"
            options={RANGE_OPTIONS}
            value={range}
            onChange={setRange}
          />
        }
      />

      {error ? (
        <InlineError title="The overview could not be loaded" error={error} onRetry={() => {}} />
      ) : loading || !data ? (
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
      ) : (
        <OverviewContent data={data} currency={currency} onWidenTo30Days={widenTo30Days} />
      )}
    </>
  );
}

function OverviewContent({
  data,
  currency,
  onWidenTo30Days,
}: {
  data: Awaited<ReturnType<typeof dashboardMetrics>>;
  currency: string;
  onWidenTo30Days?: () => void;
}) {
  const { current, previous, changes, trend, previousTrend, period } = data;
  const hasSales = current.transactions > 0;
  const comparisonAvailable = Boolean(previous && (previous.transactions > 0 || previous.netSales > 0));
  const timeLabel = period.key === "today" ? "today" : period.label.toLowerCase();

  return (
    <>
      <div className="grid-4">
        <Stat
          label="Net sales"
          value={formatCurrency(current.netSales, currency)}
          foot={
            <>
              <Delta value={changes.netSales} />
              <span>{comparisonAvailable ? period.comparisonLabel : "No earlier period to compare"}</span>
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
          info="Units sold across completed receipts."
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
            <div className="no-sales">
              <div className="no-sales__head">
                <h2>No sales recorded {timeLabel}</h2>
                <p className="hint no-sales__intro">
                  Totals will fill in as receipts are completed. Widen the period or start the first sale from the register.
                </p>
              </div>
              <div className="no-sales__actions">
                {period.key !== "30d" ? (
                  <Button variant="secondary" onClick={onWidenTo30Days}>
                    Widen to 30 days
                  </Button>
                ) : null}
                <Link href="/sales" className="btn btn--primary">
                  <ShoppingCart aria-hidden="true" />
                  Open register
                </Link>
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
                    <i style={{ background: "transparent", borderTop: "2px dashed hsl(var(--ink-3))", height: 1 }} aria-hidden="true" />
                    Previous
                  </span>
                ) : null}
              </div>
            }
          />
          <CardBody>
            {hasSales ? (
              <SalesAreaChart data={trend} compare={previousTrend} currency={currency} ariaLabel={`Net sales by day for ${period.label}. ${formatCurrency(current.netSales, currency)} total.`} />
            ) : (
              <EmptyState compact icon={<TrendingUp aria-hidden="true" />} title="Nothing to chart yet" description="A daily line appears once the first sale is completed in this period." />
            )}
          </CardBody>
          <CardFooter className="card-footer">
            {trend.some((point) => point.value > 0) ? (
              <span className="hint">
                <TrendingUp aria-hidden="true" style={{ width: 13, height: 13, display: "inline", marginRight: 5 }} />
                Peak day {trend.reduce((best, point) => (point.value > best.value ? point : best)).fullLabel} · {formatCurrency(trend.reduce((best, point) => (point.value > best.value ? point : best)).value, currency)}
              </span>
            ) : (
              <span className="hint">No peak day to report</span>
            )}
            <span className="hint">
              {data.trendComplete ? `${formatNumber(current.transactions)} receipts in the period` : "Trend uses a recent sample of receipts; card totals are exact."}
            </span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader
            title="Payment mix"
            description="How customers settled completed sales."
            actions={
              <InfoTip label="About the payment mix">Payments are grouped by the method recorded at checkout. There can be more than one payment per sale.</InfoTip>
            }
          />
          <CardBody>
            {data.salesByPayment.length ? (
              <PaymentMixBar data={data.salesByPayment} currency={currency} />
            ) : (
              <EmptyState compact icon={<Receipt aria-hidden="true" />} title="No payments to group" description="Payment methods show up here after completed sales." />
            )}
          </CardBody>
          <CardFooter className="card-footer">
            <span className="hint">
              {data.trendComplete ? (data.current.transactions ? `${formatNumber(current.transactions)} completed` : "Awaiting first payment") : "Based on a capped receipt sample"}
            </span>
            {!data.trendComplete ? <Badge tone="warning">Sampled</Badge> : <span className="hint">Amounts include tax</span>}
          </CardFooter>
        </Card>
      </div>

      <div className="grid-main">
        <Card>
          <CardHeader
            title="Recent sales"
            description="The latest completed receipts in this period."
            actions={<Link href="/transactions" className="btn btn--quiet btn--sm">All transactions</Link>}
          />
          <CardBody flush>
            {data.recentTransactions.length ? (
              <div className="table-list">
                {data.recentTransactions.map((transaction) => (
                  <Link key={transaction.id} href={`/transactions?q=${encodeURIComponent(transaction.receiptNumber)}`} className="table-item">
                    <div className="table-item__main">
                      <div className="table-item__title">{transaction.receiptNumber}</div>
                      <div className="table-item__sub">
                        {transaction.customerName || "Walk-in guest"} · {transaction.cashierName || "Cashier"} · {formatRelative(transaction.createdAt)}
                      </div>
                    </div>
                    <div className="table-item__right">
                      <div className="table-item__price">{formatCurrency(transaction.total, currency)}</div>
                      <div className="table-item__meta">
                        <Badge tone={transactionTone(transaction)} dot>{transactionLabel(transaction)}</Badge>
                        <span className="table-item__itemcount">{itemCount(transaction)} items</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState compact icon={<Receipt aria-hidden="true" />} title="No receipts in this period" description="Completed sales will appear here." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Top products"
            description="Ranked by revenue in this period."
            actions={<Link href="/reports" className="btn btn--quiet btn--sm">Reports</Link>}
          />
          <CardBody flush>
            {data.topProducts.length ? (
              <div className="rank-list">
                {data.topProducts.map((product, index) => (
                  <div className="rank-row" key={product.productId || product.name}>
                    <span className="rank-row__n">{String(index + 1).padStart(2, "0")}</span>
                    <div className="rank-row__body">
                      <div className="rank-row__name">{product.name}</div>
                      <div className="rank-row__sub">{formatNumber(product.quantity)} sold</div>
                    </div>
                    <span className="rank-row__value">{formatCurrency(product.revenue, currency)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon={<ShoppingCart aria-hidden="true" />} title="No product sales" description="Product rankings appear after completed receipts." />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid-3">
        <Card>
          <CardHeader title="Sales by category" description="Revenue split from recorded line items." />
          <CardBody>
            {data.salesByCategory.length ? <CategoryBars data={data.salesByCategory.slice(0, 6)} currency={currency} /> : <EmptyState compact icon={<TrendingUp aria-hidden="true" />} title="No category data" description="Categories fill in when products are attached to sales." />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Low stock"
            description={`At or below ${data.lowStockThreshold} units · selected outlet`}
            actions={<Link href="/inventory" className="btn btn--quiet btn--sm">Inventory</Link>}
          />
          <CardBody flush>
            {data.lowStock.length ? (
              <div className="table-list">
                {data.lowStock.slice(0, 6).map((row) => (
                  <div className="table-item" key={`${row.productId}-${row.outlet}`}>
                    <div className="table-item__main">
                      <div className="table-item__title">{row.name}</div>
                      <div className="table-item__sub">{row.outlet}</div>
                    </div>
                    <Badge tone={row.stock <= 0 ? "danger" : "warning"} dot>{row.stock <= 0 ? "Out of stock" : `${formatNumber(row.stock)} left`}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon={<Boxes aria-hidden="true" />} title="Stock looks healthy" description="No tracked product is at or below the low-stock threshold." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Throughput" description="What the period actually contains." />
          <CardBody>
            <dl className="kv">
              <div><dt>Gross sales</dt><dd className="num">{formatCurrency(current.grossSales, currency)}</dd></div>
              <div><dt>Discounts</dt><dd className="num">{formatCurrency(current.discounts, currency)}</dd></div>
              <div><dt>Tax collected</dt><dd className="num">{formatCurrency(current.tax, currency)}</dd></div>
              <div><dt>Refunds</dt><dd className="num">{data.refundsComplete ? formatCurrency(current.refunds, currency) : "Partial sample"}</dd></div>
              <div><dt>Items sold</dt><dd className="num">{formatNumber(current.itemsSold)}</dd></div>
            </dl>
          </CardBody>
          <CardFooter>
            <span className="hint">Tax is money collected for the tax authority, not store revenue.</span>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
