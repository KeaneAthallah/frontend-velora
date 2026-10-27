"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";
import { resetPassword } from "@/lib/api/auth";

export default function ResetPasswordPage() {
  const [token, setToken] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
    setEmail(params.get("email") ?? "");
  }, []);

  const missing = !token || !email;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (missing) {
      setError("This reset link is incomplete. Request a fresh link.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for the new password.");
      return;
    }
    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword({
        token,
        email,
        password,
        passwordConfirmation: confirmation,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The password could not be reset");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth__form">
        <div className="auth__form-head">
          <span className="eyebrow">Account recovery</span>
          <h1>Choose a new password</h1>
          <p>
            {missing
              ? "This reset link is missing its security token or email address."
              : `Set a new password for ${email}. All other sessions stay signed in unless your administrator revokes them.`}
          </p>
        </div>

        {done ? (
          <>
            <div className="empty" style={{ padding: "24px 18px 8px" }}>
              <div className="empty__icon" aria-hidden="true">
                <CheckCircle2 />
              </div>
              <h3>Password updated</h3>
              <p>You can now sign in with the new password. The reset link is no longer valid.</p>
            </div>
            <Link href="/login" className="btn btn--primary btn--lg btn--block">
              Continue to sign in
              <ArrowRight aria-hidden="true" />
            </Link>
          </>
        ) : (
          <>
            {missing ? (
              <Alert tone="warning" title="Link incomplete">
                Request a new password reset email from the sign-in page.
              </Alert>
            ) : null}
            {error ? (
              <Alert tone="danger" title="Password not changed">
                {error}
              </Alert>
            ) : null}

            <form onSubmit={onSubmit} noValidate>
              <div className="auth__fields">
                <Field
                  label="New password"
                  htmlFor="new-password"
                  hint="At least 8 characters."
                  required
                >
                  <div style={{ position: "relative" }}>
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="New password"
                      style={{ paddingRight: 38 }}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm new password" htmlFor="confirm-password" required>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="Repeat the password"
                    required
                  />
                </Field>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                loading={submitting}
                disabled={missing}
                style={{ marginTop: 18 }}
              >
                {submitting ? "Updating…" : "Update password"}
                {!submitting ? <KeyRound aria-hidden="true" /> : null}
              </Button>
            </form>

            <Link href="/forgot-password" className="auth__switch" style={{ display: "block" }}>
              Need a new link? <span style={{ color: "hsl(var(--primary))", fontWeight: 650 }}>Request one</span>
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}

