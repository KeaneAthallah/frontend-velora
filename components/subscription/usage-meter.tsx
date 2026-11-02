import * as React from "react";
import { cn } from "@/lib/utils";

const LEVEL_TONES: Record<string, string> = {
  ok: "",
  warning: "text-warning",
  critical: "text-danger",
  reached: "text-danger",
};

export function UsageMeter({
  metric,
  label,
  used,
  limit,
  level,
  unlimited = false,
}: {
  metric?: string;
  label: string;
  used: number;
  limit: number | null;
  level?: "ok" | "warning" | "critical" | "reached" | "unlimited";
  unlimited?: boolean;
}) {
  const pct = unlimited ? 0 : limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const resolvedLevel = level ?? (unlimited ? "unlimited" : pct >= 100 ? "reached" : pct >= 90 ? "critical" : pct >= 80 ? "warning" : "ok");
  const toneClass = LEVEL_TONES[resolvedLevel] || "";
  const displayLimit = unlimited ? "Unlimited" : limit != null ? new Intl.NumberFormat().format(limit) : "—";
  const displayUsed = new Intl.NumberFormat().format(used);
  const remaining = !unlimited && limit != null ? Math.max(0, limit - used) : null;
  const remainingLabel = remaining !== null && remaining <= 10 ? `${remaining} left` : null;

  return (
    <div className="usage-row">
      <div className="row between" style={{ gap: 12 }}>
        <span className={toneClass}>{label}</span>
        <span className="num hint">{displayUsed} / {displayLimit}</span>
      </div>
      {limit != null && (
        <div className="progress" style={{ marginTop: 6 }}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="row between" style={{ gap: 12, marginTop: 4 }}>
        {metric ? <span className="hint" style={{ fontSize: 10 }}>{metric}</span> : null}
        {remainingLabel && <span className={cn("hint", toneClass)}>{remainingLabel}</span>}
      </div>
    </div>
  );
}
