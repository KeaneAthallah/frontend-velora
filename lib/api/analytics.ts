import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb } from "./mock-db";

export type AnalyticsRange = { from?: string; to?: string; outletId?: string };

export type MetricDelta = {
  current: number;
  previous: number;
  changePercent: number | null;
};

export type ComparisonReport = {
  from: string;
  to: string;
  compare: "previous_period" | "previous_year";
  metrics: Record<string, MetricDelta>;
};

export type ProductAnalyticsRow = {
  productId: string;
  name: string;
  sku?: string;
  quantity: number;
  orders: number;
  revenue: number;
  cost: number;
  discounts: number;
  margin: number;
  marginPercent: number;
  revenueSharePercent: number;
  dailyVelocity: number;
  abcClass: "A" | "B" | "C";
};

export type ProductAnalytics = {
  from: string;
  to: string;
  revenueTotal: number;
  products: ProductAnalyticsRow[];
  services: { serviceId: string; name: string; bookings: number; completed: number; revenue: number }[];
};

export type OperationalAnalytics = {
  orders: {
    total: number;
    open: number;
    averageOrderValue: number;
    averagePrepMinutes: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byHour: { hour: number; orders: number }[];
  };
  lowStockCount: number;
};

export type FinancialAnalytics = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  otherIncome: number;
  netProfit: number;
  tax: number;
  refunds: number;
  cashCollected: number;
  receivableOutstanding: number;
  payableOutstanding: number;
  grossMarginPercent: number;
};

function query(range: AnalyticsRange, extra?: Record<string, string>) {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  if (range.outletId) params.set("outlet_id", range.outletId);
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  return params.toString() ? `?${params}` : "";
}

function num(value: unknown) {
  return Number(value ?? 0);
}

function mockPipe() {
  return mockDb.transactions.filter((transaction) => transaction.status === "completed");
}

export async function getComparisonReport(
  range: AnalyticsRange,
  compare: "previous_period" | "previous_year" = "previous_period"
): Promise<ComparisonReport> {
  if (USE_MOCK_API) {
    const sales = mockPipe();
    const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const metric = (current: number, previous: number): MetricDelta => ({
      current,
      previous,
      changePercent: previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null,
    });
    return {
      from: range.from ?? new Date().toISOString().slice(0, 10),
      to: range.to ?? new Date().toISOString().slice(0, 10),
      compare,
      metrics: {
        revenue: metric(revenue, revenue * 0.87),
        orders: metric(sales.length, Math.round(sales.length * 0.9)),
        average_order_value: metric(sales.length ? revenue / sales.length : 0, 0),
        gross_profit: metric(revenue * 0.62, revenue * 0.55),
        discounts: metric(0, 0),
        tax: metric(revenue * 0.11, revenue * 0.1),
        refunds: metric(0, 0),
      },
    };
  }

  const data = await apiRequest<any>(`/analytics/comparison${query(range, { compare })}`);
  const metrics: Record<string, MetricDelta> = {};
  for (const [key, value] of Object.entries<any>(data?.metrics ?? {})) {
    metrics[key] = {
      current: num(value.current),
      previous: num(value.previous),
      changePercent: value.change_percent == null ? null : num(value.change_percent),
    };
  }
  return { from: data?.from ?? "", to: data?.to ?? "", compare, metrics };
}

