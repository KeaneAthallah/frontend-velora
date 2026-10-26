"use client";
import { useState } from "react";
import { PageHeader, Icon } from "@/components/ui";
import { products, categories, idr } from "@/lib/data";
const TAX = 0.11;
export default function Sales() {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState({});
  const [paid, setPaid] = useState(false);
  const list = products.filter((p) => (cat === "All" || p.cat === cat) && p.name.toLowerCase().includes(q.toLowerCase()));
  const lines = products.filter((p) => cart[p.id]);
  const sub = lines.reduce((s, p) => s + p.price * cart[p.id], 0);
  const count = lines.reduce((s, p) => s + cart[p.id], 0);
  const add = (p, d) => { setPaid(false); setCart((c) => { const n = (c[p.id] || 0) + d; const x = { ...c }; n > 0 ? (x[p.id] = n) : delete x[p.id]; return x; }); };
  return (<>
    <PageHeader title="New sale" sub="Tap a product to add it to the order." />
    <div className="pos">
      <div>
        <div className="row wrap">
          <label className="search grow"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" /></label>
          <div className="chips" role="tablist">{categories.map((c) => <button key={c} className={"chip" + (c === cat ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}</div>
        </div>
        <div className="tiles">{list.map((p) => (
          <button key={p.id} className="tile" disabled={p.stock === 0} onClick={() => add(p, 1)}>
            <span className="mono">{p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
            <b>{p.name}</b><span>{idr(p.price)}</span>
            <small className={p.stock < 10 ? "warn" : "muted"}>{p.stock === 0 ? "Out of stock" : `${p.stock} left`}</small>
          </button>))}
          {list.length === 0 && <p className="muted">No products match. Try another category or clear the search.</p>}
        </div>
      </div>
      <aside className="card cart">
        <header className="ch"><h2>Current order</h2>{count > 0 && <button className="link" onClick={() => setCart({})}>Clear</button>}</header>
        <div className="lines">
          {lines.length === 0 && <p className="muted pad">{paid ? "Payment received. Start the next order." : "No items yet. Add a product to begin."}</p>}
          {lines.map((p) => (
            <div key={p.id} className="line"><div><b>{p.name}</b><small className="muted">{idr(p.price)}</small></div>
              <div className="qty"><button aria-label={`Remove one ${p.name}`} onClick={() => add(p, -1)}><Icon name="minus" size={14} /></button><span>{cart[p.id]}</span><button aria-label={`Add one ${p.name}`} onClick={() => add(p, 1)}><Icon name="plus" size={14} /></button></div>
            </div>))}
        </div>
        <dl className="sum"><div><dt>Subtotal</dt><dd>{idr(sub)}</dd></div><div><dt>Tax (11%)</dt><dd>{idr(Math.round(sub * TAX))}</dd></div><div className="tot"><dt>Total, {count} items</dt><dd>{idr(Math.round(sub * (1 + TAX)))}</dd></div></dl>
        <button className="btn primary block" disabled={!count} onClick={() => { setCart({}); setPaid(true); }}>Charge {idr(Math.round(sub * (1 + TAX)))}</button>
      </aside>
    </div>
  </>);
}
