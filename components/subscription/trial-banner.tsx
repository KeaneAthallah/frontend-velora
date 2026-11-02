"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";

export function TrialBanner({
  daysRemaining,
  trialEndsAt,
  trialReminders = [14, 7, 3, 1],
}: {
  daysRemaining: number;
  trialEndsAt: string | null;
  trialReminders?: number[];
}) {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed || daysRemaining < 0) return null;

  const isReminder = trialReminders.includes(daysRemaining);
  const tone: "warning" | "danger" | "neutral" = daysRemaining <= 3 ? "danger" : daysRemaining <= 7 ? "warning" : "neutral";
  const message =
    daysRemaining <= 3
      ? `Trial expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}. Upgrade to keep using Velora.`
      : daysRemaining <= 7
        ? `Your trial expires in ${daysRemaining} days. Upgrade when ready.`
        : `${daysRemaining} days left on your free trial.`;

  return (
    <div className="trial-banner">
      <div className="row row-tight">
        <Badge tone={tone}>{daysRemaining} days left</Badge>
        <span style={{ fontSize: 13 }}>{message}</span>
      </div>
      <div className="row row-tight">
        <Link href="/settings/subscription" className="btn btn--primary btn--sm">
          View plans
        </Link>
        <button type="button" className="icon-btn" onClick={() => setDismissed(true)}>
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function SubscriptionNotice({ status }: { status: string }) {
  const notice: Record<string, { tone: "danger" | "warning"; title: string; description: string }> = {
    expired: { tone: "danger", title: "Subscription expired", description: "Upgrade or renew to regain access." },
    past_due: { tone: "warning", title: "Payment overdue", description: "Complete your payment within the grace period to avoid service interruption." },
    canceled: { tone: "warning", title: "Subscription canceled", description: "Access continues until the end of your paid period." },
    suspended: { tone: "danger", title: "Subscription suspended", description: "Contact support for assistance." },
  };
  const n = notice[status];
  if (!n) return null;

  return (
    <div className={`trial-banner alert alert--${n.tone === "danger" ? "danger" : "warning"}`}>
      <strong>{n.title}</strong> {n.description}{" "}
      <Link href="/settings/subscription">Manage subscription</Link>.
    </div>
  );
}
