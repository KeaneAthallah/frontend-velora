"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardMetrics } from "@/lib/api/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/formatting/currency";
import { useBusiness } from "@/lib/business/context";
import { ShoppingCart, Receipt, TrendingUp, RotateCcw } from "lucide-react";

export default function DashboardPage() {
  const { outletId } = useBusiness();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard", outletId],
    queryFn: dashboardMetrics,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }
  if (isError || !data) {
    return <EmptyState title="Failed to load dashboard" description="Please try again." action={<button onClick={() => refetch()} className="text-primary text-sm">Retry</button>} />;
  }

  const stats = [
    { label: "Gross Sales", value: formatCurrency(data.grossSales), icon: TrendingUp },
    { label: "Net Sales", value: formatCurrency(data.netSales), icon: ShoppingCart },
    { label: "Transactions", value: String(data.transactions), icon: Receipt },
    { label: "Avg Transaction", value: formatCurrency(data.avgTransaction), icon: Receipt },
    { label: "Refunds", value: formatCurrency(data.refunds), icon: RotateCcw },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top Products</CardTitle></CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <EmptyState title="No sales yet" />
            ) : (
              <ul className="space-y-2">
                {data.topProducts.map((p) => (
                  <li key={p.name} className="flex items-center justify-between text-sm">
                    <span>{p.name}</span>
                    <span className="tabular-nums text-muted-foreground">{p.quantity} sold · {formatCurrency(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Low Stock</CardTitle></CardHeader>
          <CardContent>
            {data.lowStock.length === 0 ? (
              <EmptyState title="No low stock" />
            ) : (
              <ul className="space-y-2">
                {data.lowStock.map((p) => (
                  <li key={p.productId} className="flex items-center justify-between text-sm">
                    <span>{p.name}</span>
                    <span className="tabular-nums text-destructive">{p.stock} left</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
        <CardContent>
          {data.recentTransactions.length === 0 ? (
            <EmptyState title="No transactions" />
          ) : (
            <ul className="divide-y">
              {data.recentTransactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{t.receiptNumber}</div>
                    <div className="text-xs text-muted-foreground">{t.cashierName} · {formatDate(t.createdAt)}</div>
                  </div>
                  <div className="tabular-nums font-semibold">{formatCurrency(t.total)}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
