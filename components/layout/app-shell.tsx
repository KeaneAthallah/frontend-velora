"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";
import { defaultRoute } from "@/lib/navigation";
import { useSubscription } from "@/lib/subscription/context";
import { SubscriptionNotice, TrialBanner } from "@/components/subscription/trial-banner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomNav } from "./bottom-nav";
import { CommandPalette } from "./command-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const { has } = usePermissions();
  const { outlets, outletsChecked, outletsLoaded } = useBusiness();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchInstant, setSearchInstant] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const mobileNavOpenRef = React.useRef(false);
  const sub = useSubscription();

  React.useEffect(() => {
    mobileNavOpenRef.current = mobileNavOpen;
  }, [mobileNavOpen]);

  React.useEffect(() => {
    if (loading || session) return;
    // The root route is the public front door: signed-out visitors get the
    // landing page, while every other app route sends them to sign in.
    if (pathname === "/") {
      router.replace("/landing");
      return;
    }
    const next = encodeURIComponent(pathname || "/");
    router.replace(`/login?next=${next}`);
  }, [loading, session, router, pathname]);

  React.useEffect(() => {
    if (loading || !session) return;
    // Accounts without a business cannot load tenant data; finish setup first.
    if (!session.business.id) {
      router.replace("/onboarding");
      return;
    }
    // So can accounts whose business has no outlet yet: every screen is
    // outlet-scoped, so an outlet-less workspace would only render empty.
    if (outletsLoaded && outlets.length === 0) {
      router.replace("/onboarding");
      return;
    }
    if (pathname === "/" && !has("reports.view")) {
      const next = defaultRoute(has);
      if (next !== "/") router.replace(next);
    }
  }, [loading, session, outlets, outletsLoaded, pathname, has, router]);

  React.useEffect(() => {
    if (!mobileNavOpenRef.current) return;
    setMobileNavOpen(false);
    const timer = window.setTimeout(() => document.getElementById("main")?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("velora_sidebar_collapsed") === "true");
    } catch {}
  }, []);

  React.useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    const focusTimer = window.setTimeout(() => {
      sidebar?.querySelector<HTMLButtonElement>(".mobile-nav-close")?.focus();
    }, 30);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileNavOpen(false);
        document.querySelector<HTMLButtonElement>(".topbar__menu")?.focus();
        return;
      }
      if (event.key !== "Tab" || !sidebar) return;
      const nodes = Array.from(
        sidebar.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchInstant(true);
        setSearchOpen((value) => !value);
        return;
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        setSearchInstant(true);
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem("velora_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  if (loading || (session?.business.id && !outletsChecked)) {
    return (
      <div className="boot" role="status" aria-label="Loading workspace">
        <Loader2 className="animate-spin" aria-hidden="true" />
        <span>Opening your workspace…</span>
      </div>
    );
  }

  if (!session) return null;

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchInstant(false);
  };

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div
        className="app"
        data-mobile-nav={mobileNavOpen ? "open" : undefined}
        data-collapsed={collapsed ? "true" : undefined}
        onClick={(event) => {
          if (mobileNavOpen && event.target === event.currentTarget) setMobileNavOpen(false);
        }}
      >
        <Sidebar
          onNavigate={() => setMobileNavOpen(false)}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        <div className="main">
          <Topbar
            onMenu={() => setMobileNavOpen(true)}
            onSearch={(viaKeyboard = false) => {
              setSearchInstant(viaKeyboard);
              setSearchOpen(true);
            }}
          />
          {/* Trial and subscription notices — always visible but dismissible */}
          {!session?.subscription?.isActive && sub.data ? (
            <SubscriptionNotice status={sub.subscription.status} />
          ) : sub.trialDaysRemaining > 0 && !sub.plan?.isTrial && session?.subscription?.trialReminders ? (
            <TrialBanner
              daysRemaining={sub.subscription.trialDaysRemaining}
              trialEndsAt={sub.subscription.trialEndsAt}
              trialReminders={session.subscription.trialReminders}
            />
          ) : null}
          <main id="main" className={pathname === "/sales" ? "page page--wide" : "page"} tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      <BottomNav onMore={() => setMobileNavOpen(true)} />
      <CommandPalette open={searchOpen} onClose={closeSearch} instant={searchInstant} />
    </>
  );
}
