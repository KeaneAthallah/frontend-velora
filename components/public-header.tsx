"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/primitives";

export function PublicHeader() {
  const { theme, resolved, setTheme } = useTheme();
  const icon = resolved === "dark" ? "/brand/velora_app_icon_dark.png" : "/brand/velora_app_icon_light.png";

  return (
    <header className="ph">
      <div className="ph-wrap">
        <Link href="/landing" className="ph-brand">
          <Image src={icon} alt="" width={27} height={29} priority />
          <span>Velora</span>
        </Link>

        <nav className="ph-links">
          <a href="#features">Features</a>
          <a href="#start">How it works</a>
        </nav>

        <div className="ph-actions">
          <IconButton label={`Theme: ${theme}`} onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}>
            {resolved === "dark" ? <Moon aria-hidden="true" /> : theme === "system" ? <Monitor aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </IconButton>
          <Link href="/login">
            <Button variant="quiet" size="sm">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button size="sm" variant="primary">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}
