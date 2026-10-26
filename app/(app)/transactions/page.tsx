"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "@/lib/api/sales";
import { formatCurrency, formatDate } from "@/lib/formatting/currency";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["transactions", search, status],
    queryFn: () => listTransactions({ search: search || undefined, status: status || undefined, pageSize: 50 }),
  });

  const txs = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input className="max-w-sm" placeholder="Search receipt or cashier..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="voided">Voided</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : txs.length === 0 ? (
        <EmptyState title="No transactions" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-medium">Receipt</th>
                  <th className="p-3 text-left font-medium">Date</th>
                  <th className="p-3 text-left font-medium">Cashier</th>
                  <th className="p-3 text-left font-medium">Outlet</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-left font-medium">Payment</th>
                  <th className="p-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{t.receiptNumber}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(t.createdAt)}</td>
                    <td className="p-3">{t.cashierName}</td>
                    <td className="p-3">{t.outletName}</td>
                    <td className="p-3"><Badge variant={t.status === "completed" ? "success" : "secondary"}>{t.status}</Badge></td>
                    <td className="p-3"><Badge variant={t.paymentStatus === "paid" ? "success" : t.paymentStatus === "failed" ? "destructive" : "warning"}>{t.paymentStatus}</Badge></td>
                    <td className="p-3 text-right tabular-nums font-semibold">{formatCurrency(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
