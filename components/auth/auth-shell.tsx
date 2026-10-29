"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Monitor, Moon, Sun } from "lucide-react";
import { IconButton } from "@/components/ui/primitives";
import { useTheme } from "@/components/providers/theme-provider";

const points = [
  {
    title: "One operating picture",
    body: "Sales, stock, purchasing, customers, and reports share the same records.",
  },
  {
    title: "Numbers you can trace",
    body: "Every figure comes from a recorded transaction, product, or stock movement.",
  },
  {
    title: "Access that fits the role",
    body: "People see the tools and locations their permissions allow.",
  },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { theme, resolved, setTheme } = useTheme();
  const ThemeIcon = resolved === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  const icon = resolved === "dark" ? "/brand/velora_app_icon_dark.png" : "/brand/velora_app_icon_light.png";

  return (
    <div className="auth">
      <aside className="auth__aside">
        <Link href="/" className="auth__brand" aria-label="Velora home">
          <Image src={icon} alt="" width={27} height={29} priority />
          <span>Velora</span>
        </Link>

        <div className="auth__pitch">
          <span className="eyebrow" style={{ color: "hsl(252 81% 76%)" }}>
            Retail operations
          </span>
          <div className="auth__pitch-heading">
            Smarter business.
            <br />
            <em>Easier sales.</em>
          </div>
          <p>
            A calm workspace for the people running the store: fast checkout, honest stock, and
            reporting that reads like the business, not a spreadsheet.
          </p>
          <div className="auth__points">
            {points.map((point) => (
              <div key={point.title} className="auth__point">
                <CheckCircle2 aria-hidden="true" />
                <span>
                  <b>{point.title}.</b> {point.body}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="auth__foot">
          <span>Velora · Point of sale</span>
          <span aria-hidden="true"> · </span>
          <span>Built for independent retail</span>
        </div>
      </aside>

      <section className="auth__main">
        <div className="auth__top">
          <Link href="/" className="auth__mobile-logo">
            <Image src={icon} alt="" width={24} height={26} priority />
            <span>Velora</span>
          </Link>
          <IconButton
            label={`Theme: ${theme}`}
            onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}
            style={{ marginLeft: "auto" }}
          >
            <ThemeIcon aria-hidden="true" />
          </IconButton>
        </div>
        <div className="auth__form-wrap">{children}</div>
      </section>
    </div>
  );
}
