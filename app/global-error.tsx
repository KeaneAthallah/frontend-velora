"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
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
    <html lang="en">
      <body>
        <main className="status-page">
          <div className="status-card">
            <span className="status-card__icon" aria-hidden="true">
              <AlertTriangle />
            </span>
            <p className="eyebrow">Something went wrong</p>
            <h1>Velora could not load.</h1>
            <p>
              The application hit an unexpected error. Try again. If the problem continues, contact your
              administrator.
            </p>
            {error.digest ? <p className="hint mono">Reference: {error.digest}</p> : null}
            <div className="status-card__actions">
              <button type="button" className="btn btn--primary" onClick={reset}>
                <RotateCcw aria-hidden="true" />
                Try again
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
