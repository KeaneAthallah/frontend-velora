"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="status-inline">
      <div className="status-card">
        <span className="status-card__icon" aria-hidden="true">
          <AlertTriangle />
        </span>
        <p className="eyebrow">Something went wrong</p>
        <h1>This page could not finish loading.</h1>
        <p>
          The rest of the workspace is unaffected. Try again, or return to a stable page. If it keeps happening,
          send this reference to your administrator.
        </p>
        {error.digest ? <p className="hint mono">Reference: {error.digest}</p> : null}
        <div className="status-card__actions">
          <button type="button" className="btn btn--primary" onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Try again
          </button>
          <Link href="/" className="btn btn--secondary">
            Go to overview
          </Link>
        </div>
      </div>
    </div>
  );
}
