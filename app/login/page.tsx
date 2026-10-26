"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { useToast } from "@/components/ui/toast";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const { session, signIn } = useAuth();
  const router = useRouter();
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      push({ title: "Login failed", description: (err as Error).message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <section className="login-hero">
        <div>
          <Image src="/brand/velora_primary_logo.png" alt="Velora" width={150} height={52} priority />
        </div>
        <div>
          <h1>Run your business with clarity.</h1>
          <p>POS, inventory, purchasing, and reports — in one calm, fast workspace built for the way you actually work.</p>
          <ul style={{ marginTop: 28, display: "grid", gap: 10, listStyle: "none", padding: 0, color: "hsl(0 0% 100% / 0.85)", fontSize: 14 }}>
            <li>• Real-time stock across every outlet</li>
            <li>• Fast, offline-friendly checkout</li>
            <li>• Clear reports that don&apos;t need a spreadsheet</li>
          </ul>
        </div>
        <div style={{ fontSize: 12, color: "hsl(0 0% 100% / 0.6)" }}>© Velora</div>
      </section>
      <section className="login-card">
        <form className="lf" onSubmit={onSubmit}>
          <h1>Sign in</h1>
          <p className="muted">Use your Velora account to continue.</p>
          <div className="field" style={{ marginTop: 12 }}>
            <span>Email</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@velora.test" required />
          </div>
          <div className="field">
            <span>Password</span>
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required style={{ width: "100%", paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, cursor: "pointer", color: "hsl(var(--muted-foreground))" }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button className="btn primary block" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? "Signing in…" : (<>Sign in <ArrowRight size={16} /></>)}
          </button>
          <Link className="link" href="/login">Forgot password?</Link>
        </form>
      </section>
    </div>
  );
}