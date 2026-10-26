"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listProducts, createProduct, updateProduct, listCategories } from "@/lib/api/products";
import { formatCurrency } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.number().min(0),
  cost: z.number().min(0),
  categoryId: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export default function ProductsPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string; sku: string; price: number; cost: number; categoryId: string } | null>(null);
  const [open, setOpen] = useState(false);

  const productsQ = useQuery({ queryKey: ["products", search], queryFn: () => listProducts({ search: search || undefined, pageSize: 50 }) });
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMut = useMutation({
    mutationFn: (v: FormValues) => {
      const cat = categoriesQ.data?.find((c) => c.id === v.categoryId);
      return createProduct({ name: v.name, sku: v.sku, price: v.price, cost: v.cost, categoryId: v.categoryId, categoryName: cat?.name ?? "" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); push({ title: "Product created", variant: "success" }); setOpen(false); reset(); },
    onError: (e) => push({ title: "Failed", description: (e as Error).message, variant: "error" }),
  });

  const updateMut = useMutation({
    mutationFn: (v: FormValues) => updateProduct(editing!.id, { name: v.name, sku: v.sku, price: v.price, cost: v.cost, categoryId: v.categoryId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); push({ title: "Product updated", variant: "success" }); setOpen(false); setEditing(null); reset(); },
    onError: (e) => push({ title: "Failed", description: (e as Error).message, variant: "error" }),
  });

  const openCreate = () => { setEditing(null); reset(); setOpen(true); };
  const openEdit = (p: { id: string; name: string; sku: string; price: number; cost: number; categoryId: string }) => { setEditing(p); reset({ name: p.name, sku: p.sku, price: p.price, cost: p.cost, categoryId: p.categoryId }); setOpen(true); };

  const onSubmit = (v: FormValues) => (editing ? updateMut.mutate(v) : createMut.mutate(v));

  const products = productsQ.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input className="max-w-sm" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New product</Button>
      </div>

      {productsQ.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : products.length === 0 ? (
        <EmptyState title="No products" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-medium">Name</th>
                  <th className="p-3 text-left font-medium">SKU</th>
                  <th className="p-3 text-left font-medium">Category</th>
                  <th className="p-3 text-right font-medium">Price</th>
                  <th className="p-3 text-right font-medium">Cost</th>
                  <th className="p-3 text-right font-medium">Stock (o1)</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-muted-foreground">{p.sku}</td>
                    <td className="p-3">{p.categoryName}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(p.price)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(p.cost)}</td>
                    <td className="p-3 text-right tabular-nums">{p.stockByOutlet?.o1 ?? 0}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen} title={editing ? "Edit product" : "New product"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>SKU</Label>
            <Input {...register("sku")} />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Price</Label>
              <Input type="number" {...register("price", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <Label>Cost</Label>
              <Input type="number" {...register("cost", { valueAsNumber: true })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" {...register("categoryId")}>
              <option value="">Select...</option>
              {categoriesQ.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
