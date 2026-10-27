"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { filterNavGroups } from "@/lib/navigation";
import { usePermissions } from "@/lib/auth/auth-context";
import { useTheme } from "@/components/providers/theme-provider";
import { OutletSwitcher } from "./outlet-switcher";

export function Sidebar({
  onNavigate,
  collapsed,
  onToggleCollapsed,
}: {
  onNavigate?: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const { has } = usePermissions();
  const { resolved } = useTheme();
  const groups = React.useMemo(() => filterNavGroups(has), [has]);
  const logo = resolved === "dark" ? "/brand/velora_app_icon_dark.png" : "/brand/velora_app_icon_light.png";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      className="sidebar"
      aria-label="Primary navigation"
      data-collapsed={collapsed}
      data-theme={
        collapsed ? "collapsed" : pathname.startsWith("/settings") ? "settings" : "workspace"
      }
    >
      <div className="sidebar__brand">
        <Link
          href="/"
          className="sidebar__brand"
          style={{ height: "auto", padding: 0, border: 0 }}
          onClick={onNavigate}
        >
          <Image
            src={logo}
            alt=""
            width={25}
            height={27}
            className="sidebar__logo"
            priority
          />
          <span className="sidebar__wordmark">Velora</span>
          <span className="sidebar__brand-meta">POS</span>
        </Link>
        <button
          type="button"
          className="icon-btn mobile-nav-close"
          onClick={onNavigate}
          aria-label="Close navigation"
          style={{ marginLeft: "auto", color: "hsl(var(--side-ink-2))" }}
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="sidebar__body">
        <nav aria-label="Workspace">
          {groups.map((group) => (
            <React.Fragment key={group.label}>
              <div className="sidebar__group">{group.label}</div>
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nav-item"
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={onNavigate}
                  >
                    <item.icon aria-hidden="true" />
                    <span className="nav-item__label">{item.label}</span>
                  </Link>
                );
              })}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="sidebar__foot">
        <OutletSwitcher />
        <button
          type="button"
          className="sidebar__collapse"
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ChevronsRight aria-hidden="true" /> : <ChevronsLeft aria-hidden="true" />}
          <span>{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      </div>
    </aside>
  );
}
