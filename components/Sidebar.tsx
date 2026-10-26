"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, Package, Boxes, Truck, Users, BarChart3, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/products", label: "Products", icon: Package },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/purchasing", label: "Purchasing", icon: Truck },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  const { session } = useAuth();
  return (
    <aside className="side">
      <Link href="/" className="brand">
        <Image src="/brand/velora_app_icon_light.png" alt="" width={30} height={32} priority />
        <span>Velora</span>
      </Link>
      <nav aria-label="Primary">
        {nav.map(({ href, label, icon: Icon }) => {
          const on = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
              <Icon size={17} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="outlet">
        <b>{session?.business?.name ?? "Velora Coffee"}</b>
        <span>{session?.outlet?.name ?? "Main outlet"}</span>
      </div>
    </aside>
  );
}