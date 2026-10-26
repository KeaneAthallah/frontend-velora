"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { stockByOutlet, adjustStock, listMovements, type StockRow } from "@/lib/api/inventory";
import { listProducts } from "@/lib/api/products";
import { formatNumber, formatDate } from "@/lib/formatting/currency";
import type { InventoryMovement } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusiness } from "@/lib/business/context";
import { useToast } from "@/components/ui/toast";
import { Plus } from "lucide-react";

export default function InventoryPage() {
  const { outletId } = useBusiness();
  const qc = useQueryClient();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("");

  const stockQ = useQuery({ queryKey: ["stock", outletId], queryFn: () => stockByOutlet(outletId!), enabled: !!outletId });
  const productsQ = useQuery({ queryKey: ["products-all"], queryFn: () => listProducts({ pageSize: 100 }) });
  const movementsQ = useQuery({ queryKey: ["movements"], queryFn: () => listMovements({ pageSize: 20 }) });

  const adjustMut = useMutation({
    mutationFn: () => adjustStock({ productId, outletId: outletId!, quantity, reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock"] }); qc.invalidateQueries({ queryKey: ["movements"] }); push({ title: "Stock adjusted", variant: "success" }); setOpen(false); setReason(""); setQuantity(0); },
    onError: (e) => push({ title: "Failed", description: (e as Error).message, variant: "error" }),
  });

  const stock = stockQ.data ?? [];
  const movements = movementsQ.data?.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Stock by outlet</h3>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Adjust</Button>
          </div>
          {stockQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : stock.length === 0 ? (
            <EmptyState title="No stock data" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr><th className="p-2 text-left">Product</th><th className="p-2 text-left">SKU</th><th className="p-2 text-right">Stock</th></tr>
              </thead>
              <tbody>
                {stock.map((s: StockRow) => (
                  <tr key={s.productId} className="border-b last:border-0">
                    <td className="p-2">{s.name}</td>
                    <td className="p-2 text-muted-foreground">{s.sku}</td>
                    <td className="p-2 text-right tabular-nums">{formatNumber(s.stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold">Recent movements</h3>
          {movementsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : movements.length === 0 ? (
            <EmptyState title="No movements" />
          ) : (
            <ul className="divide-y">
              {movements.map((m: InventoryMovement) => (
                <li key={m.id} className="py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{m.productName}</span>
                    <span className={m.quantity >= 0 ? "text-success" : "text-destructive"}>{m.quantity > 0 ? "+" : ""}{m.quantity}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{m.type} · {m.reason} · {formatDate(m.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen} title="Stock adjustment">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Product</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select...</option>
              {productsQ.data?.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Quantity (positive add, negative remove)</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => adjustMut.mutate()} disabled={!productId || !reason || adjustMut.isPending}>Save</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
