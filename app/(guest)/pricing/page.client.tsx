"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Segmented } from "@/components/ui/primitives";
import { getPricing, createCheckout } from "@/lib/api/subscriptions";
import { useAuth } from "@/lib/auth/auth-context";
import { formatCurrency } from "@/lib/formatting/currency";

export const instant = false;

const PLANS_ORDER = ["trial", "basic", "pro"] as const;

export default function PricingPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = React.useState<"monthly" | "yearly">("monthly");

  const { data, isLoading } = useQuery({
    queryKey: ["pricing"],
    queryFn: getPricing,
    staleTime: 5 * 60_000,
  });

  const currentPlanSlug = session?.subscription?.plan?.slug ?? null;

  const handleSubscribe = async (slug: string) => {
    if (!session) {
      router.push(`/login?next=/pricing`);
      return;
    }
    if (slug === "trial") {
      router.push("/register");
      return;
    }
    try {
      const result = await createCheckout({ plan: slug, billingPeriod: period });
      if (result.checkout.redirectUrl) {
        window.location.href = result.checkout.redirectUrl;
      } else {
        router.push(`/settings/subscription?checkout=${result.payment.id}`);
      }
    } catch {
      router.push(`/settings/subscription?subscribe=${slug}`);
    }
  };

  return (
    <div className="pricing">
      {/* ── Hero ── */}
      <section className="pr-hero">
        <h1 className="pr-hero__title">Simple pricing that grows with you.</h1>
        <p className="pr-hero__sub">Start free for 30 days. Upgrade when you need more features, more outlets, or more power.</p>
        <div className="pr-toggle">
          <Segmented
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly \u2014 save up to 17%" },
            ]}
            value={period}
            onChange={(v) => setPeriod(v as "monthly" | "yearly")}
            label="Billing period"
          />
        </div>
      </section>

      {/* ── Plan cards ── */}
      {isLoading ? (
        <SkeletonGrid count={3} />
      ) : data ? (
        <section className="pr-plans" aria-label="Pricing plans">
          {PLANS_ORDER.map((slug) => {
            const plan = data.plans.find((p) => p.slug === slug);
            if (!plan) return null;
            const price = period === "yearly" ? plan.prices.yearly : plan.prices.monthly;
            const featured = slug === "pro";
            const isCurrent = currentPlanSlug === slug;
            const savings = calcSavings(plan);

            return (
              <article key={slug} className={`pr-card${featured ? " pr-card--featured" : ""}`}>
                {featured && <span className="pr-badge">Recommended</span>}
                {savings && !featured && <span className="pr-badge pr-badge--save">{savings}</span>}

                <div className="pr-head">
                  <h3>{plan.name}</h3>
                  {plan.isTrial ? (
                    <span className="pr-period">{data.trialDays}-day free trial</span>
                  ) : (
                    <span className="pr-period">
                      <span className="pr-price">{formatCurrency(price)}</span>
                      <span className="pr-suffix">/{period === "monthly" ? "mo" : "yr"}</span>
                    </span>
                  )}
                </div>

                {plan.description && <p className="pr-desc">{plan.description}</p>}

                <dl className="pr-limits">
                  {[
                    ["Products", plan.limits.products],
                    ["Customers", plan.limits.customers],
                    ["Transactions/mo", plan.limits.transactions_per_month],
                    ["Outlets", plan.limits.outlets],
                    ["Users", plan.limits.users],
                  ].filter(([, val]) => val != null && val !== undefined).map(([label, val]) => (
                    <React.Fragment key={label}>
                      <dt>{label}</dt>
                      <dd>{new Intl.NumberFormat().format(Number(val))}</dd>
                    </React.Fragment>
                  ))}
                </dl>

                <div className="pr-foot">
                  {isCurrent ? (
                    <button type="button" disabled className="btn btn--secondary btn--block">On {plan.name}</button>
                  ) : plan.isTrial ? (
                    <button type="button" onClick={() => handleSubscribe(slug)} className="btn btn--primary btn--block">Start free trial</button>
                  ) : (
                    <button type="button" onClick={() => handleSubscribe(slug)} className={`btn${featured ? " btn--primary" : " btn--secondary"} btn--block`}>Subscribe</button>
                  )}
                  <Link href="#compare">Compare all features</Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {/* ── Feature comparison ── */}
      {data && (
        <section id="compare" className="pr-compare">
          <p className="pr-compare__label">Feature comparison</p>
          <table className="pr-table">
            <tbody>
              {data.comparison.map((group) => (
                <React.Fragment key={group.group}>
                  <tr className="group-sep"><td colSpan={4}>{group.group}</td></tr>
                  {group.features.map((feat) => (
                    <tr key={feat.key}>
                      <td>{feat.label || feat.key}</td>
                      {PLANS_ORDER.map((slug) => {
                        const enabled = feat.plans[slug] === true;
                        return (
                          <td key={slug} style={{ textAlign: "center" }}>
                            {enabled ? <Check className="tbl-check" aria-hidden="true" /> : <X className="tbl-cross" aria-hidden="true" />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Bottom CTA ── */}
      <section className="pr-cta">
        <h2>Ready to get started?</h2>
        <p>Start your free 30-day trial today. No credit card required.</p>
        <Link href="/register" className="btn btn--primary btn--lg">Create your account</Link>
      </section>
    </div>
  );
}

/* ─── helpers ─── */

function calcSavings(plan: { prices: { monthly: number; yearly: number } }): string | null {
  const m = plan.prices.monthly * 12;
  const y = plan.prices.yearly;
  if (y >= m) return null;
  const pct = Math.round(((m - y) / m) * 100);
  return `Save ${pct}%`;
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="pr-plans">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-row pr-card" />
      ))}
    </div>
  );
}
