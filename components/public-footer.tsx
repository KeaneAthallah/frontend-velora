"use client";

import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <b>Velora</b>
        <span>
          <Link href="/login">Sign in</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/pricing">Pricing</Link>
          <span aria-hidden="true"> · </span>© {new Date().getFullYear()} Velora
        </span>
      </div>
    </footer>
  );
}
