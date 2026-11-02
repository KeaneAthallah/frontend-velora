import type { SubscriptionSummary, SubscriptionDetail } from "@/lib/api/types";
import type { PlanApi } from "@/lib/api/types";

const USAGE_LEVELS = ["ok", "warning", "critical", "reached"] as const;
type LevelIndex = number;

/** Determine the usage level tone from a percentage (0–100+). */
export function resolveUsageLevel(percent: number): "ok" | "warning" | "critical" | "reached" {
  if (percent >= 100) return "reached";
  if (percent >= 90) return "critical";
  if (percent >= 80) return "warning";
  return "ok";
}

/** Label for a plan limit value. */
export function limitLabel(limit: number | null): string {
  if (limit === null || limit === undefined) return "Unlimited";
  return new Intl.NumberFormat().format(limit);
}

/** Whether the given days-remaining matches a configured trial reminder threshold. */
export function isTrialReminder(daysRemaining: number, thresholds: number[]): boolean {
  return thresholds.includes(daysRemaining);
}

/** Extract the upgrade target plan info (next higher sort_order). */
export function getUpgradePlan(
  plans: PlanApi[]
): { slug: string; name: string } | null {
  const currentSort = -1;
  return plans
    .filter((p) => p.sortOrder > currentSort)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]
    ? { slug: plans.filter((p) => p.sortOrder > currentSort).sort((a, b) => a.sortOrder - b.sortOrder)[0].slug, name: plans.filter((p) => p.sortOrder > currentSort).sort((a, b) => a.sortOrder - b.sortOrder)[0].name }
    : null;
}

/** Whether a feature key is enabled in a summary. */
export function featureEnabled(summary: SubscriptionSummary, key: string): boolean {
  return !!summary.features?.[key];
}
