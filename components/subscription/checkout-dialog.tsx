"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Segmented, Select } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatting/currency";
import { changePlan, renewSubscription } from "@/lib/api/subscriptions";
import type { CheckoutResult, PaymentProvider, PlanApi } from "@/lib/api/types";

type Mode = "switch" | "renew";

/**
 * One place where a plan change turns into a payment.
 *
 * The API answers with a provider checkout: an automated provider (Midtrans)
 * returns `redirect_url`, which the browser must open, while the manual
 * provider returns bank-transfer instructions on the invoice. Enterprise plans
 * never get here — `PLAN_NOT_SELF_SERVE` is reported inline.
 */
export function CheckoutDialog({
  open,
  mode,
  plan,
  providers,
  defaultBillingPeriod = "monthly",
  onClose,
  onSettled,
}: {
  open: boolean;
  mode: Mode;
  plan: PlanApi | null;
  providers: PaymentProvider[];
  defaultBillingPeriod?: "monthly" | "yearly";
  onClose: () => void;
  onSettled: () => void;
}) {
  const [period, setPeriod] = React.useState<"monthly" | "yearly">(defaultBillingPeriod);
  const [provider, setProvider] = React.useState("");
  const [manual, setManual] = React.useState<CheckoutResult | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const defaultProvider = React.useMemo(
    () => providers.find((p) => p.name !== "manual")?.name ?? providers[0]?.name ?? "manual",
    [providers]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "renew") {
        return { requiresPayment: true, checkout: await renewSubscription({ billingPeriod: period, provider }) };
      }
      if (!plan) throw new Error("Choose a plan first.");
      const result = await changePlan({ plan: plan.slug, billingPeriod: period, provider });
      return {
        requiresPayment: result.requiresPayment,
        checkout: result.checkout,
        scheduled: result.scheduled,
        effectiveAt: result.effectiveAt,
      };
    },
    onSuccess: (result) => {
      onSettled();
      const redirectUrl = result.checkout?.checkout.redirectUrl ?? null;
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }
      if (!result.requiresPayment) {
        setDone(
          result.scheduled
            ? `Your plan changes on ${result.effectiveAt ? new Date(result.effectiveAt).toLocaleDateString() : "the next billing date"}.`
            : "Your plan is updated. No payment was needed."
        );
        return;
      }
      setManual(result.checkout ?? null);
    },
  });

  React.useEffect(() => {
    if (!open) return;
    setPeriod(defaultBillingPeriod);
    setProvider(defaultProvider);
    setManual(null);
    setDone(null);
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultProvider, defaultBillingPeriod]);

  const price = plan ? (period === "yearly" ? plan.prices.yearly : plan.prices.monthly) : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === "renew" ? "Renew subscription" : `${plan?.name ?? "Plan"} checkout`}
      description={
        mode === "renew"
          ? "Create a payment for the next billing period."
          : "Confirm the plan, billing period and payment method."
      }
      width={520}
    >
      {done ? (
        <div className="stack-sm">
          <Alert tone="success" title="Plan updated">{done}</Alert>
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : manual ? (
        <div className="stack-sm">
          <Alert tone="info" title="Payment created">
            Invoice <b>{manual.invoice.number}</b> for {formatCurrency(manual.invoice.total, manual.invoice.currency)}
            {manual.checkout.reference ? (
              <>
                {" "}· reference <code>{manual.checkout.reference}</code>
              </>
            ) : null}
          </Alert>
          {manual.checkout.instructions ? (
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>{manual.checkout.instructions}</p>
          ) : (
            <p className="hint">The plan activates once the provider confirms the payment.</p>
          )}
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form
          className="stack-sm"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          {plan && mode === "switch" ? (
            <div className="row between" style={{ gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{plan.name}</div>
                <div className="hint">{plan.description}</div>
              </div>
              <div className="num">{formatCurrency(price, plan.currency)}</div>
            </div>
          ) : null}

          <Segmented
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
            value={period}
            onChange={(value: string) => setPeriod(value as "monthly" | "yearly")}
            label="Billing period"
          />

          {providers.length > 1 ? (
            <div className="field">
              <label className="field__label" htmlFor="checkout-provider">Payment method</label>
              <Select
                id="checkout-provider"
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
              >
                {providers.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.label}{option.sandbox ? " (sandbox)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <p className="hint">
              {providers[0]?.label ?? "Bank transfer"} is the only payment method configured on this server.
            </p>
          )}

          {mutation.isError ? (
            <Alert tone="danger" title="Could not create the payment">
              {mutation.error instanceof Error ? mutation.error.message : "Try again."}
            </Alert>
          ) : null}

          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="quiet" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={mutation.isPending}>
              {provider === "manual" ? "Create invoice" : "Continue to payment"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
