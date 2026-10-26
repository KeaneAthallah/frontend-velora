import { PageHeader, Card } from "@/components/ui";
const F = ({ label, v }) => <label className="field"><span>{label}</span><input defaultValue={v} /></label>;
export default function Settings() {
  return (<>
    <PageHeader title="Settings" sub="Business, tax and receipts"><button className="btn primary">Save changes</button></PageHeader>
    <div className="g2">
      <Card title="Business"><F label="Business name" v="Kopi Senja" /><F label="Outlet" v="Main outlet" /><F label="Address" v="Jl. Sudirman, Palu" /></Card>
      <Card title="Tax and receipts"><F label="Tax rate (%)" v="11" /><F label="Currency" v="IDR" /><F label="Receipt footer" v="Thank you for visiting!" /></Card>
    </div>
    <Card title="Team and access"><p className="muted">Invite cashiers and managers, and choose which pages each role can open.</p><button className="btn">Invite team member</button></Card>
  </>);
}
