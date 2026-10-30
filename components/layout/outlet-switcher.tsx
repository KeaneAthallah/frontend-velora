"use client";

import * as React from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { DropdownMenu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/primitives";
import { useBusiness } from "@/lib/business/context";
import { useAuth } from "@/lib/auth/auth-context";

export function OutletSwitcher({ compact = false }: { compact?: boolean }) {
  const { outlets, outletId, outlet, setOutletId, loading } = useBusiness();
  const { session } = useAuth();

  if (!session) return null;

  const trigger = compact ? (
    <button type="button" className="topbar__user" aria-label="Switch outlet">
      <Building2 aria-hidden="true" />
      <span>{outlet?.name ?? "Outlet"}</span>
      <ChevronsUpDown aria-hidden="true" style={{ width: 12, height: 12 }} />
    </button>
  ) : (
    <button
      type="button"
      className="sidebar__outlet org-switcher"
      aria-label="Switch outlet"
      title={outlet?.name ?? "Outlet"}
    >
      <span className="sidebar__outlet-copy" style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <b>{session.business.name}</b>
        <span style={{ fontSize: 11, color: "#A9A4CF", fontWeight: 500 }}>
          {outlet?.name ?? (loading ? "Loading outlet…" : "No outlet")}
        </span>
      </span>
      <ChevronsUpDown
        aria-hidden="true"
        style={{ width: 14, height: 14, marginLeft: "auto", flexShrink: 0, color: "#A9A4CF" }}
      />
    </button>
  );

  if (outlets.length <= 1) {
    return trigger;
  }

  return (
    <DropdownMenu
      trigger={trigger}
      width={250}
      label="Switch outlet"
      align={compact ? "end" : "start"}
    >
      <MenuLabel>Outlet</MenuLabel>
      {outlets.map((item) => (
        <MenuItem
          key={item.id}
          icon={<Building2 aria-hidden="true" />}
          selected={item.id === outletId}
          onSelect={() => {
            if (item.id !== outletId) setOutletId(item.id);
          }}
        >
          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
          {item.code ? (
            <small style={{ display: "block", color: "hsl(var(--ink-3))", fontSize: 10 }}>
              {item.code}
              {item.address ? ` · ${item.address}` : ""}
            </small>
          ) : null}
        </MenuItem>
      ))}
      <MenuSeparator />
      <div className="cmdk__hint" style={{ padding: "2px 9px 6px" }}>
        Sales and stock are scoped to the selected outlet.
      </div>
    </DropdownMenu>
  );
}

export function OutletBadge() {
  const { outlet } = useBusiness();
  if (!outlet) return null;
  return (
    <span className="badge badge--neutral">
      <Check aria-hidden="true" style={{ width: 11, height: 11 }} />
      {outlet.name}
    </span>
  );
}
