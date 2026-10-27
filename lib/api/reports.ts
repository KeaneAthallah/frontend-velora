import { format } from "date-fns";
import { apiRequest, USE_MOCK_API } from "./client";
import { getDateRange, dayKeys, changePercent, type RangeKey } from "@/lib/date-range";
import { mockDb } from "./mock-db";
import { listTransactions } from "./sales";
import { listProducts } from "./products";
import type {
  DailySalesRow,
  DashboardMetrics,
  MetricSet,
  Transaction,
  TrendPoint,
} from "./types";

const LOW_STOCK_THRESHOLD = 10;

export function paymentMethodLabel(method: string) {
  const key = method.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const labels: Record<string, string> = {
    cash: "Cash",
    qris: "QRIS",
    debit_card: "Debit card",
    credit_card: "Credit card",
    bank_transfer: "Bank transfer",
    ewallet: "E-wallet",
    e_wallet: "E-wallet",
  };
  return labels[key] ?? method.replaceAll("_", " ");
}

function inRange(iso: string, from: Date, to: Date) {
  const time = new Date(iso).getTime();
  return time >= from.getTime() && time <= to.getTime();
}

function metricSet(transactions: Transaction[], refunded: Transaction[]): MetricSet {
  const completed = transactions.filter((transaction) => transaction.status === "completed");
  const tax = completed.reduce((sum, transaction) => sum + transaction.tax, 0);
  const collected = completed.reduce((sum, transaction) => sum + transaction.total, 0);
  const netSales = collected - tax;
  const count = completed.length;
  return {
    grossSales: completed.reduce((sum, transaction) => sum + transaction.subtotal, 0),
    netSales,
    transactions: count,
    avgTransaction: count ? netSales / count : 0,
    refunds: refunded.reduce((sum, transaction) => sum + transaction.total, 0),
    discounts: completed.reduce((sum, transaction) => sum + transaction.discount, 0),
    tax,
    itemsSold: completed.reduce(
      (sum, transaction) => sum + transaction.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    ),
  };
}

function buildDaily(transactions: Transaction[], from: Date, to: Date): DailySalesRow[] {
  const keys = dayKeys(from, to);
  return keys.map((key) => {
    const rows = transactions.filter(
      (transaction) => transaction.status === "completed" && format(new Date(transaction.createdAt), "yyyy-MM-dd") === key
    );
    const grossSales = rows.reduce((sum, row) => sum + row.subtotal, 0);
    const discounts = rows.reduce((sum, row) => sum + row.discount, 0);
    const tax = rows.reduce((sum, row) => sum + row.tax, 0);
    const netSales = rows.reduce((sum, row) => sum + row.total - row.tax, 0);
    return {
      date: key,
      label: format(new Date(`${key}T12:00:00`), "d MMM"),
      orders: rows.length,
      grossSales,
      discounts,
      tax,
      netSales,
      itemsSold: rows.reduce(
        (sum, row) => sum + row.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0
      ),
    };
  });
}

function buildTrend(transactions: Transaction[], from: Date, to: Date): TrendPoint[] {
  return buildDaily(transactions, from, to).map((row) => ({
    date: row.date,
    label: row.label,
    fullLabel: format(new Date(`${row.date}T12:00:00`), "EEEE, d MMMM yyyy"),
    value: row.netSales,
    orders: row.orders,
  }));
}

function buildTopProducts(transactions: Transaction[]) {
  const map = new Map<string, { productId: string; name: string; quantity: number; revenue: number }>();
  transactions
    .filter((transaction) => transaction.status === "completed")
    .forEach((transaction) => {
      transaction.items.forEach((item) => {
        const key = item.productId ?? item.name;
        const current = map.get(key) ?? {
          productId: item.productId ?? "",
          name: item.name,
          quantity: 0,
          revenue: 0,
        };
        current.quantity += item.quantity;
        current.revenue += item.lineTotal;
        map.set(key, current);
      });
    });
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
}

