"use client";

export const instant = false;

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LifeBuoy, Search, Send, Settings2 } from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Button, Field, Input, Tabs, Textarea } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  getPlatformOverview,
  getPlatformSettings,
  listPlatformTickets,
  listPlatformTenants,
  replyPlatformTicket,
  updatePlatformSettings,
  type PlatformTenant,
  type PlatformTicket,
} from "@/lib/api/platform";
import { useAuth } from "@/lib/auth/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/formatting/currency";

type TabId = "overview" | "tenants" | "tickets" | "settings";

export default function PlatformAdminPage() {
  const { session } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<TabId>("overview");
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 250);
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const [replyBody, setReplyBody] = React.useState("");
  const [settingsDraft, setSettingsDraft] = React.useState<Record<string, string>>({});

  const isAdmin = Boolean(session?.isPlatformAdmin);

  const overview = useQuery({ queryKey: ["platform", "overview"], queryFn: getPlatformOverview, enabled: isAdmin });
  const tenants = useQuery({
    queryKey: ["platform", "tenants", debounced],
    queryFn: () => listPlatformTenants({ q: debounced.trim() || undefined }),
    enabled: isAdmin && tab === "tenants",
  });
  const tickets = useQuery({
    queryKey: ["platform", "tickets"],
    queryFn: () => listPlatformTickets(),
    enabled: isAdmin && tab === "tickets",
  });
  const settings = useQuery({
    queryKey: ["platform", "settings"],
    queryFn: getPlatformSettings,
    enabled: isAdmin && tab === "settings",
  });

  React.useEffect(() => {
    if (!settings.data) return;
    const merged: Record<string, string> = {};
    for (const [key, meta] of Object.entries(settings.data.defaults)) {
      merged[key] = String(meta.value ?? "");
    }
    for (const row of settings.data.settings) {
      merged[row.key] = String(row.value ?? "");
    }
    setSettingsDraft(merged);
  }, [settings.data]);

  const reply = useMutation({
    mutationFn: () => replyPlatformTicket(replyTo as string, replyBody),
    onSuccess: () => {
      push({ title: "Reply sent", variant: "success" });
      setReplyTo(null);
      setReplyBody("");
      queryClient.invalidateQueries({ queryKey: ["platform", "tickets"] });
    },
    onError: (error) => push({ title: "Could not reply", description: String(error), variant: "error" }),
  });

  const save = useMutation({
    mutationFn: () => updatePlatformSettings(settingsDraft),
    onSuccess: () => {
      push({ title: "Platform settings saved", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["platform", "settings"] });
    },
    onError: (error) => push({ title: "Could not save settings", description: String(error), variant: "error" }),
  });

  if (!isAdmin) {
    return <AccessDenied permission="platform.admin" />;
  }

  const tenantColumns: Column<PlatformTenant>[] = [
    {
      id: "name",
      header: "Business",
      sortable: true,
      sortValue: (row) => row.name,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div className="hint">{row.industry ?? "No industry"} · {row.slug}</div>
        </div>
      ),
    },
    { id: "status", header: "Status", cell: (row) => <Badge tone={row.status === "active" ? "success" : "neutral"}>{row.status}</Badge> },
    { id: "plan", header: "Plan", cell: (row) => row.subscription?.plan ?? "—" },
    { id: "sub", header: "Subscription", cell: (row) => <Badge tone={row.subscription?.status === "active" ? "success" : "warning"}>{row.subscription?.status ?? "none"}</Badge> },
    { id: "outlets", header: "Outlets", align: "right", cell: (row) => row.outlets ?? 0 },
    { id: "members", header: "Members", align: "right", cell: (row) => row.members ?? 0 },
    { id: "created", header: "Joined", cell: (row) => <span className="cell-muted">{formatDateTime(row.createdAt)}</span> },
  ];

  const ticketColumns: Column<PlatformTicket>[] = [
    {
      id: "subject",
      header: "Ticket",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.subject}</div>
          <div className="hint">{row.number} · {row.business ?? "No business"}</div>
        </div>
      ),
    },
    { id: "priority", header: "Priority", cell: (row) => <Badge tone={row.priority === "high" || row.priority === "urgent" ? "danger" : "neutral"}>{row.priority}</Badge> },
    { id: "status", header: "Status", cell: (row) => <Badge tone={row.status === "open" ? "info" : row.status === "closed" ? "neutral" : "warning"}>{row.status}</Badge> },
    { id: "who", header: "Raised by", cell: (row) => row.createdBy ?? "—" },
    { id: "created", header: "Created", cell: (row) => <span className="cell-muted">{formatDateTime(row.createdAt)}</span> },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button size="sm" variant="quiet" onClick={() => setReplyTo(row.id)}>
          <Send aria-hidden="true" /> Reply
        </Button>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Platform"
        title="Administration"
        description="Tenants, revenue, support and platform configuration across every business."
      />

      <Tabs
        items={[
          { id: "overview", label: "Overview" },
          { id: "tenants", label: "Tenants" },
          { id: "tickets", label: "Support", count: overview.data?.health.openTickets },
          { id: "settings", label: "Settings" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === "overview" ? (
        <>
          {overview.isError ? <InlineError title="Could not load the platform overview" error={overview.error} onRetry={() => overview.refetch()} /> : null}
          <div className="stat-grid">
            <Stat label="Businesses" value={formatNumber(overview.data?.businesses.total ?? 0)} foot={`${overview.data?.businesses.active ?? 0} active`} />
            <Stat label="New this month" value={formatNumber(overview.data?.businesses.newThisMonth ?? 0)} />
            <Stat label="Users" value={formatNumber(overview.data?.users.total ?? 0)} />
            <Stat label="MRR" value={formatCurrency(overview.data?.commerce.mrr ?? 0, overview.data?.commerce.currency ?? "IDR")} emphasis />
            <Stat label="Sales this month" value={formatNumber(overview.data?.commerce.salesThisMonth ?? 0)} />
            <Stat label="Revenue this month" value={formatCurrency(overview.data?.commerce.revenueThisMonth ?? 0, overview.data?.commerce.currency ?? "IDR")} />
            <Stat label="Open tickets" value={formatNumber(overview.data?.health.openTickets ?? 0)} />
            <Stat label="Failed webhooks (24h)" value={formatNumber(overview.data?.health.failedWebhooks24h ?? 0)} />
          </div>

          <Card>
            <CardHeader title="Recent signups" />
            <CardBody>
              {(overview.data?.recentSignups ?? []).length === 0 ? (
                <p className="hint">No businesses yet.</p>
              ) : (
                <div className="stack-sm">
                  {overview.data?.recentSignups.map((row) => (
                    <div key={row.id} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{row.name}</div>
                        <div className="hint">{row.industry ?? "No industry"} · {row.plan ?? "No plan"}</div>
                      </div>
                      <Badge tone={row.subscriptionStatus === "active" ? "success" : "warning"}>{row.subscriptionStatus ?? "none"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      {tab === "tenants" ? (
        <Card>
          <CardHeader
            title="Tenants"
            description={`${tenants.data?.length ?? 0} businesses`}
            actions={
              <div className="input-icon">
                <Search aria-hidden="true" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search businesses" aria-label="Search tenants" />
              </div>
            }
          />
          <CardBody>
            {tenants.isError ? (
              <InlineError title="Could not load tenants" error={tenants.error} onRetry={() => tenants.refetch()} />
            ) : (
              <DataTable rows={tenants.data ?? []} columns={tenantColumns} rowId={(row) => row.id} loading={tenants.isPending} empty={<p className="hint">No matching tenants.</p>} />
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === "tickets" ? (
        <Card>
          <CardHeader title="Support inbox" description="Tickets raised by any tenant." />
          <CardBody>
            {tickets.isError ? (
              <InlineError title="Could not load tickets" error={tickets.error} onRetry={() => tickets.refetch()} />
            ) : (
              <DataTable rows={tickets.data ?? []} columns={ticketColumns} rowId={(row) => row.id} loading={tickets.isPending} empty={<p className="hint">No tickets open.</p>} />
            )}
            {replyTo ? (
              <form
                className="stack-sm"
                style={{ marginTop: 16 }}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (replyBody.trim()) reply.mutate();
                }}
              >
                <Field label="Reply" htmlFor="admin-ticket-reply">
                  <Textarea id="admin-ticket-reply" rows={3} value={replyBody} onChange={(event) => setReplyBody(event.target.value)} />
                </Field>
                <div className="row" style={{ gap: 8 }}>
                  <Button type="submit" variant="primary" loading={reply.isPending} disabled={!replyBody.trim()}>
                    <Send aria-hidden="true" /> Send reply
                  </Button>
                  <Button variant="quiet" onClick={() => setReplyTo(null)}>Cancel</Button>
                </div>
              </form>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {tab === "settings" ? (
        <Card>
          <CardHeader title="Platform settings" description="Runtime overrides for support, signup and billing defaults." />
          <CardBody>
            {settings.isError ? (
              <InlineError title="Could not load settings" error={settings.error} onRetry={() => settings.refetch()} />
            ) : (
              <form
                className="stack-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  save.mutate();
                }}
              >
                {Object.entries(settings.data?.defaults ?? {}).map(([key, meta]) => (
                  <Field key={key} label={key} htmlFor={`platform-${key}`} hint={meta.description}>
                    <Input
                      id={`platform-${key}`}
                      value={settingsDraft[key] ?? ""}
                      onChange={(event) => setSettingsDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                    />
                  </Field>
                ))}
                <Button type="submit" variant="primary" loading={save.isPending}>
                  <Settings2 aria-hidden="true" /> Save settings
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
