import React from "react";

const P: Record<string, string> = {
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  cart: "M3 4h2l2.4 10.5h10L19.5 8H6.2M9 19.5h.01M17 19.5h.01",
  box: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5",
  inv: "M4 7l8-4 8 4v10l-8 4-8-4zM8 9.5h8M8 13h5",
  truck: "M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19h.01M17 19h.01",
  users: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.5a3.5 3.5 0 010 6.5M18 14.8c1.8.6 3 2.3 3.5 5.2",
  chart: "M5 20V11M12 20V4M19 20v-6",
  gear: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1.2-2-3.5-2.3.7-1.7-1L14.5 4h-4L10 7l-1.7 1-2.3-.7-2 3.5L5 12l-2 1.2 2 3.5 2.3-.7 1.7 1 .5 3h4l.5-3 1.7-1 2.3.7 2-3.5z",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  bell: "M6 17V11a6 6 0 1112 0v6l1.5 2h-15zM10 21h4",
};

export const Icon = ({ name, size = 18 }: { name: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name]} /></svg>
);

export const PageHeader = ({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) => (
  <div className="ph"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div><div className="row">{children}</div></div>
);

export const Card = ({ title, action, children, pad = true }: { title?: string; action?: React.ReactNode; children: React.ReactNode; pad?: boolean }) => (
  <section className="card">
    {title && <header className="ch"><h2>{title}</h2>{action}</header>}
    <div className={pad ? "cb" : ""}>{children}</div>
  </section>
);

export const Kpi = ({ label, value, delta }: { label: string; value: string | number; delta?: string }) => (
  <div className="card cb kpi"><span className="muted">{label}</span><strong>{value}</strong>{delta && <em className={delta.startsWith("-") ? "dn" : "up"}>{delta}</em>}</div>
);

const tone: Record<string, string> = { Paid: "ok", Received: "ok", Ordered: "info", Draft: "mute", Refunded: "bad", Low: "warn", Out: "bad", OK: "ok" };
export const Badge = ({ children }: { children: React.ReactNode }) => <span className={`badge ${tone[String(children)] || "mute"}`}>{children}</span>;

export const Table = ({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) => (
  <div className="scroll"><table className="tbl">
    <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
  </table></div>
);

export function LineChart({ data, labels }: { data: number[]; labels: string[] }) {
  const w = 600, h = 200, max = Math.max(...data) * 1.15;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (w - 20) + 10, h - 24 - (v / max) * (h - 40)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="Sales over the last 7 days">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="hsl(var(--chart-1))" stopOpacity=".22" /><stop offset="1" stopColor="hsl(var(--chart-1))" stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${pts[pts.length - 1][0]} ${h - 24} L${pts[0][0]} ${h - 24}Z`} fill="url(#g)" />
      <path d={d} fill="none" stroke="hsl(var(--chart-1))" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => <g key={i}><circle cx={p[0]} cy={p[1]} r="3.5" fill="hsl(var(--canvas))" stroke="hsl(var(--chart-1))" strokeWidth="2" /><text x={p[0]} y={h - 6} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">{labels[i]}</text></g>)}
    </svg>
  );
}

export const Bars = ({ data }: { data: [string, number][] }) => (
  <div className="bars">{data.map(([l, v]) => <div key={l} className="barrow"><span>{l}</span><div><i style={{ width: v + "%" }} /></div><b>{v}%</b></div>)}</div>
);