export async function getProductAnalytics(range: AnalyticsRange): Promise<ProductAnalytics> {
  if (USE_MOCK_API) {
    const products = mockDb.products.slice(0, 8).map((product) => {
      const quantity = 3 + (product.id.charCodeAt(product.id.length - 1) % 12);
      const revenue = product.price * quantity;
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity,
        orders: quantity,
        revenue,
        cost: revenue * 0.38,
        discounts: 0,
        margin: revenue * 0.62,
        marginPercent: 62,
        revenueSharePercent: 0,
        dailyVelocity: Math.round((quantity / 30) * 100) / 100,
        abcClass: "A" as const,
      };
    });
    const total = products.reduce((sum, row) => sum + row.revenue, 0) || 1;
    products.forEach((row) => (row.revenueSharePercent = Math.round((row.revenue / total) * 1000) / 10));
    return { from: "", to: "", revenueTotal: total, products, services: [] };
  }

  const data = await apiRequest<any>(`/analytics/products${query(range)}`);
  return {
    from: data?.from ?? "",
    to: data?.to ?? "",
    revenueTotal: num(data?.revenue_total),
    products: (data?.products ?? []).map((row: any) => ({
      productId: String(row.product_id),
      name: row.product_name ?? row.name ?? "",
      sku: row.sku ?? undefined,
      quantity: num(row.quantity),
      orders: num(row.orders),
      revenue: num(row.revenue),
      cost: num(row.cost),
      discounts: num(row.discounts),
      margin: num(row.margin),
      marginPercent: num(row.margin_percent),
      revenueSharePercent: num(row.revenue_share_percent),
      dailyVelocity: num(row.daily_velocity),
      abcClass: (row.abc_class ?? "C") as "A" | "B" | "C",
    })),
    services: (data?.services ?? []).map((row: any) => ({
      serviceId: String(row.service_id),
      name: row.name ?? "",
      bookings: num(row.bookings),
      completed: num(row.completed),
      revenue: num(row.revenue),
    })),
  };
}

export async function getOperationalAnalytics(range: AnalyticsRange): Promise<OperationalAnalytics> {
  if (USE_MOCK_API) {
    const orders = mockDb.orders;
    return {
      orders: {
        total: orders.length,
        open: orders.filter((order) => order.orderStatus && !["completed", "cancelled"].includes(order.orderStatus)).length,
        averageOrderValue: orders.length
          ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length
          : 0,
        averagePrepMinutes: 14,
        byStatus: {},
        byType: {},
        byHour: Array.from({ length: 12 }, (_, index) => ({ hour: index + 9, orders: 2 + (index % 4) })),
      },
      lowStockCount: mockDb.products.filter((product) =>
        Object.values(product.stockByOutlet ?? {}).some((quantity) => quantity <= 5)
      ).length,
    };
  }

  const data = await apiRequest<any>(`/analytics/operational${query(range)}`);
  const orders = data?.orders ?? {};
  return {
    orders: {
      total: num(orders.total),
      open: num(orders.open),
      averageOrderValue: num(orders.average_order_value),
      averagePrepMinutes: num(orders.average_prep_minutes),
      byStatus: orders.by_status ?? {},
      byType: orders.by_type ?? {},
      byHour: (orders.by_hour ?? []).map((row: any) => ({ hour: num(row.hour), orders: num(row.orders) })),
    },
    lowStockCount: num(data?.low_stock_count),
  };
}

export async function getFinancialAnalytics(range: AnalyticsRange): Promise<FinancialAnalytics> {
  if (USE_MOCK_API) {
    const revenue = mockPipe().reduce((sum, sale) => sum + sale.total, 0);
    return {
      revenue,
      cogs: revenue * 0.38,
      grossProfit: revenue * 0.62,
      expenses: revenue * 0.18,
      otherIncome: 0,
      netProfit: revenue * 0.44,
      tax: revenue * 0.11,
      refunds: 0,
      cashCollected: revenue,
      receivableOutstanding: 0,
      payableOutstanding: 0,
      grossMarginPercent: 62,
    };
  }

  const data = await apiRequest<any>(`/analytics/financial${query(range)}`);
  return {
    revenue: num(data?.revenue),
    cogs: num(data?.cogs),
    grossProfit: num(data?.gross_profit),
    expenses: num(data?.expenses),
    otherIncome: num(data?.other_income),
    netProfit: num(data?.net_profit),
    tax: num(data?.tax),
    refunds: num(data?.refunds),
    cashCollected: num(data?.cash_collected),
    receivableOutstanding: num(data?.receivable_outstanding),
    payableOutstanding: num(data?.payable_outstanding),
    grossMarginPercent: num(data?.gross_margin_percent),
  };
}
