import { PageHeader, Card, Table } from "@/components/ui";
import { customers, idr } from "@/lib/data";
export default function Customers() {
  return (<>
    <PageHeader title="Customers" sub={`${customers.length} customers in your loyalty list`}><button className="btn primary">Add customer</button></PageHeader>
    <Card pad={false}><Table cols={["Name", "Phone", "Visits", "Total spent", "Last visit"]}
      rows={customers.map((c) => [<b key="n">{c.name}</b>, c.phone, c.visits, idr(c.spent), c.last])} /></Card>
  </>);
}
