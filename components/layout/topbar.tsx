"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Moon, Sun, ChevronDown, Menu } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { useAuth } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";
import { Button } from "@/components/ui/button";

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const pathname = usePathname();
  const { theme, setTheme, resolved } = useTheme();
  const { session, signOut } = useAuth();
  const { outlets, outletId, setOutletId } = useBusiness();
  const [userOpen, setUserOpen] = useState(false);

  const title = pathname.split("/").filter(Boolean).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" / ") || "Dashboard";

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Menu">
        <Menu className="h-4 w-4" />
      </Button>
      <div className="flex-1">
        <h1 className="text-sm font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {outlets.length > 0 && (
          <select
            value={outletId ?? ""}
            onChange={(e) => setOutletId(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            aria-label="Outlet"
          >
            {outlets.map((o: { id: string; name: string }) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")} aria-label="Toggle theme">
          {resolved === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
        <div className="relative">
          <button
            onClick={() => setUserOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
          >
            <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">
              {session?.user.name.charAt(0) ?? "U"}
            </div>
            <span className="hidden text-sm md:inline">{session?.user.name ?? "Guest"}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {userOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border bg-card p-1 shadow-lg">
              <button
                onClick={() => { setUserOpen(false); signOut(); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
