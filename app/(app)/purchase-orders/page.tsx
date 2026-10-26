"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { listPurchaseOrders } from "@/lib/api/purchasing";
import { formatCurrency, formatDate } from "@/lib/formatting/currency";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function PurchaseOrdersPage() {
  const { data, isLoading } = useQuery({ queryKey: ["purchase-orders"], queryFn: () => listPurchaseOrders({ pageSize: 50 }) });
  const pos = data?.data ?? [];
  return (
    <Card><CardContent className="p-4">
      <h3 className="font-semibold mb-3">Purchase orders</h3>
      {isLoading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        : pos.length === 0 ? <EmptyState title="No purchase orders" />
        : <table className="w-full text-sm">
            <thead className="border-b"><tr><th className="p-2 text-left">Number</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Created</th><th className="p-2 text-right">Total</th></tr></thead>
            <tbody>{pos.map((po) => (
              <tr key={po.id} className="border-b last:border-0">
                <td className="p-2 font-medium">{po.number}</td>
                <td className="p-2">{po.supplierName}</td>
                <td className="p-2"><Badge variant={po.status === "received" ? "success" : po.status === "cancelled" ? "destructive" : "secondary"}>{po.status}</Badge></td>
                <td className="p-2 text-muted-foreground">{formatDate(po.createdAt)}</td>
                <td className="p-2 text-right tabular-nums">{formatCurrency(po.total)}</td>
              </tr>
            ))}</tbody>
          </table>}
    </CardContent></Card>
  );
}
