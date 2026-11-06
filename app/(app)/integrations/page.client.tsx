"use client";

export const instant = false;

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, RefreshCw, RotateCcw, Send, Trash2, Webhook } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Badge, Button, EmptyState, Field, Input, Select, Tabs } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  WEBHOOK_EVENTS,
  createApiKey,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listApiKeys,
  listWebhookDeliveries,
  listWebhookEndpoints,
  retryWebhookDelivery,
  revokeApiKey,
  rotateApiKey,
  testWebhookEndpoint,
  type ApiKey,
  type WebhookDelivery,
} from "@/lib/api/integrations";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatDateTime } from "@/lib/formatting/currency";

type TabId = "keys" | "webhooks";

export default function IntegrationsPage() {
  const { has } = usePermissions();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<TabId>("keys");

  const [keyName, setKeyName] = React.useState("");
  const [keyScope, setKeyScope] = React.useState("read");
  const [newKey, setNewKey] = React.useState<string | null>(null);

  const [hookName, setHookName] = React.useState("");
  const [hookUrl, setHookUrl] = React.useState("");
  const [hookEvent, setHookEvent] = React.useState(WEBHOOK_EVENTS[0]);
  const [newSecret, setNewSecret] = React.useState<string | null>(null);

  const keys = useQuery({ queryKey: ["integration", "keys"], queryFn: listApiKeys, enabled: has("api_keys.view") });
  const hooks = useQuery({
    queryKey: ["integration", "webhooks"],
    queryFn: listWebhookEndpoints,
    enabled: has("webhooks.view"),
  });
  const deliveries = useQuery({
    queryKey: ["integration", "deliveries"],
    queryFn: () => listWebhookDeliveries(),
    enabled: has("webhooks.view") && tab === "webhooks",
  });

  const createKey = useMutation({
    mutationFn: () => createApiKey({ name: keyName, scopes: keyScope === "write" ? ["read", "write"] : ["read"] }),
    onSuccess: (data) => {
      setNewKey(data.key);
      setKeyName("");
      queryClient.invalidateQueries({ queryKey: ["integration", "keys"] });
    },
    onError: (error) => push({ title: "Could not create the key", description: String(error), variant: "error" }),
  });

  const revoke = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      push({ title: "Key revoked", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["integration", "keys"] });
    },
  });

  const rotate = useMutation({
    mutationFn: rotateApiKey,
    onSuccess: (value) => {
      setNewKey(value);
      queryClient.invalidateQueries({ queryKey: ["integration", "keys"] });
    },
  });

  const createHook = useMutation({
    mutationFn: () => createWebhookEndpoint({ name: hookName, url: hookUrl, events: [hookEvent] }),
    onSuccess: (data) => {
      setNewSecret(data.secret);
      setHookName("");
      setHookUrl("");
      queryClient.invalidateQueries({ queryKey: ["integration", "webhooks"] });
    },
    onError: (error) => push({ title: "Could not create the endpoint", description: String(error), variant: "error" }),
  });

  const removeHook = useMutation({
    mutationFn: deleteWebhookEndpoint,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration", "webhooks"] }),
  });

  const testHook = useMutation({
    mutationFn: testWebhookEndpoint,
    onSuccess: (delivery) => {
      push({
        title: delivery.status === "delivered" ? "Test delivered" : "Test failed",
        description: delivery.responseStatus ? `HTTP ${delivery.responseStatus}` : undefined,
        variant: delivery.status === "delivered" ? "success" : "error",
      });
      queryClient.invalidateQueries({ queryKey: ["integration"] });
    },
  });

  const retry = useMutation({
    mutationFn: retryWebhookDelivery,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration", "deliveries"] }),
  });

  if (!has("api_keys.view") && !has("webhooks.view")) {
    return <AccessDenied permission="api_keys.view" />;
  }

  const keyColumns: Column<ApiKey>[] = [
    {
      id: "name",
      header: "Key",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div className="hint num">{row.prefix}_…</div>
        </div>
      ),
    },
    {
      id: "scopes",
      header: "Access",
      cell: (row) => <span className="cell-muted">{row.scopes.join(", ")}</span>,
    },
    { id: "rate", header: "Rate limit", align: "right", cell: (row) => `${row.rateLimit}/min` },
    {
      id: "used",
      header: "Last used",
      cell: (row) => <span className="cell-muted">{row.lastUsedAt ? formatDateTime(row.lastUsedAt) : "Never"}</span>,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
          <Button size="sm" variant="quiet" onClick={() => rotate.mutate(row.id)} loading={rotate.isPending}>
            <RotateCcw aria-hidden="true" /> Rotate
          </Button>
          <Button size="sm" variant="danger-quiet" onClick={() => revoke.mutate(row.id)} disabled={revoke.isPending}>
            <Trash2 aria-hidden="true" /> Revoke
          </Button>
        </div>
      ),
    },
  ];

  const deliveryColumns: Column<WebhookDelivery>[] = [
    { id: "event", header: "Event", cell: (row) => <span className="num">{row.event}</span> },
    { id: "endpoint", header: "Endpoint", cell: (row) => row.endpoint ?? "—" },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge tone={row.status === "delivered" ? "success" : row.status === "failed" ? "danger" : "warning"}>
          {row.status}
        </Badge>
      ),
    },
    { id: "response", header: "Response", align: "right", cell: (row) => row.responseStatus ?? "—" },
    { id: "attempts", header: "Attempts", align: "right", cell: (row) => row.attempts },
    { id: "created", header: "When", cell: (row) => <span className="cell-muted">{formatDateTime(row.createdAt)}</span> },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) =>
        row.status === "failed" ? (
          <Button size="sm" variant="quiet" onClick={() => retry.mutate(row.id)} loading={retry.isPending}>
            <RefreshCw aria-hidden="true" /> Retry
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Manage"
        title="Integrations"
        description="Machine credentials for the API and signed webhooks for external systems."
      />

      <Tabs
        items={[
          { id: "keys", label: "API keys" },
          { id: "webhooks", label: "Webhooks" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === "keys" && has("api_keys.view") ? (
        <>
          {newKey ? (
            <Alert tone="warning" title="Copy this key now">
              <span className="num" style={{ wordBreak: "break-all" }}>{newKey}</span>
              <div style={{ marginTop: 6 }}>
                <Button size="sm" onClick={() => setNewKey(null)}>Done</Button>
              </div>
            </Alert>
          ) : null}

          {has("api_keys.manage") ? (
            <Card>
              <CardHeader title="New API key" description="Read-only keys can fetch data; read + write keys can create and update." />
              <CardBody>
                <form
                  className="row"
                  style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (keyName.trim()) createKey.mutate();
                  }}
                >
                  <Field label="Name" htmlFor="api-key-name">
                    <Input id="api-key-name" value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="Accounting sync" />
                  </Field>
                  <Field label="Access" htmlFor="api-key-scope">
                    <Select id="api-key-scope" value={keyScope} onChange={(event) => setKeyScope(event.target.value)}>
                      <option value="read">Read only</option>
                      <option value="write">Read + write</option>
                    </Select>
                  </Field>
                  <Button type="submit" variant="primary" loading={createKey.isPending} disabled={!keyName.trim()}>
                    <Plus aria-hidden="true" /> Create key
                  </Button>
                </form>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Keys" description="Only the prefix is stored for display; the secret itself is hashed." />
            <CardBody>
              {keys.isError ? (
                <InlineError title="Could not load API keys" error={keys.error} onRetry={() => keys.refetch()} />
              ) : (
                <DataTable
                  rows={(keys.data ?? []).filter((key) => !key.revokedAt)}
                  columns={keyColumns}
                  rowId={(row) => row.id}
                  loading={keys.isPending}
                  empty={<EmptyState compact icon={<KeyRound aria-hidden="true" />} title="No API keys" description="Create one to connect an external system." />}
                />
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      {tab === "webhooks" && has("webhooks.view") ? (
        <>
          {newSecret ? (
            <Alert tone="warning" title="Signing secret">
              <span className="num" style={{ wordBreak: "break-all" }}>{newSecret}</span>
              <div style={{ marginTop: 6 }}>
                <Button size="sm" onClick={() => setNewSecret(null)}>Done</Button>
              </div>
            </Alert>
          ) : null}

          {has("webhooks.manage") ? (
            <Card>
              <CardHeader title="New webhook" description="We POST a signed JSON envelope when the event fires." />
              <CardBody>
                <form
                  className="row"
                  style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (hookName.trim() && hookUrl.trim()) createHook.mutate();
                  }}
                >
                  <Field label="Name" htmlFor="hook-name">
                    <Input id="hook-name" value={hookName} onChange={(event) => setHookName(event.target.value)} placeholder="Accounting sync" />
                  </Field>
                  <Field label="URL" htmlFor="hook-url">
                    <Input id="hook-url" value={hookUrl} onChange={(event) => setHookUrl(event.target.value)} placeholder="https://example.test/hooks/velora" />
                  </Field>
                  <Field label="Event" htmlFor="hook-event">
                    <Select id="hook-event" value={hookEvent} onChange={(event) => setHookEvent(event.target.value)}>
                      {WEBHOOK_EVENTS.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </Select>
                  </Field>
                  <Button type="submit" variant="primary" loading={createHook.isPending} disabled={!hookName.trim() || !hookUrl.trim()}>
                    <Plus aria-hidden="true" /> Create
                  </Button>
                </form>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Endpoints" />
            <CardBody>
              {hooks.isError ? (
                <InlineError title="Could not load endpoints" error={hooks.error} onRetry={() => hooks.refetch()} />
              ) : (hooks.data?.endpoints ?? []).length === 0 ? (
                <EmptyState compact icon={<Webhook aria-hidden="true" />} title="No webhooks" description="Add an endpoint to receive events." />
              ) : (
                <div className="stack-sm">
                  {(hooks.data?.endpoints ?? []).map((endpoint) => (
                    <div key={endpoint.id} className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div className="row" style={{ gap: 8 }}>
                          <strong>{endpoint.name}</strong>
                          <Badge tone={endpoint.active ? "success" : "neutral"}>{endpoint.active ? "Active" : "Paused"}</Badge>
                          {endpoint.failureCount > 0 ? <Badge tone="danger">{endpoint.failureCount} failures</Badge> : null}
                        </div>
                        <div className="hint">{endpoint.url} · {endpoint.events.join(", ") || "all events"}</div>
                      </div>
                      {has("webhooks.manage") ? (
                        <div className="row" style={{ gap: 4 }}>
                          <Button size="sm" variant="quiet" onClick={() => testHook.mutate(endpoint.id)} loading={testHook.isPending}>
                            <Send aria-hidden="true" /> Test
                          </Button>
                          <Button size="sm" variant="danger-quiet" onClick={() => removeHook.mutate(endpoint.id)}>
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Delivery log" description="Signature: t=<timestamp>,v1=HMAC-SHA256(t.body, secret)." />
            <CardBody>
              <DataTable
                rows={deliveries.data ?? []}
                columns={deliveryColumns}
                rowId={(row) => row.id}
                loading={deliveries.isPending}
                empty={<p className="hint">No deliveries yet.</p>}
              />
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
