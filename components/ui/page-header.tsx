import * as React from "react";
import { cn } from "@/lib/utils";
import { Delta, InfoTip } from "./primitives";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("page-head", className)}>
      <div className="page-head__copy">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  );
}

export function Stat({
  label,
  value,
  unit,
  foot,
  info,
  className,
  emphasis = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  foot?: React.ReactNode;
  info?: React.ReactNode;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={cn("stat", className)}>
      <div className="stat__label">
        <span>{label}</span>
        {info && <InfoTip label={`About ${typeof label === "string" ? label : "this metric"}`}>{info}</InfoTip>}
      </div>
      <div className="stat__value" style={emphasis ? { color: "hsl(var(--primary))" } : undefined}>
        {value}
        {unit && <span className="stat__unit">{unit}</span>}
      </div>
      {foot && <div className="stat__foot">{foot}</div>}
    </div>
  );
}

export function StatDelta({
  value,
  label,
  invert = false,
}: {
  value: number | null | undefined;
  label?: string;
  invert?: boolean;
}) {
  return (
    <>
      <Delta value={value} invert={invert} />
      {label && <span>{label}</span>}
    </>
  );
}
