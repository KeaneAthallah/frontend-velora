"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card, Table, Badge } from "@/components/ui";
import { listProducts } from "@/lib/api/products";
import { formatCurrency } from "@/lib/formatting/currency";

export default function ProductsPage() {
  const { data } = useQuery({ queryKey: ["products"], queryFn: () => listProducts({ pageSize: 100 }) });
  const products = data?.data ?? [];
  return (
    <>
      <PageHeader title="Products" sub={`${products.length} products`}>
        <button className="btn">Import</button>
        <button className="btn primary">Add product</button>
      </PageHeader>
      <Card pad={false}>
        <Table cols={["Product", "SKU", "Category", "Price", "Cost", "Margin", "Stock"]}
          rows={products.map((p) => [
            <b key="n">{p.name}</b>,
            p.sku,
            p.categoryName,
            formatCurrency(p.price),
            formatCurrency(p.cost),
            p.price ? Math.round((1 - p.cost / p.price) * 100) + "%" : "—",
            <Badge key="s">{p.active ? (p.stockByOutlet && Object.values(p.stockByOutlet).reduce((a, b) => a + b, 0) === 0 ? "Out" : (Object.values(p.stockByOutlet).reduce((a, b) => a + b, 0) < 10 ? "Low" : "OK")) : "Out"}</Badge>,
          ])} />
      </Card>
    </>
  );
}
