"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { filterNavGroups } from "@/lib/navigation";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";
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
  const { session } = useAuth();
  const { outlet } = useBusiness();
  const groups = React.useMemo(() => filterNavGroups(has), [has]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const initials = (session?.user.name ?? "User")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

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
        <Link href="/" className="sidebar__brand-link" onClick={onNavigate}>
          <Image
            src="/brand/velora_app_icon_dark.png"
            alt=""
            width={28}
            height={30}
            className="sidebar__logo"
            priority
          />
          <span className="sidebar__wordmark">Velora</span>
        </Link>
        <div className="sidebar__brand-actions">
          <button
            type="button"
            className="sidebar__collapse"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight aria-hidden="true" /> : <ChevronsLeft aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="icon-btn mobile-nav-close"
            onClick={onNavigate}
            aria-label="Close navigation"
            style={{ color: "hsl(var(--side-ink-2))" }}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="sidebar__context">
        <OutletSwitcher />
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
                    {item.count != null && (
                      <span className="nav-item__badge" aria-label={`${item.count} ${item.label.toLowerCase()}`}>
                        {item.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="sidebar__foot">
        <div className="sidebar__user">
          <span className="sidebar__user-avatar" aria-hidden="true">
            {initials || "V"}
          </span>
          <span className="sidebar__user-copy">
            <b>{session?.user.name ?? "Account"}</b>
            <span>{session?.user.email ?? outlet?.name ?? "No outlet"}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
