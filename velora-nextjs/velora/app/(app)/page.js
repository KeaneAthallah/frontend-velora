import Link from "next/link";
import { PageHeader, Card, Kpi, Table, Badge, LineChart, Bars } from "@/components/ui";
import { orders, products, sales7, days7, idr } from "@/lib/data";
export default function Overview() {
  const low = products.filter((p) => p.stock < 10);
  return (<>
    <PageHeader title="Overview" sub="Tuesday, 27 October · Main outlet"><Link className="btn primary" href="/sales">New sale</Link></PageHeader>
    <div className="g4">
      <Kpi label="Total sales" value={idr(12560000)} delta="+12% vs last week" />
      <Kpi label="Transactions" value="248" delta="+8%" />
      <Kpi label="Average order" value={idr(50650)} delta="+6%" />
      <Kpi label="Items low on stock" value={low.length} delta="-2 since Monday" />
    </div>
    <div className="g2">
      <Card title="Sales, last 7 days (million Rp)"><LineChart data={sales7} labels={days7} /></Card>
      <Card title="Payment methods"><Bars data={[["Cash", 38], ["QRIS", 44], ["Card", 18]]} /></Card>
    </div>
    <div className="g2">
      <Card title="Recent orders" pad={false} action={<Link href="/sales" className="link">Open sales</Link>}>
        <Table cols={["Order", "Time", "Customer", "Total", "Status"]} rows={orders.map((o) => [o.id, o.time, o.customer, idr(o.total), <Badge key="b">{o.status}</Badge>])} />
      </Card>
      <Card title="Needs restocking" pad={false} action={<Link href="/purchasing" className="link">Create purchase order</Link>}>
        <Table cols={["Product", "In stock"]} rows={low.map((p) => [p.name, p.stock])} />
      </Card>
    </div>
  </>);
}
