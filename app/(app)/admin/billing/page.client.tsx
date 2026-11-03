"use client";

// Opt out of instant-navigation validation: these pages render data-dependent client UI.
export const instant = false;

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CreditCard, Search, ShieldCheck, X } from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Segmented,
  Select,
  StatusBadge,
} from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { AccessDenied, InlineError, SectionSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  adminChangePlan,
  adminExtendTrial,
  adminReactivate,
  adminSuspend,
  adminConfirmPayment,
  getAdminBusiness,
  getAdminOverview,
  listAdminBusinesses,
  listAdminPayments,
  listAdminPlans,
  updateAdminPlan,
} from "@/lib/api/admin";
import type { AdminBusinessRow, BillingPeriod, PlanApi, SubscriptionPayment } from "@/lib/api/types";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/formatting/currency";
import { useAuth } from "@/lib/auth/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced";

type Tab = "businesses" | "payments" | "plans";

const STATUS_OPTIONS = ["trialing", "active", "past_due", "canceled", "expired", "suspended"];

export default function AdminBillingPage() {
  const { session } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = Boolean(session?.isPlatformAdmin);

  const [tab, setTab] = React.useState<Tab>("businesses");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [paymentStatus, setPaymentStatus] = React.useState("");
  const [selected, setSelected] = React.useState<AdminBusinessRow | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const overviewQuery = useQuery({ queryKey: ["admin-overview"], queryFn: getAdminOverview, enabled: isAdmin });
  const businessesQuery = useQuery({
    queryKey: ["admin-businesses", status, debouncedSearch],
    queryFn: () => listAdminBusinesses({ status: status || undefined, q: debouncedSearch || undefined }),
    enabled: isAdmin && tab === "businesses",
  });
  const paymentsQuery = useQuery({
    queryKey: ["admin-payments", paymentStatus],
    queryFn: () => listAdminPayments({ status: paymentStatus || undefined }),
    enabled: isAdmin && tab === "payments",
  });
  const plansQuery = useQuery({
    queryKey: ["admin-plans"],
    queryFn: listAdminPlans,
    enabled: isAdmin && (tab === "plans" || Boolean(selected)),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => adminConfirmPayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      push({ title: "Payment confirmed", description: "The subscription payment is marked paid.", variant: "success" });
    },
    onError: (error: Error) => push({ title: "Could not confirm", description: error.message, variant: "error" }),
  });

  if (!isAdmin) {
    return (
      <div className="page">
        <PageHeader title="Admin billing" description="Platform subscriptions, revenue and plan pricing." />
        <AccessDenied
          permission="platform.admin"
          title="Platform administrators only"
          description="This screen manages billing across every business on Velora."
        />
      </div>
    );
  }

  const overview = overviewQuery.data;
  const currency = overview?.currency ?? "IDR";

  const businessColumns: Column<AdminBusinessRow>[] = [
    {
      id: "business",
      header: "Business",
      cell: (row) => (
        <div className="stack-sm" style={{ gap: 2 }}>
          <b>{row.name}</b>
          <span className="hint mono">{row.slug}</span>
        </div>
      ),
    },
    {
      id: "plan",
      header: "Plan",
      cell: (row) => (
        <div className="stack-sm" style={{ gap: 2 }}>
          <span>{row.subscription?.planName ?? "No plan"}</span>
          <span className="hint">{row.subscription?.billingPeriod ?? "—"}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.subscription?.status ?? "none"} label={row.subscription?.status ?? "No subscription"} />,
    },
    {
      id: "days",
      header: "Days left",
      align: "right",
      cell: (row) => <span className="num">{row.subscription ? formatNumber(row.subscription.daysRemaining) : "—"}</span>,
    },
    {
      id: "usage",
      header: "Usage",
      cell: (row) => (
        <span className="hint">
          {formatNumber(row.usage.outlets)} outlets · {formatNumber(row.usage.users)} users ·{" "}
          {formatNumber(row.usage.transactionsPerMonth)} tx/mo
        </span>
      ),
    },
    {
      id: "action",
      header: "Action",
      align: "right",
      cell: (row) => (
        <Button
          variant="quiet"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(row);
          }}
        >
          Manage
        </Button>
      ),
    },
  ];

  const paymentColumns: Column<SubscriptionPayment>[] = [
    {
      id: "provider",
      header: "Provider",
      cell: (row) => (
        <div className="stack-sm" style={{ gap: 2 }}>
          <b>{row.provider}</b>
          <span className="hint mono">{row.providerReference ?? "—"}</span>
        </div>
      ),
    },
    { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
    { id: "amount", header: "Amount", align: "right", cell: (row) => formatCurrency(row.amount, row.currency || currency) },
    { id: "created", header: "Created", cell: (row) => <span className="cell-muted">{formatDateTime(row.createdAt)}</span> },
    {
      id: "action",
      header: "Action",
      align: "right",
      cell: (row) =>
        row.status === "pending" ? (
          <Button
            variant="quiet"
            size="sm"
            loading={confirmMutation.isPending && confirmMutation.variables === row.id}
            onClick={() => confirmMutation.mutate(row.id)}
          >
            Confirm
          </Button>
        ) : (
          <span className="hint">{row.paidAt ? formatDateTime(row.paidAt) : "—"}</span>
        ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Admin billing"
        eyebrow="Platform"
        description="Subscriptions across every business, plus the plan pricing that drives them."
        actions={
          <Badge tone="brand">
            <ShieldCheck aria-hidden="true" style={{ width: 13, height: 13 }} /> Platform admin
          </Badge>
        }
      />

      {overviewQuery.isError ? (
        <InlineError title="Billing overview could not be loaded" error={overviewQuery.error} onRetry={() => overviewQuery.refetch()} />
      ) : (
        <div className="grid-4">
          <Stat compact label="Businesses" value={overview ? formatNumber(overview.businesses) : "—"} info="Every business on the platform." />
          <Stat compact label="MRR" value={overview ? formatCurrency(overview.mrr, currency) : "—"} info="Monthly recurring revenue from active plans." />
          <Stat
            compact
            label="Revenue this month"
            value={overview ? formatCurrency(overview.revenueThisMonth, currency) : "—"}
            info="Payments recorded since the start of the month."
          />
          <Stat
            compact
            label="All-time revenue"
            value={overview ? formatCurrency(overview.revenueAllTime, currency) : "—"}
            info="Every paid subscription payment."
          />
        </div>
      )}

      {overview ? (
        <Card>
          <CardHeader title="Plan distribution" description={`Trial ${overview.trialDays} days · grace ${overview.graceDays} days`} />
          <CardBody className="stack-sm">
            {overview.planDistribution.length === 0 ? (
              <p className="hint">No plans configured yet.</p>
            ) : (
              overview.planDistribution.map((plan) => (
                <div key={plan.slug} className="row row-between">
                  <span className="row row-tight" style={{ gap: 8 }}>
                    <b>{plan.name}</b>
                    <span className="hint" style={{ margin: 0 }}>
                      {formatCurrency(plan.monthlyPrice, currency)}/mo · {formatCurrency(plan.yearlyPrice, currency)}/yr
                    </span>
                  </span>
                  <Badge tone={plan.active ? "success" : "neutral"}>{formatNumber(plan.active)} active</Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <div className="toolbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <Segmented
            label="Admin billing view"
            options={[
              { value: "businesses", label: "Businesses" },
              { value: "payments", label: "Payments" },
              { value: "plans", label: "Plans" },
            ]}
            value={tab}
            onChange={(value) => setTab(value as Tab)}
          />
          <div className="spacer" />
          {tab === "businesses" ? (
            <>
              <label className="toolbar__search input-affix">
                <Search aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search business"
                  aria-label="Search businesses"
                />
                {search ? (
                  <button type="button" className="icon-btn" onClick={() => setSearch("")} aria-label="Clear search">
                    <X aria-hidden="true" />
                  </button>
                ) : null}
              </label>
              <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status" style={{ width: 150 }}>
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </>
          ) : tab === "payments" ? (
            <Select
              value={paymentStatus}
              onChange={(event) => setPaymentStatus(event.target.value)}
              aria-label="Filter payments by status"
              style={{ width: 150 }}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </Select>
          ) : (
            <span className="hint" style={{ margin: 0 }}>
              Prices are whole units of the plan currency
            </span>
          )}
        </div>

        {tab === "businesses" ? (
          businessesQuery.isError ? (
            <InlineError title="Businesses could not be loaded" error={businessesQuery.error} onRetry={() => businessesQuery.refetch()} />
          ) : (
            <DataTable
              rows={businessesQuery.data?.data ?? []}
              columns={businessColumns}
              rowId={(row) => row.id}
              loading={businessesQuery.isLoading}
              dense
              minWidth={860}
              onRowClick={(row) => setSelected(row)}
              empty={
                <EmptyState
                  icon={<Building2 aria-hidden="true" />}
                  title="No businesses match"
                  description="Try a different search or subscription status."
                />
              }
            />
          )
        ) : tab === "payments" ? (
          paymentsQuery.isError ? (
            <InlineError title="Payments could not be loaded" error={paymentsQuery.error} onRetry={() => paymentsQuery.refetch()} />
          ) : (
            <DataTable
              rows={paymentsQuery.data?.data ?? []}
              columns={paymentColumns}
              rowId={(row) => row.id}
              loading={paymentsQuery.isLoading}
              dense
              minWidth={760}
              empty={
                <EmptyState
                  icon={<CreditCard aria-hidden="true" />}
                  title="No payments yet"
                  description="Subscription payments appear here once a business checks out."
                />
              }
            />
          )
        ) : plansQuery.isError ? (
          <InlineError title="Plans could not be loaded" error={plansQuery.error} onRetry={() => plansQuery.refetch()} />
        ) : plansQuery.isLoading ? (
          <div style={{ padding: 16 }}>
            <SectionSkeleton rows={4} />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Monthly</th>
                  <th>Yearly</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(plansQuery.data?.plans ?? []).map((plan) => (
                  <PlanPriceRow
                    key={plan.id}
                    plan={plan}
                    onSaved={() => {
                      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
                      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
                      push({ title: `${plan.name} updated`, variant: "success" });
                    }}
                    onError={(message) => push({ title: "Could not update plan", description: message, variant: "error" })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="hint" style={{ margin: 0 }}>
        {tab === "businesses" && businessesQuery.data && businessesQuery.data.total > businessesQuery.data.data.length
          ? `Showing ${formatNumber(businessesQuery.data.data.length)} of ${formatNumber(businessesQuery.data.total)} businesses.`
          : "Platform actions are audit-logged against the acting administrator."}
      </p>

      <BusinessDetailDialog
        business={selected}
        onClose={() => setSelected(null)}
        plans={plansQuery.data?.plans ?? []}
        currency={currency}
        onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-businesses"] });
          queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
        }}
      />
    </div>
  );
}

function PlanPriceRow({
  plan,
  onSaved,
  onError,
}: {
  plan: PlanApi;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [monthly, setMonthly] = React.useState(String(plan.prices.monthly));
  const [yearly, setYearly] = React.useState(String(plan.prices.yearly));

  const mutation = useMutation({
    mutationFn: () =>
      updateAdminPlan(plan.id, {
        monthly_price: Math.round(Number(monthly) || 0),
        yearly_price: Math.round(Number(yearly) || 0),
      }),
    onSuccess: onSaved,
    onError: (error: Error) => onError(error.message),
  });

  const dirty = Number(monthly) !== plan.prices.monthly || Number(yearly) !== plan.prices.yearly;

  return (
    <tr>
      <td>
        <div className="stack-sm" style={{ gap: 2 }}>
          <b>{plan.name}</b>
          <span className="hint mono">{plan.slug}</span>
        </div>
      </td>
      <td>
        <Input
          type="number"
          min="0"
          value={monthly}
          onChange={(event) => setMonthly(event.target.value)}
          aria-label={`${plan.name} monthly price`}
          style={{ width: 120 }}
        />
      </td>
      <td>
        <Input
          type="number"
          min="0"
          value={yearly}
          onChange={(event) => setYearly(event.target.value)}
          aria-label={`${plan.name} yearly price`}
          style={{ width: 120 }}
        />
      </td>
      <td>
        <Badge tone={plan.isActive ? "success" : "neutral"}>{plan.isActive ? "Active" : "Inactive"}</Badge>
      </td>
      <td style={{ textAlign: "right" }}>
        <Button variant="quiet" size="sm" disabled={!dirty} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Save
        </Button>
      </td>
    </tr>
  );
}

function BusinessDetailDialog({
  business,
  onClose,
  plans,
  currency,
  onChanged,
}: {
  business: AdminBusinessRow | null;
  onClose: () => void;
  plans: PlanApi[];
  currency: string;
  onChanged: () => void;
}) {
  const { push } = useToast();
  const [planSlug, setPlanSlug] = React.useState("");
  const [period, setPeriod] = React.useState<BillingPeriod>("monthly");
  const [extendDays, setExtendDays] = React.useState("7");
  const [formError, setFormError] = React.useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["admin-business", business?.id],
    queryFn: () => getAdminBusiness(business!.id),
    enabled: Boolean(business),
  });

  React.useEffect(() => {
    if (!business) return;
    setPlanSlug(business.subscription?.plan ?? "");
    setPeriod(business.subscription?.billingPeriod ?? "monthly");
    setExtendDays("7");
    setFormError(null);
    // Reset when a different business is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  const onActionSuccess = (message: string) => {
    setFormError(null);
    onChanged();
    detailQuery.refetch();
    push({ title: message, variant: "success" });
  };

  const changePlan = useMutation({
    mutationFn: () => adminChangePlan(business!.id, { plan: planSlug, billingPeriod: period }),
    onSuccess: () => onActionSuccess("Plan changed"),
    onError: (error: Error) => setFormError(error.message),
  });
  const extendTrial = useMutation({
    mutationFn: () => adminExtendTrial(business!.id, Math.max(1, Math.round(Number(extendDays) || 0))),
    onSuccess: () => onActionSuccess("Trial extended"),
    onError: (error: Error) => setFormError(error.message),
  });
  const suspend = useMutation({
    mutationFn: () => adminSuspend(business!.id, "Suspended from admin billing"),
    onSuccess: () => onActionSuccess("Subscription suspended"),
    onError: (error: Error) => setFormError(error.message),
  });
  const reactivate = useMutation({
    mutationFn: () => adminReactivate(business!.id),
    onSuccess: () => onActionSuccess("Subscription reactivated"),
    onError: (error: Error) => setFormError(error.message),
  });

  const detail = detailQuery.data;
  const subscription = detail?.snapshot.subscription;
  const suspended = subscription?.status === "suspended";

  return (
    <Dialog
      open={Boolean(business)}
      onClose={onClose}
      title={business?.name ?? "Business"}
      description={business ? `${business.slug} · ${business.businessStatus}` : undefined}
      width={720}
      footer={
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="stack">
        {formError ? <div className="alert alert--danger">{formError}</div> : null}
        {detailQuery.isLoading ? (
          <SectionSkeleton rows={5} />
        ) : detailQuery.isError ? (
          <InlineError title="Business detail could not be loaded" error={detailQuery.error} onRetry={() => detailQuery.refetch()} />
        ) : !detail ? null : (
          <>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="stack-sm">
                <span className="hint">Subscription</span>
                <div className="row row-tight" style={{ gap: 8 }}>
                  <StatusBadge status={subscription?.status ?? "none"} />
                  <b>{subscription?.pendingPlan?.name ?? ""}</b>
                </div>
                <span className="hint" style={{ margin: 0 }}>
                  {subscription?.billingPeriod ?? "—"} · {subscription?.daysRemaining ?? 0} days left ·{" "}
                  {subscription ? formatCurrency(subscription.priceAmount, subscription.currency || currency) : "—"}
                </span>
              </div>
              <div className="stack-sm">
                <span className="hint">Usage</span>
                {detail.snapshot.usage.length === 0 ? (
                  <span className="hint" style={{ margin: 0 }}>
                    No usage recorded.
                  </span>
                ) : (
                  detail.snapshot.usage.map((metric) => (
                    <div key={metric.metric} className="row row-between">
                      <span>{metric.label}</span>
                      <span className="hint" style={{ margin: 0 }}>
                        {formatNumber(metric.used)} / {metric.unlimited ? "∞" : formatNumber(metric.limit ?? 0)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div className="stack-sm">
                <b>Actions</b>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <Field label="Plan" htmlFor="admin-plan">
                    <Select id="admin-plan" value={planSlug} onChange={(event) => setPlanSlug(event.target.value)} style={{ width: 150 }}>
                      <option value="">Current plan</option>
                      {plans.map((plan) => (
                        <option key={plan.slug} value={plan.slug}>
                          {plan.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Period" htmlFor="admin-period">
                    <Select
                      id="admin-period"
                      value={period}
                      onChange={(event) => setPeriod(event.target.value as BillingPeriod)}
                      style={{ width: 120 }}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </Select>
                  </Field>
                  <Button variant="secondary" loading={changePlan.isPending} disabled={!planSlug} onClick={() => changePlan.mutate()}>
                    Change plan
                  </Button>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <Field label="Extend trial (days)" htmlFor="admin-trial">
                    <Input
                      id="admin-trial"
                      type="number"
                      min="1"
                      value={extendDays}
                      onChange={(event) => setExtendDays(event.target.value)}
                      style={{ width: 120 }}
                    />
                  </Field>
                  <Button variant="secondary" loading={extendTrial.isPending} onClick={() => extendTrial.mutate()}>
                    Extend trial
                  </Button>
                  {suspended ? (
                    <Button variant="primary" loading={reactivate.isPending} onClick={() => reactivate.mutate()}>
                      Reactivate
                    </Button>
                  ) : (
                    <Button variant="danger" loading={suspend.isPending} onClick={() => suspend.mutate()}>
                      Suspend
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid-2" style={{ gap: 16 }}>
              <div className="stack-sm">
                <b>Invoices</b>
                {detail.invoices.length === 0 ? (
                  <span className="hint" style={{ margin: 0 }}>
                    No invoices.
                  </span>
                ) : (
                  detail.invoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="row row-between">
                      <span className="hint" style={{ margin: 0 }}>
                        {invoice.number} · {formatDateTime(invoice.issuedAt ?? invoice.createdAt)}
                      </span>
                      <span className="row row-tight" style={{ gap: 6 }}>
                        <StatusBadge status={invoice.status} />
                        <b className="num">{formatCurrency(invoice.total, invoice.currency || currency)}</b>
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="stack-sm">
                <b>Payments</b>
                {detail.payments.length === 0 ? (
                  <span className="hint" style={{ margin: 0 }}>
                    No payments.
                  </span>
                ) : (
                  detail.payments.slice(0, 5).map((payment) => (
                    <div key={payment.id} className="row row-between">
                      <span className="hint" style={{ margin: 0 }}>
                        {payment.provider} · {formatDateTime(payment.createdAt)}
                      </span>
                      <span className="row row-tight" style={{ gap: 6 }}>
                        <StatusBadge status={payment.status} />
                        <b className="num">{formatCurrency(payment.amount, payment.currency || currency)}</b>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {detail.history.length > 0 ? (
              <div className="stack-sm">
                <b>Recent history</b>
                {detail.history.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="row row-between">
                    <span className="hint" style={{ margin: 0 }}>
                      {entry.action.replace(/[._]/g, " ")}
                      {entry.fromPlan || entry.toPlan
                        ? ` · ${entry.fromPlan?.name ?? "—"} → ${entry.toPlan?.name ?? "—"}`
                        : ""}
                    </span>
                    <span className="hint" style={{ margin: 0 }}>
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
}
