"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardMetrics } from "@/lib/api/reports";
import { formatCurrency } from "@/lib/formatting/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function SalesReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard-report"], queryFn: dashboardMetrics });

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>;
  if (!data) return <EmptyState title="No report data" />;

  const colors = ["#2563eb", "#16a34a", "#d97706", "#dc2626"];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sales by payment method</CardTitle></CardHeader>
          <CardContent className="h-64">
            {data.salesByPayment.every((d) => d.amount === 0) ? (
              <EmptyState title="No payment data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.salesByPayment} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={80} label>
                    {data.salesByPayment.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top products revenue</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topProducts}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
