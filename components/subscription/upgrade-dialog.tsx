"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { formatCurrency, formatNumber } from "@/lib/formatting/currency";
import type { PlanApi } from "@/lib/api/types";
import { useSubscription } from "@/lib/subscription/context";

export function UpgradeDialog({
  open,
  onClose,
  metricLabel,
  currentPlan,
  usage,
  limit,
  remaining,
  upgradePlanSlug,
  upgradePlanName,
}: {
  open: boolean;
  onClose: () => void;
  metricLabel?: string;
  currentPlan: string;
  usage?: number;
  limit?: number;
  remaining?: number;
  upgradePlanSlug?: string | null;
  upgradePlanName?: string;
}) {
  const { refetch } = useSubscription();

  return (
    <Dialog open={open} onClose={onClose} title="Upgrade your plan" width={520}>
      <div className="stack-sm">
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          {metricLabel ? `You've reached the ${metricLabel} limit for your ${currentPlan} plan.` : `Your plan has limits that block this action.`}
        </p>

        {usage !== undefined && limit !== undefined && (
          <div className="card" style={{ padding: 12, background: "hsl(var(--surface-2))" }}>
            <div className="row between">
              <span className="hint">{metricLabel ?? "Current usage"}</span>
              <span className="num">{formatNumber(usage)} / {formatNumber(limit)}</span>
            </div>
            {remaining !== undefined && remaining <= 0 && (
              <span className="text-danger hint" style={{ marginTop: 4 }}>No items remaining</span>
            )}
          </div>
        )}

        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Upgrading to <strong>{upgradePlanName || "Pro"}</strong> ({upgradePlanSlug}) will remove these limits and unlock additional features.
        </p>
      </div>
    </Dialog>
  );
}

export function FeatureLocked({ featureLabel, upgradePlanName }: { featureLabel: string; upgradePlanName?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <p className="muted" style={{ fontSize: 13 }}>
        <strong>{featureLabel}</strong>{" "}
        {upgradePlanName ? `is available on the ${upgradePlanName} plan.` : "requires a higher subscription plan."}
      </p>
    </div>
  );
}
