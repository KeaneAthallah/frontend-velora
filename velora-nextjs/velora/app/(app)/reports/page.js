import { PageHeader, Card, Table, LineChart, Bars } from "@/components/ui";
import { sales7, days7, products, idr } from "@/lib/data";
export default function Reports() {
  const top = [...products].sort((a, b) => b.price * b.stock - a.price * a.stock).slice(0, 5);
  return (<>
    <PageHeader title="Reports" sub="Last 7 days"><button className="btn">Last 7 days</button><button className="btn primary">Export CSV</button></PageHeader>
    <div className="g2">
      <Card title="Daily sales (million Rp)"><LineChart data={sales7} labels={days7} /></Card>
      <Card title="Sales by category"><Bars data={[["Coffee", 56], ["Food", 22], ["Non-coffee", 14], ["Snacks", 8]]} /></Card>
    </div>
    <Card title="Best sellers" pad={false}><Table cols={["Product", "Category", "Price"]} rows={top.map((p) => [<b key="n">{p.name}</b>, p.cat, idr(p.price)])} /></Card>
  </>);
}
