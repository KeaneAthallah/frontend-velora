"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";
import { forgotPassword } from "@/lib/api/auth";
import { USE_MOCK_API } from "@/lib/api/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request a reset link");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth__form">
        <div className="auth__form-head">
          <span className="eyebrow">Account recovery</span>
          <h1>Reset your password</h1>
          <p>
            Enter the email on your Velora account. If it matches an active member, we will send a
            single-use reset link.
          </p>
        </div>

        {sent ? (
          <>
            <div className="empty" style={{ padding: "24px 18px 8px" }}>
              <div className="empty__icon" aria-hidden="true">
                <MailCheck />
              </div>
              <h3>Check your inbox</h3>
              <p>
                {USE_MOCK_API
                  ? "This local demo does not send email. Use the demo credentials shown on the sign-in page."
                  : `If ${email} belongs to a Velora member, a reset link is on its way. The link expires shortly for security.`}
              </p>
            </div>
            <Button variant="secondary" block onClick={() => setSent(false)}>
              Use a different address
            </Button>
            <Link href="/login" className="btn btn--quiet btn--block">
              <ArrowLeft aria-hidden="true" />
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            {error ? (
              <Alert tone="danger" title="Request not sent">
                {error}
              </Alert>
            ) : null}
            <form onSubmit={onSubmit} noValidate>
              <Field label="Email" htmlFor="recovery-email" required>
                <Input
                  id="recovery-email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                loading={submitting}
                style={{ marginTop: 18 }}
              >
                {submitting ? "Sending…" : "Send reset link"}
                {!submitting ? <ArrowRight aria-hidden="true" /> : null}
              </Button>
            </form>
            <Link href="/login" className="auth__switch" style={{ display: "block" }}>
              Remembered it? <span style={{ color: "hsl(var(--primary))", fontWeight: 650 }}>Return to sign in</span>
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}

