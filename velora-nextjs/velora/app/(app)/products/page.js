import { PageHeader, Card, Table, Badge } from "@/components/ui";
import { products, idr } from "@/lib/data";
export default function Products() {
  return (<>
    <PageHeader title="Products" sub={`${products.length} products across 4 categories`}><button className="btn">Import</button><button className="btn primary">Add product</button></PageHeader>
    <Card pad={false}><Table cols={["Product", "SKU", "Category", "Price", "Cost", "Margin", "Stock"]}
      rows={products.map((p) => [<b key="n">{p.name}</b>, p.sku, p.cat, idr(p.price), idr(p.cost), Math.round((1 - p.cost / p.price) * 100) + "%", <Badge key="s">{p.stock === 0 ? "Out" : p.stock < 10 ? "Low" : "OK"}</Badge>])} /></Card>
  </>);
}
