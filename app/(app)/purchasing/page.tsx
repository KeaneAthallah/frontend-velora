"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card, Table, Badge } from "@/components/ui";
import { listPurchaseOrders } from "@/lib/api/purchasing";
import { formatCurrency, formatDate } from "@/lib/formatting/currency";

export default function PurchasingPage() {
  const { data } = useQuery({ queryKey: ["purchase-orders"], queryFn: () => listPurchaseOrders({ pageSize: 50 }) });
  const pos = data?.data ?? [];
  return (
    <>
      <PageHeader title="Purchasing" sub="Purchase orders and suppliers"><button className="btn">Suppliers</button><button className="btn primary">Create purchase order</button></PageHeader>
      <Card pad={false}>
        <Table cols={["Order", "Supplier", "Items", "Total", "Date", "Status"]}
          rows={pos.map((o) => [<b key="i">{o.number}</b>, o.supplierName, o.items.length, formatCurrency(o.total), formatDate(o.createdAt), <Badge key="s">{o.status}</Badge>])} />
      </Card>
    </>
  );
}
