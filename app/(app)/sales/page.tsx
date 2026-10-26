"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader, Icon } from "@/components/ui";
import { listProducts, listCategories } from "@/lib/api/products";
import { listPaymentMethods } from "@/lib/api/business";
import { checkout } from "@/lib/api/sales";
import { formatCurrency } from "@/lib/formatting/currency";
import { useBusiness } from "@/lib/business/context";
import { useAuth } from "@/lib/auth/auth-context";
import { useToast } from "@/components/ui/toast";

const TAX = 0.11;
const CART_KEY = "velora_pos_cart";

export default function SalesPage() {
  const { outletId } = useBusiness();
  const { session } = useAuth();
  const { push } = useToast();
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(sessionStorage.getItem(CART_KEY) || "{}"); } catch { return {}; }
  });
  const [paid, setPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => { try { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} }, [cart]);

  const productsQ = useQuery({ queryKey: ["products", q, cat], queryFn: () => listProducts({ search: q || undefined, pageSize: 100 }) });
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const paymentsQ = useQuery({ queryKey: ["payment-methods"], queryFn: listPaymentMethods });

  const products = (productsQ.data?.data ?? []).map((p) => ({ ...p, cat: p.categoryName }));
  const categories = ["All", ...(categoriesQ.data?.map((c) => c.name) ?? [])];
  const list = products.filter((p) => (cat === "All" || p.cat === cat) && p.name.toLowerCase().includes(q.toLowerCase()));
  const lines = products.filter((p) => cart[p.id]);
  const sub = lines.reduce((s, p) => s + p.price * (cart[p.id] ?? 0), 0);
  const count = lines.reduce((s, p) => s + (cart[p.id] ?? 0), 0);

  const add = (p: { id: string }, d: number) => {
    setPaid(false);
    setCart((c) => {
      const n = (c[p.id] || 0) + d;
      const x = { ...c };
      if (n > 0) x[p.id] = n; else delete x[p.id];
      return x;
    });
  };

  const checkoutMutation = useMutation({
    mutationFn: (vars: { key: string; paymentMethod?: string }) =>
      checkout({ outletId: outletId!, cashierId: session!.user.id, items: lines.map((p) => ({ productId: p.id, quantity: cart[p.id] ?? 0 })), idempotencyKey: vars.key, paymentMethod: vars.paymentMethod }),
    onSuccess: (tx) => {
      push({ title: "Sale completed", description: tx.receiptNumber, variant: "success" });
      setCart({}); sessionStorage.removeItem(CART_KEY); setPaid(true);
    },
    onError: (e) => push({ title: "Checkout failed", description: (e as Error).message, variant: "error" }),
    onSettled: () => { submittedRef.current = false; setSubmitting(false); },
  });

  const handleCharge = () => {
    if (submittedRef.current || !count || !outletId || !session) return;
    submittedRef.current = true; setSubmitting(true);
    const key = `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const pm = paymentsQ.data?.find((p) => p.id === paymentMethod);
    checkoutMutation.mutate({ key, paymentMethod: pm?.type ?? pm?.name ?? paymentMethod });
  };

  return (
    <>
      <PageHeader title="New sale" sub="Tap a product to add it to the order." />
      <div className="pos">
        <div>
          <div className="row wrap">
            <label className="search grow"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" /></label>
            <div className="chips" role="tablist">{categories.map((c) => <button key={c} className={"chip" + (c === cat ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}</div>
          </div>
          <div className="tiles">{list.map((p) => (
            <button key={p.id} className="tile" disabled={p.stockByOutlet?.[outletId ?? ""] === 0} onClick={() => add(p, 1)}>
              <span className="mono">{p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
              <b>{p.name}</b><span>{formatCurrency(p.price)}</span>
              <small className={(p.stockByOutlet?.[outletId ?? ""] ?? 0) < 10 ? "warn" : "muted"}>{(p.stockByOutlet?.[outletId ?? ""] ?? 0) === 0 ? "Out of stock" : `${p.stockByOutlet?.[outletId ?? ""] ?? 0} left`}</small>
            </button>))}
            {list.length === 0 && <p className="muted">No products match. Try another category or clear the search.</p>}
          </div>
        </div>
        <aside className="card cart">
          <header className="ch"><h2>Current order</h2>{count > 0 && <button className="link" onClick={() => setCart({})}>Clear</button>}</header>
          <div className="lines">
            {lines.length === 0 && <p className="muted pad">{paid ? "Payment received. Start the next order." : "No items yet. Add a product to begin."}</p>}
            {lines.map((p) => (
              <div key={p.id} className="line"><div><b>{p.name}</b><small className="muted">{formatCurrency(p.price)}</small></div>
                <div className="qty"><button aria-label={`Remove one ${p.name}`} onClick={() => add(p, -1)}><Icon name="minus" size={14} /></button><span>{cart[p.id]}</span><button aria-label={`Add one ${p.name}`} onClick={() => add(p, 1)}><Icon name="plus" size={14} /></button></div>
              </div>))}
          </div>
          <dl className="sum"><div><dt>Subtotal</dt><dd>{formatCurrency(sub)}</dd></div><div><dt>Tax (11%)</dt><dd>{formatCurrency(Math.round(sub * TAX))}</dd></div><div className="tot"><dt>Total, {count} items</dt><dd>{formatCurrency(Math.round(sub * (1 + TAX)))}</dd></div></dl>
          <div className="pad">
            <select className="field" style={{ marginBottom: 8 }} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">Payment method…</option>
              {paymentsQ.data?.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button className="btn primary block" disabled={!count || submitting} onClick={handleCharge}>{submitting ? "Processing…" : `Charge ${formatCurrency(Math.round(sub * (1 + TAX)))}`}</button>
        </aside>
      </div>
    </>
  );
}
