"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card, Kpi, Table, Badge, LineChart, Bars } from "@/components/ui";
import { dashboardMetrics } from "@/lib/api/reports";
import { listTransactions } from "@/lib/api/sales";
import { stockByOutlet } from "@/lib/api/inventory";
import { useBusiness } from "@/lib/business/context";
import { formatCurrency } from "@/lib/formatting/currency";

const sales7 = [8.2, 9.1, 7.6, 10.4, 11.8, 14.2, 12.6];
const days7 = ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];

export default function OverviewPage() {
  const { outletId } = useBusiness();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: dashboardMetrics });
  const { data: txData } = useQuery({ queryKey: ["transactions-recent"], queryFn: () => listTransactions({ pageSize: 5 }) });
  const { data: stock } = useQuery({ queryKey: ["stock-overview", outletId], queryFn: () => stockByOutlet(outletId!), enabled: !!outletId });

  const low = (stock ?? []).filter((p) => p.stock < 10);
  const recent = txData?.data ?? [];
  const metrics = data;

  return (
    <>
      <PageHeader title="Overview" sub="Main outlet"><Link className="btn primary" href="/pos">New sale</Link></PageHeader>
      <div className="g4">
        <Kpi label="Total sales" value={formatCurrency(metrics?.netSales ?? 0)} delta="+12% vs last week" />
        <Kpi label="Transactions" value={String(metrics?.transactions ?? 0)} delta="+8%" />
        <Kpi label="Average order" value={formatCurrency(metrics?.avgTransaction ?? 0)} delta="+6%" />
        <Kpi label="Items low on stock" value={low.length} delta="-2 since Monday" />
      </div>
      <div className="g2">
        <Card title="Sales, last 7 days (million Rp)"><LineChart data={sales7} labels={days7} /></Card>
        <Card title="Payment methods"><Bars data={[["Cash", 38], ["QRIS", 44], ["Card", 18]]} /></Card>
      </div>
      <div className="g2">
        <Card title="Recent orders" pad={false} action={<Link href="/pos" className="link">Open sales</Link>}>
          <Table cols={["Order", "Time", "Customer", "Total", "Status"]} rows={recent.map((o) => [o.receiptNumber, new Date(o.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }), o.customerName ?? "Walk-in", formatCurrency(o.total), <Badge key="b">{o.paymentStatus === "paid" ? "Paid" : o.status}</Badge>])} />
        </Card>
        <Card title="Needs restocking" pad={false} action={<Link href="/purchasing" className="link">Create purchase order</Link>}>
          <Table cols={["Product", "In stock"]} rows={low.map((p) => [p.name, p.stock])} />
        </Card>
      </div>
    </>
  );
}
