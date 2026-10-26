import { apiRequest, USE_MOCK_API } from "./client";
import { mockTransactions, mockProducts } from "./mock-data";
import type { DashboardMetrics } from "./types";

export async function dashboardMetrics(): Promise<DashboardMetrics> {
  if (USE_MOCK_API) {
    const txs = mockTransactions;
    const grossSales = txs.reduce((s, t) => s + t.subtotal, 0);
    const netSales = txs.reduce((s, t) => s + t.total, 0);
    const refunds = txs.filter((t) => t.status === "refunded").reduce((s, t) => s + t.total, 0);
    return {
      grossSales,
      netSales,
      transactions: txs.length,
      avgTransaction: txs.length ? netSales / txs.length : 0,
      refunds,
      topProducts: mockProducts.slice(0, 4).map((p) => ({ name: p.name, quantity: Math.floor(Math.random() * 20) + 1, revenue: p.price * 5 })),
      salesByPayment: [{ method: "Cash", amount: 110000 }, { method: "QRIS", amount: 0 }],
      lowStock: mockProducts.filter((p) => (p.stockByOutlet.o1 ?? 0) < 30).map((p) => ({ productId: p.id, name: p.name, outlet: "Outlet Pusat", stock: p.stockByOutlet.o1 ?? 0 })),
      recentTransactions: txs.slice(0, 5),
    };
  }
  const summary = await apiRequest<any>("/reports/sales-summary");
  const byProduct = await apiRequest<any>("/reports/sales-by-product");
  const lowStockRows = await apiRequest<any>("/reports/low-stock?threshold=5");
  const recent = await apiRequest<any>("/sales?per_page=5");

  const grossSales = Number(summary.gross_sales ?? 0);
  const netSales = Number(summary.net_sales ?? 0);
  const count = Number(summary.count ?? 0);
  const refunds = 0;
  const topProducts = (Array.isArray(byProduct) ? byProduct : []).map((r: any) => ({
    name: r.product_name ?? r.name ?? "",
    quantity: Number(r.qty ?? r.quantity ?? 0),
    revenue: Number(r.total ?? 0),
  }));
  const lowStock = (Array.isArray(lowStockRows) ? lowStockRows : []).map((r: any) => ({
    productId: String(r.product_id),
    name: r.product?.name ?? "",
    outlet: r.outlet?.name ?? "",
    stock: Number(r.quantity ?? 0),
  }));
  const recentTransactions = (Array.isArray(recent) ? recent : (recent?.data ?? [])).slice(0, 5).map((s: any) => ({
    id: String(s.id),
    receiptNumber: s.receipt_number ?? "",
    outletId: String(s.outlet_id),
    outletName: s.outlet?.name ?? "",
    cashierId: String(s.cashier_id),
    cashierName: s.cashier?.name ?? "",
    items: (s.items ?? []).map((it: any) => ({ name: it.product_name ?? "", sku: it.sku ?? "", quantity: Number(it.quantity), unitPrice: Number(it.unit_price), discount: Number(it.discount_amount ?? 0), lineTotal: Number(it.line_total) })),
    subtotal: Number(s.subtotal),
    discount: Number(s.discount_amount ?? 0),
    tax: Number(s.tax_amount ?? 0),
    total: Number(s.total),
    paymentStatus: Number(s.paid_amount ?? 0) >= Number(s.total ?? 0) ? "paid" : "pending",
    status: (s.status === "voided" ? "voided" : s.status === "refunded" ? "refunded" : "completed") as any,
    payments: [],
    createdAt: s.created_at ?? new Date().toISOString(),
  }));

  return {
    grossSales,
    netSales,
    transactions: count,
    avgTransaction: count ? netSales / count : 0,
    refunds,
    topProducts,
    salesByPayment: [{ method: "Cash", amount: netSales }],
    lowStock,
    recentTransactions,
  };
}
