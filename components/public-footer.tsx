"use client";

import * as React from "react";
import Link from "next/link";

export function PublicFooter() {
  const [year, setYear] = React.useState<number | null>(null);

  // Next 16 refuses to statically prerender a component that reads the clock
  // ("Render in Browser"), so the copyright year is filled in after mount.
  React.useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <b>Velora</b>
        <span>
          <Link href="/login">Sign in</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/pricing">Pricing</Link>
          <span aria-hidden="true"> · </span>© {year ?? ""} Velora
        </span>
      </div>
    </footer>
  );
}
