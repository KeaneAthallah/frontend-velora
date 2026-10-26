"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card, Kpi, Table, Badge } from "@/components/ui";
import { stockByOutlet } from "@/lib/api/inventory";
import { useBusiness } from "@/lib/business/context";

export default function InventoryPage() {
  const { outletId } = useBusiness();
  const { data } = useQuery({ queryKey: ["stock", outletId], queryFn: () => stockByOutlet(outletId!), enabled: !!outletId });
  const rows = data ?? [];
  const value = rows.reduce((s, r) => s + r.stock, 0);
  return (
    <>
      <PageHeader title="Inventory" sub="Stock on hand at Main outlet"><button className="btn">Stock count</button><button className="btn primary">Adjust stock</button></PageHeader>
      <div className="g4">
        <Kpi label="Stock value" value={value} />
        <Kpi label="Low stock" value={rows.filter((p) => p.stock > 0 && p.stock < 10).length} />
        <Kpi label="Out of stock" value={rows.filter((p) => !p.stock).length} />
        <Kpi label="Products tracked" value={rows.length} />
      </div>
      <Card pad={false}>
        <Table cols={["Product", "SKU", "On hand", "Status"]}
          rows={rows.map((p) => [<b key="n">{p.name}</b>, p.sku, p.stock, <Badge key="s">{p.stock === 0 ? "Out" : p.stock < 10 ? "Low" : "OK"}</Badge>])} />
      </Card>
    </>
  );
}
