"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const { session, signIn } = useAuth();
  const router = useRouter();
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  const onSubmit = async () => {
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
      <div className="hero"><Image src="/brand/velora_brand_hero_banner.png" alt="Velora dashboard on laptop and phone" width={1010} height={483} priority /></div>
      <div className="card cb lf">
        <Image src="/brand/velora_primary_logo.png" alt="Velora" width={180} height={63} />
        <h1>Sign in</h1>
        <label className="field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button type="button" className="btn primary block" disabled={loading} onClick={onSubmit}>{loading ? "Signing in…" : "Sign in"}</button>
      </div>
    </div>
  );
}
