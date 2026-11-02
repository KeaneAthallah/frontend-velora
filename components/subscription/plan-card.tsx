"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge, Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatting/currency";
import type { PlanApi } from "@/lib/api/types";

export function PlanCard({
  plan,
  billingPeriod = "monthly",
  featured = false,
  label,
  onSubscribe,
  currentPlan = false,
}: {
  plan: PlanApi;
  billingPeriod?: "monthly" | "yearly";
  featured?: boolean;
  label?: string;
  onSubscribe?: () => void;
  currentPlan?: boolean;
}) {
  const price = billingPeriod === "yearly" ? plan.prices.yearly : plan.prices.monthly;
  const periodLabel = billingPeriod === "yearly" ? "/yr" : "/mo";
  const features = Object.entries(plan.features ?? {})
    .filter(([, v]) => v === true || v === 1)
    .map(([k]) => k);

  return (
    <Card className={cn("plan-card", featured && "plan-card--featured")} style={{ minWidth: featured ? undefined : 280 }}>
      <CardHeader
        title={plan.name}
        description={
          <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
            <span style={{ fontSize: 32, fontWeight: 600 }}>{formatCurrency(price)}</span>
            {!plan.isTrial && <span className="hint">{periodLabel}</span>}
            {label && <Badge tone="info">{label}</Badge>}
          </div>
        }
      />
      <CardBody className="stack-sm">
        <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
          {plan.description}
        </p>
        {features.length > 0 && (
          <ul className="stack" style={{ gap: 6, paddingLeft: 0, listStyle: "none" }}>
            {features.slice(0, 8).map((key) => (
              <li key={key} className="row" style={{ gap: 8 }}>
                <Check style={{ width: 14, height: 14, color: "hsl(var(--success))", flexShrink: 0 }} aria-hidden="true" />
                <span className="hint" style={{ fontSize: 13 }}>{key}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <CardFooter className="row row-tight">
        {currentPlan ? (
          <Button disabled block variant="secondary">
            Current plan
          </Button>
        ) : plan.isTrial ? (
          <Link href="/register" className="btn btn--primary btn--block">
            Start trial
          </Link>
        ) : (
          <Button block onClick={onSubscribe} variant={featured ? "primary" : "secondary"} loading={false}>
            Subscribe
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
