"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";
const nav = [["/", "Overview", "grid"], ["/sales", "Sales", "cart"], ["/products", "Products", "box"], ["/inventory", "Inventory", "inv"], ["/purchasing", "Purchasing", "truck"], ["/customers", "Customers", "users"], ["/reports", "Reports", "chart"], ["/settings", "Settings", "gear"]];
export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="side">
      <Link href="/" className="brand"><Image src="/brand/velora_app_icon_light.png" alt="" width={34} height={36} /><span>Velora</span></Link>
      <nav>{nav.map(([href, label, icon]) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        return <Link key={href} href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}><Icon name={icon} />{label}</Link>;
      })}</nav>
      <div className="outlet"><b>Kopi Senja</b><span>Palu, Main outlet</span></div>
    </aside>
  );
}
