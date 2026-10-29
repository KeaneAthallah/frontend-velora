"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChefHat,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PackageSearch,
  Receipt,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { Avatar, DropdownMenu, IconButton, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/primitives";
import { useTheme } from "@/components/providers/theme-provider";
import { useAuth } from "@/lib/auth/auth-context";
import { useOffline } from "@/lib/offline/provider";
import { formatRelative } from "@/lib/formatting/currency";
import { OutletSwitcher } from "./outlet-switcher";

export function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: (viaKeyboard?: boolean) => void }) {
  const router = useRouter();
  const { theme, resolved, setTheme } = useTheme();
  const { session, signOut } = useAuth();
  const { online, pending, failed, lastSyncedAt } = useOffline();

  const ThemeIcon = resolved === "dark" ? Moon : Sun;
  const attention = pending + failed;

  const onlineLabel = online
    ? lastSyncedAt
      ? `Online · synced ${formatRelative(lastSyncedAt)}`
      : "Online"
    : attention > 0
      ? `Offline · ${attention} queued`
      : "Offline";

  return (
    <header className="topbar">
      <IconButton label="Open navigation" className="topbar__menu" onClick={onMenu}>
        <Menu aria-hidden="true" />
      </IconButton>

      <button
        type="button"
        className="topbar__search"
        aria-label="Search workspace"
        onClick={() => onSearch(false)}
      >
        <Search aria-hidden="true" />
        <span>Search or jump to…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="topbar__spacer" />

      <span className="topbar__online hide-mobile" data-offline={online ? undefined : "true"}>
        {onlineLabel}
      </span>

      <div className="hide-mobile">
        <OutletSwitcher compact />
      </div>

      <DropdownMenu
        trigger={
          <IconButton label="Notifications" aria-haspopup="menu" className="topbar__notify">
            <Bell aria-hidden="true" />
            {attention > 0 ? <i className="topbar__notify-dot" aria-hidden="true" /> : null}
          </IconButton>
        }
        width={230}
        label="Notifications"
      >
        <MenuLabel>Needs attention</MenuLabel>
        <MenuItem icon={<ChefHat aria-hidden="true" />} onSelect={() => router.push("/kitchen")}>
          Kitchen tickets
        </MenuItem>
        <MenuItem icon={<Receipt aria-hidden="true" />} onSelect={() => router.push("/orders")}>
          Open orders
        </MenuItem>
        <MenuItem icon={<PackageSearch aria-hidden="true" />} onSelect={() => router.push("/inventory")}>
          Low stock
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Settings aria-hidden="true" />} onSelect={() => router.push("/settings?section=payments")}>
          Notification settings
        </MenuItem>
      </DropdownMenu>

      <DropdownMenu
        trigger={
          <IconButton label={`Theme: ${theme}`} aria-haspopup="menu">
            <ThemeIcon aria-hidden="true" />
          </IconButton>
        }
        width={180}
        label="Theme"
      >
        <MenuLabel>Appearance</MenuLabel>
        <MenuItem icon={<Sun aria-hidden="true" />} selected={theme === "light"} onSelect={() => setTheme("light")}>
          Light
        </MenuItem>
        <MenuItem icon={<Moon aria-hidden="true" />} selected={theme === "dark"} onSelect={() => setTheme("dark")}>
          Dark
        </MenuItem>
        <MenuItem
          icon={<Monitor aria-hidden="true" />}
          selected={theme === "system"}
          onSelect={() => setTheme("system")}
        >
          Match system
        </MenuItem>
      </DropdownMenu>

      <div className="topbar__divider hide-mobile" aria-hidden="true" />

      <DropdownMenu
        trigger={
          <button type="button" className="topbar__user" aria-label="Account menu">
            <Avatar name={session?.user.name ?? "User"} size={26} />
            <span className="topbar__user-meta">
              <span>{session?.user.name ?? "Account"}</span>
              <small>{session?.user.email}</small>
            </span>
          </button>
        }
        width={230}
        label="Account"
      >
        <MenuLabel>{session?.business.name ?? "Workspace"}</MenuLabel>
        <MenuItem icon={<Settings aria-hidden="true" />} onSelect={() => router.push("/settings")}>
          Settings
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<LogOut aria-hidden="true" />}
          danger
          onSelect={async () => {
            await signOut();
            router.replace("/login");
          }}
        >
          Sign out
        </MenuItem>
      </DropdownMenu>
    </header>
  );
}
