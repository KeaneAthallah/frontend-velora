"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, Sun, Moon, Monitor } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/lib/auth/auth-context";
import { useTheme } from "@/components/providers/theme-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;
  if (!session) return null;

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <header className="top">
          <label className="search">
            <Search size={15} />
            <input placeholder="Search products, orders, customers" aria-label="Search" />
          </label>
          <button className="icon-btn" aria-label="Notifications" type="button">
            <Bell size={17} />
          </button>
          <button className="icon-btn" aria-label="Toggle theme" type="button" onClick={cycleTheme} title={`Theme: ${theme}`}>
            <ThemeIcon size={17} />
          </button>
          <div className="me">
            <span>{session.user.name.charAt(0).toUpperCase()}</span>
            <div><b>{session.user.name}</b><small>{session.business?.name ?? "Owner"}</small></div>
          </div>
        </header>
        <main className="page fade-in">{children}</main>
      </div>
    </div>
  );
}