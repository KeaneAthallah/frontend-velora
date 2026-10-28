"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";
import { USE_MOCK_API } from "@/lib/api/client";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { defaultRoute } from "@/lib/navigation";

export default function LoginPage() {
  const { session, signIn, loading: authLoading } = useAuth();
  const { has } = usePermissions();
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const nextPath = React.useCallback(() => {
    if (typeof window === "undefined") return defaultRoute(has);
    const requested = new URLSearchParams(window.location.search).get("next");
    if (requested?.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/login")) {
      return requested;
    }
    return defaultRoute(has);
  }, [has]);

  React.useEffect(() => {
    if (!authLoading && session) router.replace(nextPath());
  }, [authLoading, session, router, nextPath]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      setError(
        message.toLowerCase().includes("invalid")
          ? "That email and password combination was not recognised."
          : message
      );
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  };

  return (
    <AuthShell>
      <div className="auth__form">
        <div className="auth__form-head">
          <span className="eyebrow">Welcome back</span>
          <h1>Sign in to Velora</h1>
          <p>Use the account your workspace administrator created for you.</p>
        </div>

        {error ? (
          <Alert tone="danger" title="Could not sign in">
            {error}
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} noValidate>
          <div className="auth__fields">
            <Field label="Email" htmlFor="email" required>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                aria-invalid={Boolean(error) || undefined}
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              required
              aside={
                <Link href="/forgot-password" className="hint">
                  Forgot password?
                </Link>
              }
            >
              <div style={{ position: "relative" }}>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  style={{ paddingRight: 38 }}
                  aria-invalid={Boolean(error) || undefined}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </Field>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            loading={submitting}
            style={{ marginTop: 24 }}
          >
            {submitting ? "Signing in…" : "Sign in"}
            {!submitting ? <ArrowRight aria-hidden="true" /> : null}
          </Button>
        </form>

        {USE_MOCK_API ? (
          <div className="auth__demo">
            <LockKeyhole
              aria-hidden="true"
              style={{ width: 13, height: 13, display: "inline", marginRight: 5 }}
            />
            <b>Local demo workspace.</b> Sign in with <code>admin@velora.test</code> and{" "}
            <code>password</code>. Data is generated locally and resets when the dev session reloads.
          </div>
        ) : null}

        <p className="auth__switch">
          Need access or a password reset? Ask your workspace owner. Velora does not create
          accounts from the public sign-in page.
        </p>
      </div>
    </AuthShell>
  );
}
