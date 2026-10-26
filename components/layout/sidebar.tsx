"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { navGroups } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  return (
    <aside className={cn("flex h-full flex-col border-r bg-card transition-all", collapsed ? "w-16" : "w-64")}>
      <div className="flex h-14 items-center justify-between border-b px-3">
        {!collapsed && <img src="/velora_primary_logo.png" alt="Velora" className="h-6" />}
        {collapsed && <img src="/velora_app_icon_light.png" alt="Velora" className="h-6 w-6 dark:hidden" />}
        {collapsed && <img src="/velora_app_icon_dark.png" alt="Velora" className="h-6 w-6 hidden dark:block" />}
        <Button variant="ghost" size="icon" onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      {!collapsed && (
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm" placeholder="Search..." />
          </div>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {navGroups.map((g) => (
          <div key={g.label} className="mb-4">
            {!collapsed && <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">{g.label}</div>}
            <ul className="space-y-1">
              {g.items.map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                      )}
                      title={collapsed ? it.label : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{it.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
