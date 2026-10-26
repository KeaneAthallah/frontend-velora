import Sidebar from "@/components/Sidebar";
import { Icon } from "@/components/ui";
export default function AppLayout({ children }) {
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <header className="top">
          <label className="search"><Icon name="search" size={16} /><input placeholder="Search products, orders, customers" aria-label="Search" /></label>
          <button className="icon" aria-label="Notifications"><Icon name="bell" /></button>
          <div className="me"><span>RK</span><div><b>Rina Kusuma</b><small>Owner</small></div></div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
