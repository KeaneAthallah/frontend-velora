"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, CreditCard, Download, Info, LockKeyhole, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge, Button, Segmented } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { ConfirmDialog, Dialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatting/currency";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useSubscription } from "@/lib/subscription/context";
import { useBusiness } from "@/lib/business/context";
import {
  cancelSubscription,
  getSubscription,
  listInvoices,
  listPayments,
  listPlans,
  resumeSubscription,
  syncPayment,
} from "@/lib/api/subscriptions";
import { updateAdminPlan } from "@/lib/api/admin";
import type { SubscriptionDetail, SubscriptionHistoryEntry, SubscriptionInvoice, SubscriptionPayment } from "@/lib/api/types";

export const instant = false;

const STATUS_BADGE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  trialing: "success",
  active: "success",
  past_due: "warning",
  canceled: "neutral",
  expired: "danger",
  suspended: "danger",
};

export default function SubscriptionPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const sub = useSubscription();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const [billingPeriod, setBillingPeriod] = React.useState<"monthly" | "yearly">("monthly");
  const [actionDialog, setActionDialog] = React.useState<{
    type: "upgrade" | "downgrade" | "cancel" | "resume" | "renew";
    plan?: string;
    period?: "monthly" | "yearly";
  } | null>(null);
  const [planEditorOpen, setPlanEditorOpen] = React.useState(false);
  const [selectedAdminPlan, setSelectedAdminPlan] = React.useState<string>("basic");
  const [showHistory, setShowHistory] = React.useState(false);
  const [page, setPage] = React.useState(1);

  // Fetch invoices and payments on mount (separate queries to avoid blocking the main view)
  const invoiceQuery = useQuery({
    queryKey: ["subscription-invoices", page],
    queryFn: () => listInvoices(page),
    enabled: !!session?.user.id,
    staleTime: 60_000,
  });

  const paymentQuery = useQuery({
    queryKey: ["subscription-payments", page],
    queryFn: () => listPayments(page),
    enabled: !!session?.user.id,
    staleTime: 60_000,
  });

  const plansQuery = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: listPlans,
    staleTime: 5 * 60_000,
  });

  const handleCancel = async () => {
    try {
      await cancelSubscription();
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
      push({ title: "Subscription canceled", description: "Access continues until the end of your paid period.", variant: "success" });
    } catch (e: any) {
      push({ title: "Failed to cancel", description: e.message, variant: "error" });
    } finally {
      setActionDialog(null);
    }
  };

  // Pull the provider's current status for a pending payment. This is how a
  // sandbox checkout settles without waiting for the Midtrans webhook.
  const syncMutation = useMutation({
    mutationFn: (paymentId: string) => syncPayment(paymentId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["subscription-payments"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      const paid = result.status === "paid";
      push({
        title: paid ? "Payment confirmed" : `Payment is still ${result.status}`,
        description: paid
          ? "The subscription now reflects this payment."
          : "The provider has not settled this payment yet. Try again after paying.",
        variant: paid ? "success" : "warning",
      });
    },
    onError: (error: Error) =>
      push({ title: "Could not check the payment", description: error.message, variant: "error" }),
  });

  const handleResume = async () => {
    try {
      await resumeSubscription();
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
      push({ title: "Subscription resumed", description: "Your subscription is now active again.", variant: "success" });
    } catch (e: any) {
      push({ title: "Failed to resume", description: e.message, variant: "error" });
    } finally {
      setActionDialog(null);
    }
  };

  const canManage = sub.data?.canManage ?? false;
  const currentSlug = sub.plan?.slug ?? "trial";
  const syncingPaymentId = syncMutation.isPending ? (syncMutation.variables ?? null) : null;

  if (!canManage && !sub.isActive) {
    return (
      <div className="stack">
        <PageHeader title="Subscription" description="Manage your plan and billing details." />
        <div className="card" style={{ padding: 20 }}>
          <p>You do not have access to manage subscriptions. Ask your workspace owner for permission.</p>
        </div>
      </div>
    );
  }

  const usageMetrics = sub.usage.filter((u) => u.metric !== "exports_per_month");

  return (
    <div className="stack-lg">
      <PageHeader
        title="Subscription & Billing"
        description="Current plan, usage limits, invoices, and payment methods."
      />

      {/* Plan overview */}
      <Card>
        <CardHeader
          title={
            <div className="row row-tight" style={{ gap: 12 }}>
              <h3>{sub.plan?.name || "Free Trial"}</h3>
              <Badge tone={STATUS_BADGE[sub.status] || "neutral"} dot>
                {sub.status.replace("_", " ").replace(/\b\w/, (c) => c.toUpperCase())}
              </Badge>
              {sub.subscription.cancelAtPeriodEnd && (
                <Badge tone="warning">Cancels at period end</Badge>
              )}
            </div>
          }
        />
        <CardBody className="stack-sm">
          {/* Trial info */}
          {sub.trialDaysRemaining > 0 && (
            <div className="row" style={{ gap: 12, alignItems: "center" }}>
              <Info style={{ width: 14, height: 14, color: "hsl(var(--info))", flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: 13 }}>
                Trial expires in <strong>{sub.trialDaysRemaining} day{sub.trialDaysRemaining !== 1 ? "s" : ""}</strong>{" "}
                ({formatDate(sub.subscription.trialEndsAt!)})
              </span>
            </div>
          )}

          {/* Dates */}
          <div className="row" style={{ gap: 24, flexWrap: "wrap", marginTop: 8 }}>
            {sub.subscription.startsAt && (
              <span className="hint">Started: {formatDate(sub.subscription.startsAt)}</span>
            )}
            {sub.subscription.endsAt && (
              <span className="hint">Next billing: {formatDate(sub.subscription.endsAt)}</span>
            )}
            {sub.subscription.graceEndsAt && (
              <span className="hint text-danger">Grace period ends: {formatDate(sub.subscription.graceEndsAt)}</span>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Available plans */}
      {plansQuery.data && !sub.plan?.isTrial && (
        <Card>
          <CardHeader
            title="Available plans"
            description="Switch to a different plan or change billing period."
            actions={
              <Segmented
                options={[
                  { value: "monthly", label: "Monthly" },
                  { value: "yearly", label: "Yearly" },
                ]}
                value={billingPeriod}
                onChange={(v: string) => setBillingPeriod(v as "monthly" | "yearly")}
                label="Billing period"
              />
            }
          />
          <CardBody className="stack">
            {plansQuery.data.plans.map((plan) => {
              const price = billingPeriod === "yearly" ? plan.prices.yearly : plan.prices.monthly;
              const isCurrent = plan.slug === currentSlug;
              const isHigher = plan.sortOrder > (sub.plan?.sortOrder ?? 0);
              return (
                <div key={plan.slug} className="setting-row" style={{ alignItems: "center" }}>
                  <div className="setting-row__icon">{plan.isTrial ? "🆓" : "⭐"}</div>
                  <div className="setting-row__body" style={{ minWidth: 0 }}>
                    <b>{plan.name}</b> — {formatCurrency(price)}
                    <span className="hint">{plan.description}</span>
                  </div>
                  {isCurrent ? (
                    <Badge tone="success">Current</Badge>
                  ) : isHigher ? (
                    <Button size="sm" onClick={() => setActionDialog({ type: "upgrade", plan: plan.slug })}>
                      Upgrade
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setActionDialog({ type: "downgrade", plan: plan.slug })}>
                      Downgrade
                    </Button>
                  )}
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      {/* Usage meters */}
      <Card>
        <CardHeader
          title="Usage"
          description="How close you are to your plan limits."
        />
        <CardBody>
          {usageMetrics.map((m) => (
            <React.Fragment key={m.metric}>
              <Badge tone={m.level === "ok" ? "neutral" : m.level === "warning" ? "warning" : m.level === "critical" ? "warning" : "danger"}>
                {m.label}
              </Badge>
            </React.Fragment>
          ))}
          <div className="grid-2" style={{ gap: 16, marginTop: 12 }}>
            {usageMetrics.map((m) => (
              <div key={m.metric}>
                <div className="row between" style={{ gap: 8 }}>
                  <span style={{ fontSize: 13 }}>{m.label}</span>
                  <span className="num" style={{ fontSize: 12 }}>
                    {new Intl.NumberFormat().format(m.used)}
                    {!m.unlimited && m.limit != null && `/ ${new Intl.NumberFormat().format(m.limit)}`}
                    {m.unlimited && <span className="hint"> Unlimited</span>}
                  </span>
                </div>
                {!m.unlimited && m.limit != null && m.limit > 0 && (
                  <div className="progress" style={{ marginTop: 6 }}>
                    <span style={{ width: `${Math.min(100, m.percent)}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader title="Actions" />
        <CardBody className="stack-sm">
          {!sub.isActive && (
            <div className="alert alert--danger" style={{ padding: 12 }}>
              Your subscription is {sub.status}.{" "}
              {sub.status === "expired" && (
                <>
                  Upgrade or renew to regain access.
                  {sub.data?.openInvoice && (
                    <Button
                      variant="primary"
                      size="sm"
                      style={{ marginLeft: 12 }}
                      onClick={() => setActionDialog({ type: "renew" })}
                    >
                      Pay now
                    </Button>
                  )}
                </>
              )}
              {sub.status === "canceled" && (
                <>
                  Access continues until the end of your paid period.{" "}
                  <Button variant="primary" size="sm" style={{ marginLeft: 8 }} onClick={() => setActionDialog({ type: "resume" })}>
                    Resume
                  </Button>
                </>
              )}
              {sub.status === "past_due" && (
                <>
                  Complete your payment within the grace period.{" "}
                  <Button variant="primary" size="sm" style={{ marginLeft: 8 }} onClick={() => setActionDialog({ type: "renew" })}>
                    Renew
                  </Button>
                </>
              )}
            </div>
          )}
          {sub.isActive && sub.subscription.cancelAtPeriodEnd && (
            <div className="alert alert--warning" style={{ padding: 12 }}>
              Your subscription will be canceled at the end of the current billing period.{" "}
              <Button variant="quiet" size="sm" onClick={() => setActionDialog({ type: "resume" })}>
                Keep subscription
              </Button>
            </div>
          )}

          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {sub.isActive && (
              <Button variant="danger" size="sm" onClick={() => setActionDialog({ type: "cancel" })}>
                <Trash2 style={{ width: 14, height: 14 }} aria-hidden="true" />
                Cancel subscription
              </Button>
            )}
            {!sub.isActive && (
              <Button variant="primary" size="sm" onClick={() => setActionDialog({ type: "renew" })}>
                Renew subscription
              </Button>
            )}
            {canManage && (
              <Button variant="secondary" size="sm" onClick={() => setPlanEditorOpen(true)}>
                <Settings2 style={{ width: 14, height: 14 }} aria-hidden="true" />
                Manage plans
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader title="Invoices" />
        <CardBody>
          {invoiceQuery.isLoading ? (
            <div className="skeleton skeleton-row" />
          ) : invoiceQuery.data?.data.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <DataTable<SubscriptionInvoice>
              rows={invoiceQuery.data?.data ?? []}
              columns={invoiceColumns()}
              rowId={(r) => r.id}
              loading={false}
              empty={<EmptyState title="No invoices yet" />}
              mobile={(r) => <MobileInvoiceRow row={r} />}
            />
          )}
        </CardBody>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader title="Payment history" />
        <CardBody>
          {paymentQuery.isLoading ? (
            <div className="skeleton skeleton-row" />
          ) : paymentQuery.data?.data.length === 0 ? (
            <EmptyState title="No payments recorded" />
          ) : (
            <DataTable<SubscriptionPayment>
              rows={paymentQuery.data?.data ?? []}
              columns={paymentColumns({
                canManage,
                syncingId: syncingPaymentId,
                onSync: (payment) => syncMutation.mutate(payment.id),
              })}
              rowId={(r) => r.id}
              loading={false}
              empty={<EmptyState title="No payments recorded" />}
              mobile={(r) => (
                <MobilePaymentRow
                  row={r}
                  canManage={canManage}
                  syncing={syncingPaymentId === r.id}
                  onSync={() => syncMutation.mutate(r.id)}
                />
              )}
            />
          )}
        </CardBody>
      </Card>

      {/* History */}
      <Card>
        <CardHeader title="Activity log" description="Recent subscription changes and events." />
        <CardBody>
          <DataTable<SubscriptionHistoryEntry>
            rows={[]}
            columns={historyColumns()}
            rowId={(r) => r.id}
            loading={!sub.data}
            empty={<EmptyState title="No activity yet" />}
            mobile={(r) => <MobileHistoryRow row={r} />}
          />
        </CardBody>
      </Card>

      {/* Action dialog */}
      {actionDialog?.type === "cancel" && (
        <ConfirmDialog
          open onClose={() => setActionDialog(null)} onConfirm={handleCancel} title="Cancel subscription?"
          confirmLabel="Cancel" cancelLabel="Keep" tone="danger"
          description="You will keep access until the end of your current billing period. No further charges will be made."
        />
      )}
      {actionDialog?.type === "resume" && (
        <ConfirmDialog
          open onClose={() => setActionDialog(null)} onConfirm={handleResume} title="Resume subscription?"
          confirmLabel="Resume" cancelLabel="No thanks"
          description="Your subscription will become active immediately with no additional charge."
        />
      )}

      {/* Plan editor sheet */}
      {planEditorOpen && (
        <Sheet
          open onClose={() => setPlanEditorOpen(false)}
          title="Manage plans"
          description="Update prices, limits, and feature availability for each plan."
        >
          <div className="stack-sm">
            <div className="field">
              <label className="field__label">Plan</label>
              <select
                className="select"
                value={selectedAdminPlan}
                onChange={(e) => setSelectedAdminPlan(e.target.value)}
              >
                <option value="trial">Free Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <p className="muted hint">Use the admin panel at /admin to edit plan configurations in detail.</p>
            <Button block variant="secondary" onClick={() => window.open("/admin", "_blank")}>
              Open admin console
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ──────────────── column definitions ──────────────── */

function invoiceColumns(): Column<SubscriptionInvoice>[] {
  return [
    { id: "number", header: "Invoice", cell: (r) => <code style={{ fontSize: 12 }}>{r.number}</code>, width: 180 },
    { id: "plan", header: "Plan", cell: (r) => r.plan?.name ?? "—" },
    { id: "total", header: "Total", align: "right", cell: (r) => formatCurrency(r.total), sortValue: (r) => r.total },
    { id: "status", header: "Status", cell: (r) => <Badge tone={r.status === "paid" ? "success" : r.status === "open" ? "warning" : "neutral"}>{r.status}</Badge> },
    { id: "issued", header: "Issued", cell: (r) => r.issuedAt ? formatDate(r.issuedAt) : "—" },
    { id: "paid", header: "Paid", cell: (r) => r.paidAt ? formatDate(r.paidAt) : "—" },
  ];
}

function paymentColumns({
  canManage,
  syncingId,
  onSync,
}: {
  canManage: boolean;
  syncingId: string | null;
  onSync: (payment: SubscriptionPayment) => void;
}): Column<SubscriptionPayment>[] {
  return [
    { id: "id", header: "ID", cell: (r) => <code style={{ fontSize: 11 }}>{r.id.slice(0, 12)}…</code>, width: 120 },
    { id: "provider", header: "Provider", cell: (r) => r.provider },
    { id: "amount", header: "Amount", align: "right", cell: (r) => formatCurrency(r.amount), sortValue: (r) => r.amount },
    { id: "status", header: "Status", cell: (r) => <Badge tone={r.status === "paid" ? "success" : r.status === "pending" ? "warning" : "danger"}>{r.status}</Badge> },
    { id: "created", header: "Created", cell: (r) => formatDate(r.createdAt) },
    { id: "paid_at", header: "Paid", cell: (r) => r.paidAt ? formatDateTime(r.paidAt) : "—" },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            cell: (r: SubscriptionPayment) =>
              r.status === "pending" ? (
                <Button
                  size="sm"
                  variant="quiet"
                  loading={syncingId === r.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSync(r);
                  }}
                >
                  <RefreshCw style={{ width: 13, height: 13 }} aria-hidden="true" />
                  Check status
                </Button>
              ) : null,
          },
        ]
      : []),
  ];
}

function historyColumns(): Column<SubscriptionHistoryEntry>[] {
  return [
    { id: "action", header: "Action", cell: (r) => r.action.replace(/_/g, " ") },
    { id: "fromTo", header: "Transition", cell: (r) => (
      <span>
        {r.fromPlan?.name ?? r.fromStatus ?? "—"} → {r.toPlan?.name ?? r.toStatus ?? "—"}
      </span>
    )},
    { id: "actor", header: "Actor", cell: (r) => r.actor?.name ?? "System" },
    { id: "createdAt", header: "Date", cell: (r) => formatDateTime(r.createdAt) },
  ];
}

/* ──────────────── mobile row renderers ──────────────── */

function MobileInvoiceRow({ row }: { row: SubscriptionInvoice }) {
  return (
    <div className="record">
      <div className="record__top">
        <span className="record__title">{row.number}</span>
        <Badge tone={row.status === "paid" ? "success" : "warning"}>{row.status}</Badge>
      </div>
      <div className="record__meta">
        <span>{row.plan?.name ?? "—"}</span>
        <span><b>{formatCurrency(row.total)}</b></span>
      </div>
    </div>
  );
}

function MobilePaymentRow({
  row,
  canManage,
  syncing,
  onSync,
}: {
  row: SubscriptionPayment;
  canManage: boolean;
  syncing: boolean;
  onSync: () => void;
}) {
  return (
    <div className="record">
      <div className="record__top">
        <span className="record__title">{row.provider}</span>
        <Badge tone={row.status === "paid" ? "success" : "warning"}>{row.status}</Badge>
      </div>
      <div className="record__meta">
        <span><b>{formatCurrency(row.amount)}</b></span>
        <span>{row.id.slice(0, 12)}…</span>
      </div>
      {canManage && row.status === "pending" ? (
        <div className="row" style={{ marginTop: 8 }}>
          <Button size="sm" variant="secondary" loading={syncing} onClick={onSync}>
            <RefreshCw style={{ width: 13, height: 13 }} aria-hidden="true" />
            Check payment status
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function MobileHistoryRow({ row }: { row: SubscriptionHistoryEntry }) {
  return (
    <div className="record">
      <div className="record__top">
        <span className="record__title">{row.action.replace(/_/g, " ")}</span>
      </div>
      <div className="record__meta">
        <span>{row.fromStatus ?? "—"} → {row.toStatus ?? "—"}</span>
        <span>{formatDateTime(row.createdAt)}</span>
      </div>
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty empty--compact">
      <p>{title}</p>
    </div>
  );
}
