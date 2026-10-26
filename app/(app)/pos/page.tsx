"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listProducts, listCategories } from "@/lib/api/products";
import { listPaymentMethods } from "@/lib/api/business";
import { checkout } from "@/lib/api/sales";
import { formatCurrency } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusiness } from "@/lib/business/context";
import { useAuth } from "@/lib/auth/auth-context";
import { useToast } from "@/components/ui/toast";
import { Search, Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import type { CartItem, Product } from "@/lib/api/types";

const CART_KEY = "velora_pos_cart";

export default function POSPage() {
  const { outletId } = useBusiness();
  const { session } = useAuth();
  const { push } = useToast();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem(CART_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [cartDiscount, setCartDiscount] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  const productsQ = useQuery({
    queryKey: ["products", search, categoryId],
    queryFn: () => listProducts({ search: search || undefined, categoryId, pageSize: 50 }),
  });
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const paymentsQ = useQuery({ queryKey: ["payment-methods"], queryFn: listPaymentMethods });

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1, lineTotal: (next[idx].quantity + 1) * next[idx].unitPrice - next[idx].discount };
        return next;
      }
      return [...prev, { productId: p.id, name: p.name, sku: p.sku, unitPrice: p.price, quantity: 1, discount: 0, lineTotal: p.price }];
    });
  };

  const updateQty = (productId: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.productId === productId ? { ...c, quantity: Math.max(0, qty), lineTotal: Math.max(0, qty) * c.unitPrice - c.discount } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const removeItem = (productId: string) => setCart((prev) => prev.filter((c) => c.productId !== productId));

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const totalDiscount = cart.reduce((s, c) => s + c.discount, 0) + cartDiscount;
  const tax = Math.round((subtotal - totalDiscount) * 0.1);
  const total = subtotal - totalDiscount + tax;

  const checkoutMutation = useMutation({
    mutationFn: (vars: { key: string; paymentMethod?: string }) =>
      checkout({
        outletId: outletId!,
        cashierId: session!.user.id,
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity, discount: c.discount })),
        cartDiscount,
        notes: notes || undefined,
        idempotencyKey: vars.key,
        paymentMethod: vars.paymentMethod,
      }),
    onSuccess: (tx) => {
      push({ title: "Sale completed", description: tx.receiptNumber, variant: "success" });
      setCart([]);
      sessionStorage.removeItem(CART_KEY);
      setCheckoutOpen(false);
      setNotes("");
      setCartDiscount(0);
    },
    onError: (e) => {
      push({ title: "Checkout failed", description: (e as Error).message, variant: "error" });
    },
    onSettled: () => {
      submittedRef.current = false;
      setSubmitting(false);
    },
  });

  const handleCheckout = () => {
    if (submittedRef.current) return;
    if (cart.length === 0) return;
    if (!outletId || !session) return;
    submittedRef.current = true;
    setSubmitting(true);
    const key = `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const pm = paymentsQ.data?.find((p) => p.id === paymentMethod);
    checkoutMutation.mutate({ key, paymentMethod: pm?.type ?? pm?.name ?? paymentMethod });
  };

  const products = productsQ.data?.data ?? [];

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Product selection */}
      <div className="lg:col-span-2 flex flex-col gap-3 overflow-hidden">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search product or scan barcode..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value || undefined)}
          >
            <option value="">All categories</option>
            {categoriesQ.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {productsQ.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : products.length === 0 ? (
            <EmptyState title="No products" description="Try a different search." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {products.map((p) => {
                const stock = outletId ? p.stockByOutlet[outletId] ?? 0 : 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="rounded-lg border bg-card p-3 text-left transition hover:border-primary hover:shadow-sm"
                  >
                    <div className="font-medium text-sm line-clamp-2">{p.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{p.sku}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(p.price)}</span>
                      <Badge variant={stock < 10 ? "warning" : "secondary"}>{stock} in stock</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="flex flex-col rounded-lg border bg-card">
        <div className="border-b p-3">
          <div className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="h-4 w-4" /> Cart ({cart.length})
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <EmptyState title="Cart is empty" description="Tap a product to add." />
          ) : (
            cart.map((c) => (
              <div key={c.productId} className="rounded-md border p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(c.unitPrice)} each</div>
                  </div>
                  <button onClick={() => removeItem(c.productId)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" onClick={() => updateQty(c.productId, c.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <Input className="w-12 text-center" value={c.quantity} onChange={(e) => updateQty(c.productId, Number(e.target.value) || 0)} />
                    <Button variant="outline" size="icon" onClick={() => updateQty(c.productId, c.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(c.lineTotal)}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t p-3 space-y-2">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span>Discount</span><span className="tabular-nums">-{formatCurrency(totalDiscount)}</span></div>
          <div className="flex justify-between text-sm"><span>Tax (10%)</span><span className="tabular-nums">{formatCurrency(tax)}</span></div>
          <div className="flex justify-between text-base font-bold"><span>Total</span><span className="tabular-nums">{formatCurrency(total)}</span></div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Input placeholder="Customer (optional)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            <Input placeholder="Cart discount" type="number" value={cartDiscount} onChange={(e) => setCartDiscount(Number(e.target.value) || 0)} />
          </div>
          <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button className="w-full" size="lg" disabled={cart.length === 0 || submitting} onClick={() => setCheckoutOpen(true)}>
            Checkout
          </Button>
        </div>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen} title="Checkout" description={`Total ${formatCurrency(total)}`}>
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment method</label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">Select...</option>
              {paymentsQ.data?.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="text-xs text-muted-foreground">
            The final amount is confirmed by the server. Do not close until the transaction is confirmed.
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setCheckoutOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCheckout} disabled={!paymentMethod || submitting}>
              {submitting ? "Processing..." : "Confirm payment"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
