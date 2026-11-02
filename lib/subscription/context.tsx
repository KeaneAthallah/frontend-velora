"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { SubscriptionSummary, SubscriptionDetail, PlanApi, SubscriptionUsage } from "@/lib/api/types";
import { getSubscription, listPlans, getPricing } from "@/lib/api/subscriptions";
import { featureEnabled, resolveUsageLevel, getUpgradePlan } from "@/lib/subscription/guards";
import { useAuth } from "@/lib/auth/auth-context";

interface SubscriptionContextValue {
  /** Raw summary embedded in /me — always available without a second fetch. */
  summary: SubscriptionSummary | null;
  /** Full snapshot from GET /subscription — refetchable. */
  data: SubscriptionDetail | null;
  /** Convenience accessor for the full subscription detail object (from data). */
  subscription: NonNullable<SubscriptionDetail>["subscription"];
  loading: boolean;
  error: unknown | null;
  /** Convenience accessor for current plan info. */
  plan: PlanApi | null;
  /** Current status string. */
  status: SubscriptionDetail["subscription"]["status"];
  /** Whether the business currently has access to features. */
  isActive: boolean;
  /** Trial days remaining (0 when not trialing). */
  trialDaysRemaining: number;
  /** Map of enabled feature keys → true. */
  enabledFeatures: Set<string>;
  /** All usage metrics from the full snapshot. */
  usage: SubscriptionUsage[];
  /** Usage for a specific metric. */
  usageFor(metric: string): SubscriptionUsage | undefined;
  /** Quota remaining for a metric. */
  remainingFor(metric: string): number | null;
  /** Whether a feature is accessible given the current plan & limits. */
  canAccessFeature(key: string): boolean;
  /** Suggested upgrade plan slug. */
  upgradePlanSlug: string | null;
  /** Refresh the full snapshot. */
  refetch: () => void;
}

const SubscriptionContext = React.createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const summary = session?.subscription ?? null;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    staleTime: 60_000,
  });

  const value = React.useMemo<SubscriptionContextValue>(() => {
    const d = data;
    if (!d) {
      return {
        summary,
        data: null,
        subscription: {} as NonNullable<SubscriptionDetail>["subscription"],
        loading: true,
        error,
        plan: null,
        status: summary?.status ?? "trialing",
        isActive: summary?.isActive ?? false,
        trialDaysRemaining: summary?.trialDaysRemaining ?? 0,
        enabledFeatures: new Set(),
        usage: [],
        usageFor: () => undefined,
        remainingFor: () => null,
        canAccessFeature: () => false,
        upgradePlanSlug: null,
        refetch,
      };
    }

    const plan = d.plan;
    const enabled = new Set<string>();
    if (plan?.features) {
      Object.entries(plan.features).forEach(([k, v]) => {
        if (v === true || v === 1) enabled.add(k);
      });
    } else if (d.features) {
      Object.entries(d.features).forEach(([k, v]) => {
        if (v === true || v === 1) enabled.add(k);
      });
    }

    // Upgrade target = next higher sort_order than the current plan (or 0 for trial).
    const currentSort = plan?.sortOrder ?? 0;
    const allPlans = [...(d.availablePlans ?? []), ...(plan ? [plan] : [])];
    const nextHigher = allPlans
      .filter((p) => p.sortOrder > currentSort)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0];

    return {
      summary,
      data: d,
      subscription: d.subscription,
      loading: false,
      error,
      plan,
      status: d.subscription.status,
      isActive: d.subscription.isActive,
      trialDaysRemaining: d.subscription.trialDaysRemaining,
      enabledFeatures: enabled,
      usage: d.usage,
      usageFor: (metric: string) => d.usage.find((u) => u.metric === metric),
      remainingFor: (metric: string) => {
        const u = d.usage.find((u) => u.metric === metric);
        return u?.remaining ?? null;
      },
      canAccessFeature: (key: string) => {
        if (!d.subscription.isActive) return false;
        if (plan && plan.features) {
          const val = (plan.features as Record<string, unknown>)[key];
          return val === true || val === 1;
        }
        if (d.features) {
          const val = d.features[key];
          return val === true || val === 1;
        }
        return false;
      },
      upgradePlanSlug: nextHigher?.slug ?? null,
      refetch,
    };
  }, [summary, data, error, refetch]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = React.useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used inside SubscriptionProvider");
  }
  return ctx;
}

/** Shallow wrapper for pages that only need the summary from /me. */
export function useSubscriptionSummary(): SubscriptionSummary | null {
  const { session } = useAuth();
  return session?.subscription ?? null;
}
