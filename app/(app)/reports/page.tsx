"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card, Table, LineChart, Bars } from "@/components/ui";
import { dashboardMetrics } from "@/lib/api/reports";
import { listProducts } from "@/lib/api/products";
import { formatCurrency } from "@/lib/formatting/currency";

const sales7 = [8.2, 9.1, 7.6, 10.4, 11.8, 14.2, 12.6];
const days7 = ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];

export default function ReportsPage() {
  useQuery({ queryKey: ["dashboard"], queryFn: dashboardMetrics });
  const { data: prodData } = useQuery({ queryKey: ["products"], queryFn: () => listProducts({ pageSize: 100 }) });
  const top = [...(prodData?.data ?? [])].sort((a, b) => b.price * 1 - a.price * 1).slice(0, 5);
  return (
    <>
      <PageHeader title="Reports" sub="Last 7 days"><button className="btn">Last 7 days</button><button className="btn primary">Export CSV</button></PageHeader>
      <div className="g2">
        <Card title="Daily sales (million Rp)"><LineChart data={sales7} labels={days7} /></Card>
        <Card title="Sales by category"><Bars data={[["Coffee", 56], ["Food", 22], ["Non-coffee", 14], ["Snacks", 8]]} /></Card>
      </div>
      <Card title="Best sellers" pad={false}>
        <Table cols={["Product", "Category", "Price"]} rows={top.map((p) => [<b key="n">{p.name}</b>, p.categoryName, formatCurrency(p.price)])} />
      </Card>
    </>
  );
}