function buildPaymentMix(transactions: Transaction[]) {
  const map = new Map<string, { method: string; amount: number; count: number }>();
  transactions
    .filter((transaction) => transaction.status === "completed")
    .forEach((transaction) => {
      transaction.payments.forEach((payment) => {
        const method = paymentMethodLabel(payment.method);
        const current = map.get(method) ?? { method, amount: 0, count: 0 };
        current.amount += payment.amount;
        current.count += 1;
        map.set(method, current);
      });
    });
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

function buildCategoryMix(transactions: Transaction[]) {
  const productCategories = new Map(
    mockDb.products.map((product) => [product.id, product.categoryName || "Uncategorized"])
  );
  const map = new Map<string, { name: string; revenue: number; quantity: number }>();
  transactions
    .filter((transaction) => transaction.status === "completed")
    .forEach((transaction) => {
      transaction.items.forEach((item) => {
        const name = (item.productId ? productCategories.get(item.productId) : undefined) ?? "Uncategorized";
        const current = map.get(name) ?? { name, revenue: 0, quantity: 0 };
        current.revenue += item.lineTotal;
        current.quantity += item.quantity;
        map.set(name, current);
      });
    });
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

function buildLowStock(outletId?: string) {
  const rows: DashboardMetrics["lowStock"] = [];
  mockDb.products
    .filter((product) => product.active && product.trackInventory !== false)
    .forEach((product) => {
      const outlets = outletId
        ? mockDb.outlets.filter((outlet) => outlet.id === outletId)
        : mockDb.outlets;
      outlets.forEach((outlet) => {
        const stock = product.stockByOutlet[outlet.id] ?? 0;
        if (stock <= LOW_STOCK_THRESHOLD) {
          rows.push({
            productId: product.id,
            name: product.name,
            outlet: outlet.name,
            stock,
            threshold: LOW_STOCK_THRESHOLD,
          });
        }
      });
    });
  return rows.sort((a, b) => a.stock - b.stock).slice(0, 12);
}

export async function dashboardMetrics(options?: {
  range?: RangeKey;
  outletId?: string | null;
}): Promise<DashboardMetrics> {
  const range = getDateRange(options?.range ?? "7d");
  const outletId = options?.outletId ?? undefined;

  if (USE_MOCK_API) {
    const scoped = mockDb.transactions.filter((transaction) => !outletId || transaction.outletId === outletId);
    const currentRows = scoped.filter((transaction) => inRange(transaction.createdAt, range.from, range.to));
    const previousRows = scoped.filter((transaction) =>
      inRange(transaction.createdAt, range.previousFrom, range.previousTo)
    );
    const current = metricSet(currentRows, currentRows.filter((transaction) => transaction.status === "refunded"));
    const previous = metricSet(previousRows, previousRows.filter((transaction) => transaction.status === "refunded"));
    const daily = buildDaily(currentRows, range.from, range.to);
    const previousDaily = buildDaily(previousRows, range.previousFrom, range.previousTo);

    return {
      period: {
        key: range.key,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        label: range.label,
        comparisonLabel: range.comparisonLabel,
      },
      current,
      previous,
      changes: {
        netSales: changePercent(current.netSales, previous.netSales),
        transactions: changePercent(current.transactions, previous.transactions),
        avgTransaction: changePercent(current.avgTransaction, previous.avgTransaction),
        itemsSold: changePercent(current.itemsSold, previous.itemsSold),
      },
      trend: buildTrend(currentRows, range.from, range.to),
      previousTrend: previousDaily.map((row, index) => ({
        date: daily[index]?.date ?? row.date,
        value: row.netSales,
      })),
      daily,
      trendComplete: true,
      refundsComplete: true,
      topProducts: buildTopProducts(currentRows),
      salesByPayment: buildPaymentMix(currentRows),
      salesByCategory: buildCategoryMix(currentRows),
      lowStock: buildLowStock(outletId),
      recentTransactions: [...currentRows]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6),
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    };
  }

  const from = format(range.from, "yyyy-MM-dd HH:mm:ss");
  const to = format(range.to, "yyyy-MM-dd HH:mm:ss");
  const previousFrom = format(range.previousFrom, "yyyy-MM-dd HH:mm:ss");
  const previousTo = format(range.previousTo, "yyyy-MM-dd HH:mm:ss");
  const outletQuery = outletId ? `&outlet_id=${encodeURIComponent(outletId)}` : "";

  const [summary, previousSummary, byProduct, lowStockRows, sample, refundedSample] = await Promise.all([
    apiRequest<any>(`/reports/sales-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${outletQuery}`),
    apiRequest<any>(
      `/reports/sales-summary?from=${encodeURIComponent(previousFrom)}&to=${encodeURIComponent(previousTo)}${outletQuery}`
    ),
    apiRequest<any>(`/reports/sales-by-product?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${outletQuery}`),
    apiRequest<any>(`/reports/low-stock?threshold=${LOW_STOCK_THRESHOLD}${outletId ? `&outlet_id=${encodeURIComponent(outletId)}` : ""}`).catch(() => []),
    fetchSample(from, to, outletId),
    fetchRefunded(from, to, outletId),
  ]);

  const productRows: any[] = Array.isArray(byProduct) ? byProduct : (byProduct?.data ?? []);
  const topProducts = productRows
    .map((row) => ({
      productId: String(row.product_id ?? ""),
      name: row.product_name ?? row.name ?? "",
      quantity: Number(row.qty ?? row.quantity ?? 0),
      revenue: Number(row.total ?? 0),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const completed = sample.data.filter((transaction) => transaction.status === "completed");
  const current: MetricSet = {
    grossSales: Number(summary.gross_sales ?? 0),
    netSales: Number(summary.net_sales ?? 0) - Number(summary.tax ?? 0),
    transactions: Number(summary.count ?? 0),
    avgTransaction: Number(summary.count ?? 0)
      ? (Number(summary.net_sales ?? 0) - Number(summary.tax ?? 0)) / Number(summary.count)
      : 0,
    refunds: refundedSample.data.reduce((sum, transaction) => sum + transaction.total, 0),
    discounts: Number(summary.discounts ?? 0),
    tax: Number(summary.tax ?? 0),
    itemsSold: productRows.reduce((sum, row) => sum + Number(row.qty ?? row.quantity ?? 0), 0),
  };
  const previous: MetricSet = {
    grossSales: Number(previousSummary.gross_sales ?? 0),
    netSales: Number(previousSummary.net_sales ?? 0) - Number(previousSummary.tax ?? 0),
    transactions: Number(previousSummary.count ?? 0),
    avgTransaction: Number(previousSummary.count ?? 0)
      ? (Number(previousSummary.net_sales ?? 0) - Number(previousSummary.tax ?? 0)) /
        Number(previousSummary.count)
      : 0,
    refunds: 0,
    discounts: Number(previousSummary.discounts ?? 0),
    tax: Number(previousSummary.tax ?? 0),
    itemsSold: 0,
  };

  let categoryMix: DashboardMetrics["salesByCategory"] = [];
  if (completed.length) {
    const products = await listProducts({ pageSize: 200 }).catch(() => null);
    const categoryByProduct = new Map(
      (products?.data ?? []).map((product) => [product.id, product.categoryName || "Uncategorized"])
    );
    const map = new Map<string, { name: string; revenue: number; quantity: number }>();
    completed.forEach((transaction) => {
      transaction.items.forEach((item) => {
        const name = (item.productId ? categoryByProduct.get(item.productId) : undefined) ?? "Uncategorized";
        const entry = map.get(name) ?? { name, revenue: 0, quantity: 0 };
        entry.revenue += item.lineTotal;
        entry.quantity += item.quantity;
        map.set(name, entry);
      });
    });
    categoryMix = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }

  return {
    period: {
      key: range.key,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
      comparisonLabel: range.comparisonLabel,
    },
    current,
    previous,
    changes: {
      netSales: changePercent(current.netSales, previous.netSales),
      transactions: changePercent(current.transactions, previous.transactions),
      avgTransaction: changePercent(current.avgTransaction, previous.avgTransaction),
      itemsSold: current.itemsSold && previous.itemsSold ? changePercent(current.itemsSold, previous.itemsSold) : null,
    },
    trend: buildTrend(completed, range.from, range.to),
    previousTrend: [],
    daily: buildDaily(completed, range.from, range.to),
    trendComplete: sample.complete,
    refundsComplete: refundedSample.complete,
    topProducts,
    salesByPayment: buildPaymentMix(completed),
    salesByCategory: categoryMix,
    lowStock: (Array.isArray(lowStockRows) ? lowStockRows : (lowStockRows?.data ?? [])).map((row: any) => ({
      productId: String(row.product_id),
      name: row.product?.name ?? "",
      outlet: row.outlet?.name ?? "",
      stock: Number(row.quantity ?? 0),
      threshold: LOW_STOCK_THRESHOLD,
    })),
    recentTransactions: sample.data.slice(0, 6),
    lowStockThreshold: LOW_STOCK_THRESHOLD,
  };
}

async function fetchSample(from: string, to: string, outletId?: string) {
  const first = await listTransactions({ page: 1, pageSize: 50, from, to, outletId });
  const pageCount = Math.min(first.totalPages, 6);
  let rows = [...first.data];
  if (pageCount > 1) {
    const rest = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) =>
        listTransactions({ page: index + 2, pageSize: 50, from, to, outletId })
      )
    );
    rest.forEach((page) => {
      rows = rows.concat(page.data);
    });
  }
  return { data: rows, complete: first.total <= rows.length };
}

async function fetchRefunded(from: string, to: string, outletId?: string) {
  const first = await listTransactions({ page: 1, pageSize: 50, from, to, outletId, status: "refunded" });
  const pageCount = Math.min(first.totalPages, 4);
  let rows = [...first.data];
  if (pageCount > 1) {
    const rest = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) =>
        listTransactions({ page: index + 2, pageSize: 50, from, to, outletId, status: "refunded" })
      )
    );
    rest.forEach((page) => {
      rows = rows.concat(page.data);
    });
  }
  return { data: rows, complete: first.total <= rows.length };
}

export async function recentTransactionsPreview(limit = 5): Promise<Transaction[]> {
  if (USE_MOCK_API) {
    return [...mockDb.transactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
  const data = await listTransactions({ page: 1, pageSize: limit });
  return data.data;
}
