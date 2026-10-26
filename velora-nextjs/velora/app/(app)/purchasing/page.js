import { PageHeader, Card, Table, Badge } from "@/components/ui";
import { purchaseOrders, idr } from "@/lib/data";
export default function Purchasing() {
  return (<>
    <PageHeader title="Purchasing" sub="Purchase orders and suppliers"><button className="btn">Suppliers</button><button className="btn primary">Create purchase order</button></PageHeader>
    <Card pad={false}><Table cols={["Order", "Supplier", "Items", "Total", "Date", "Status"]}
      rows={purchaseOrders.map((o) => [<b key="i">{o.id}</b>, o.supplier, o.items, idr(o.total), o.date, <Badge key="s">{o.status}</Badge>])} /></Card>
  </>);
}
