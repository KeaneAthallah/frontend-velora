"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { bottomNavItems } from "@/lib/navigation";
import { usePermissions } from "@/lib/auth/auth-context";

export function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const { has } = usePermissions();
  const items = bottomNavItems.filter((item) => !item.permission || has(item.permission));

  return (
    <nav className="bottom-nav" aria-label="Quick navigation">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className="bottom-nav__item" aria-current={active ? "page" : undefined}>
            <item.icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button type="button" className="bottom-nav__item" onClick={onMore} aria-label="More navigation">
        <MoreHorizontal aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  );
}
