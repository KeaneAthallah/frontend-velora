import { PageHeader, Card, Kpi, Table, Badge } from "@/components/ui";
import { products, idr } from "@/lib/data";
export default function Inventory() {
  const value = products.reduce((s, p) => s + p.cost * p.stock, 0);
  return (<>
    <PageHeader title="Inventory" sub="Stock on hand at Main outlet"><button className="btn">Stock count</button><button className="btn primary">Adjust stock</button></PageHeader>
    <div className="g4"><Kpi label="Stock value" value={idr(value)} /><Kpi label="Low stock" value={products.filter((p) => p.stock > 0 && p.stock < 10).length} /><Kpi label="Out of stock" value={products.filter((p) => !p.stock).length} /><Kpi label="Products tracked" value={products.length} /></div>
    <Card pad={false}><Table cols={["Product", "SKU", "On hand", "Value", "Status"]}
      rows={products.map((p) => [<b key="n">{p.name}</b>, p.sku, p.stock, idr(p.stock * p.cost), <Badge key="s">{p.stock === 0 ? "Out" : p.stock < 10 ? "Low" : "OK"}</Badge>])} /></Card>
  </>);
}
