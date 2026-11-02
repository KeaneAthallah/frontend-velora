"use client";

import * as React from "react";
import { Alert, Button } from "@/components/ui/primitives";
import { googleAuthUrl } from "@/lib/api/auth";
import { USE_MOCK_API } from "@/lib/api/client";

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.6.1-1.18.28-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.96L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * Starts the OAuth round trip. The browser leaves the app, Google calls the
 * API, and the API sends it back to /auth/google/callback with a one-time code.
 */
export function GoogleSignInButton({
  label = "Continue with Google",
  next,
}: {
  label?: string;
  next?: string | null;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Demo mode has no backend to complete the OAuth handshake.
  if (USE_MOCK_API) return null;

  const onClick = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const requested =
        next ?? new URLSearchParams(window.location.search).get("next") ?? undefined;
      const url = await googleAuthUrl(requested);
      window.location.assign(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Google sign-in could not be started. Try again."
      );
      setLoading(false);
    }
  };

  return (
    <div className="auth__social">
      <Button variant="secondary" size="lg" block onClick={onClick} loading={loading}>
        {loading ? (
          "Connecting to Google…"
        ) : (
          <>
            <GoogleMark />
            {label}
          </>
        )}
      </Button>
      {error ? (
        <Alert tone="danger" title="Could not sign in with Google">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
