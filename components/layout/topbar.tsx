"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { Avatar, DropdownMenu, IconButton, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/primitives";
import { useTheme } from "@/components/providers/theme-provider";
import { useAuth } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";
import { navTrail } from "@/lib/navigation";
import { OutletSwitcher } from "./outlet-switcher";

export function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: (viaKeyboard?: boolean) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, resolved, setTheme } = useTheme();
  const { session, signOut } = useAuth();
  const { outlet } = useBusiness();
  const trail = React.useMemo(() => navTrail(pathname), [pathname]);

  const ThemeIcon = resolved === "dark" ? Moon : Sun;

  return (
    <header className="topbar">
      <IconButton label="Open navigation" className="topbar__menu" onClick={onMenu}>
        <Menu aria-hidden="true" />
      </IconButton>

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/" className="crumbs__root">
          {session?.business.name ?? "Velora"}
        </Link>
        {trail.map((crumb, index) => (
          <React.Fragment key={`${crumb.label}-${index}`}>
            {(index > 0 || session?.business.name) && <ChevronRight aria-hidden="true" className="crumbs__sep" />}
            {crumb.href ? (
              <Link href={crumb.href}>{crumb.label}</Link>
            ) : (
              <span aria-current="page" className="crumbs__current">
                {crumb.label}
              </span>
            )}
          </React.Fragment>
        ))}
        {outlet ? (
          <span className="badge badge--neutral hide-mobile" style={{ marginLeft: 6 }}>
            {outlet.name}
          </span>
        ) : null}
      </nav>

      <button
        type="button"
        className="topbar__search"
        aria-label="Search workspace"
        onClick={() => onSearch(false)}
      >
        <Search aria-hidden="true" />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="topbar__actions">
        <div className="hide-mobile">
          <OutletSwitcher compact />
        </div>

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

        <div className="topbar__divider" aria-hidden="true" />

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
      </div>
    </header>
  );
}
