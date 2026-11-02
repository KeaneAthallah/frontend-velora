"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, Spinner } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth/auth-context";

const ERROR_COPY: Record<string, string> = {
  access_denied: "Google sign-in was cancelled before it finished.",
  google_failed: "Google could not confirm the sign-in. Please try again.",
  google_email_missing: "That Google account did not share an email address.",
  google_email_unverified: "Google has not verified that email address, so it cannot be used.",
  account_inactive: "This account is not active. Ask your workspace administrator for access.",
  invalid_state: "This sign-in link has expired or was already used. Start again.",
  google_not_configured: "Google sign-in is not configured on this server.",
};

function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

export default function GoogleCallbackPage() {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const failure = params.get("error");
    const requested = params.get("next");

    if (failure || !code) {
      setError(
        ERROR_COPY[failure ?? ""] ?? "Google sign-in did not complete. Please try again."
      );
      return;
    }

    let cancelled = false;
    signInWithGoogle(code)
      .then(() => {
        if (!cancelled) router.replace(safeNext(requested));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "That sign-in link could not be used. Try again."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router, signInWithGoogle]);

  return (
    <AuthShell>
      <div className="auth__form">
        <div className="auth__form-head">
          <span className="eyebrow">Google sign-in</span>
          <h1>{error ? "Sign-in didn’t finish" : "Finishing sign-in"}</h1>
          <p>
            {error
              ? "Nothing was changed on your account."
              : "One moment while we confirm your Google account."}
          </p>
        </div>

        {error ? (
          <>
            <Alert tone="danger" title="Could not sign in with Google">
              {error}
            </Alert>
            <Link href="/login" className="btn btn--secondary btn--lg btn--block">
              Back to sign in
            </Link>
          </>
        ) : (
          <div className="auth__meta" aria-live="polite">
            <Spinner label="Finishing sign-in" />
            <span className="hint">Contacting Google…</span>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
