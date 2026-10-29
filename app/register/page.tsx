"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";
import { register } from "@/lib/api/auth";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { defaultRoute } from "@/lib/navigation";

export default function RegisterPage() {
  const { session, refresh, loading: authLoading } = useAuth();
  const { has } = usePermissions();
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [accepted, setAccepted] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!authLoading && session) router.replace(defaultRoute(has));
  }, [authLoading, session, router, has]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters for the password.");
      return;
    }
    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }
    if (!accepted) {
      setError("Accept the terms to create an account.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await register(name.trim(), email.trim(), password, confirmation);
      await refresh();
      // A brand-new account has no business yet, so send it through setup. The
      // permissions used for the landing route must come from the new session,
      // not from the render that happened before signing up.
      if (!created.business.id) {
        router.replace("/onboarding");
        return;
      }
      router.replace(defaultRoute((permission) => created.permissions.includes("*") || created.permissions.includes(permission)));
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "The account could not be created.");
    }
    setSubmitting(false);
  };

  return (
    <AuthShell>
      <div className="auth__form">
        <div className="auth__form-head">
          <span className="eyebrow">Get started</span>
          <h1>Create your account</h1>
          <p>Next you will set up your business and first outlet.</p>
        </div>

        {error ? (
          <Alert tone="danger" title="Could not create the account">
            {error}
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} noValidate>
          <div className="auth__fields">
            <Field label="Full name" htmlFor="name" required>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>

            <Field label="Work email" htmlFor="email" required>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@business.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>

            <Field label="Password" htmlFor="password" required aside={<span className="hint">8+ characters</span>}>
              <div style={{ position: "relative" }}>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  style={{ paddingRight: 38 }}
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

            <Field label="Confirm password" htmlFor="password-confirmation" required>
              <Input
                id="password-confirmation"
                name="password_confirmation"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                minLength={8}
              />
            </Field>
          </div>

          <label className="auth__consent">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              required
            />
            <span>I agree to the Terms and Privacy Policy.</span>
          </label>

          <Button type="submit" variant="primary" size="lg" block loading={submitting} style={{ marginTop: 20 }}>
            {submitting ? "Creating account…" : "Create account"}
            {!submitting ? <ArrowRight aria-hidden="true" /> : null}
          </Button>
        </form>

        <p className="auth__switch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}
