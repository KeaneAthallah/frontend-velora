"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Copy,
  Globe,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Send,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Button, EmptyState, Field, Input, Select, Spinner, Switch } from "@/components/ui/primitives";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError, SectionSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

import {
  acceptChannelOrder,
  ackChannelEvent,
  channelSummary,
  createChannel,
  deleteChannel,
  listChannelEvents,
  listChannelMappings,
  listChannelOrders,
  listChannels,
  pushChannelMenu,
  rejectChannelOrder,
  rotateChannelSecret,
  saveChannelMappings,
  updateChannel,
} from "@/lib/api/channels";
import { listPaymentMethods } from "@/lib/api/payments";
import { listProducts } from "@/lib/api/products";
import type {
  ChannelCredentials,
  ChannelEvent,
  ChannelKind,
  SalesChannel,
  SalesChannelInput,
  Transaction,
} from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/formatting/currency";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";

export const instant = false;

const KINDS: { value: ChannelKind; label: string; hint: string }[] = [
  { value: "marketplace", label: "Marketplace", hint: "GoFood, GrabFood, ShopeeFood" },
  { value: "own_web", label: "Own web store", hint: "Orders from your own ordering page" },
  { value: "whatsapp", label: "WhatsApp", hint: "Orders typed from a chat" },
  { value: "phone", label: "Phone", hint: "Orders taken on a call" },
  { value: "custom", label: "Other", hint: "Anything else with a connector" },
];

const KIND_ICONS: Record<ChannelKind, React.ReactNode> = {
  marketplace: <ShoppingBag aria-hidden="true" />,
  own_web: <Globe aria-hidden="true" />,
  whatsapp: <MessageCircle aria-hidden="true" />,
  phone: <Phone aria-hidden="true" />,
  custom: <Store aria-hidden="true" />,
};

const EMPTY_FORM = {
  name: "",
  code: "",
  kind: "marketplace" as ChannelKind,
  outletId: "",
  commissionPercent: "",
  paymentMethodCode: "",
  autoAccept: false,
  prepBufferMinutes: "",
  active: true,
};

function kindLabel(kind: ChannelKind) {
  return KINDS.find((entry) => entry.value === kind)?.label ?? "Other";
}

function statusMeta(channel: SalesChannel) {
  if (!channel.active) return { label: "Paused", tone: "neutral" as const };
  if (!channel.hasCredentials) return { label: "No connector", tone: "warning" as const };
  return { label: "Live", tone: "success" as const };
}

function channelStatusTone(status?: string) {
  switch (status) {
    case "received":
      return "warning" as const;
    case "accepted":
      return "info" as const;
    case "ready":
      return "brand" as const;
    case "dispatched":
      return "info" as const;
    case "completed":
      return "success" as const;
    case "rejected":
    case "cancelled":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export default function ChannelsPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const currency = session?.business.currency ?? "IDR";
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SalesChannel | null>(null);
  const [mappingChannel, setMappingChannel] = React.useState<SalesChannel | null>(null);
  const [ordersChannel, setOrdersChannel] = React.useState<SalesChannel | null>(null);
  const [connectionChannel, setConnectionChannel] = React.useState<SalesChannel | null>(null);

  const channelsQuery = useQuery({
    queryKey: ["channels"],
    queryFn: () => listChannels(),
    enabled: has("channels.view"),
    staleTime: 60_000,
  });

  const summaryQuery = useQuery({
    queryKey: ["channel-summary"],
    queryFn: () => channelSummary(),
    enabled: has("channels.view"),
    staleTime: 60_000,
  });

  if (!has("channels.view")) {
    return <AccessDenied permission="channels.view" />;
  }

  const canManage = has("channels.manage");
  const channels = channelsQuery.data ?? [];
  const summaryFor = (id: string) => summaryQuery.data?.find((row) => row.channelId === id);

  return (
    <>
      <PageHeader
        title="Online & delivery channels"
        description="Every way guests order besides the register: marketplaces, your own web store, WhatsApp and the phone. Each channel keeps its own item ids, commission and connector."
        actions={
          canManage ? (
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <Plus aria-hidden="true" /> New channel
            </Button>
          ) : null
        }
      />

      {channelsQuery.isError ? (
        <Card>
          <CardBody>
            <div style={{ padding: 16 }}>
              <InlineError
                title="Channels could not be loaded"
                error={channelsQuery.error}
                onRetry={() => channelsQuery.refetch()}
              />
            </div>
          </CardBody>
        </Card>
      ) : channelsQuery.isLoading && !channelsQuery.data ? (
        <Card>
          <CardBody>
            <div style={{ padding: 16 }}>
              <SectionSkeleton />
            </div>
          </CardBody>
        </Card>
      ) : channels.length === 0 ? (
        <Card>
          <CardBody>
            <div style={{ padding: 16 }}>
              <EmptyState
                icon={<Truck aria-hidden="true" />}
                title="No channels yet"
                description="Add a marketplace or your own ordering page, map its items to your menu, and its orders will land on the order board like any other."
                actions={
                  canManage ? (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setEditing(null);
                        setEditorOpen(true);
                      }}
                    >
                      Add the first channel
                    </Button>
                  ) : null
                }
              />
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid-2" style={{ gap: 14 }}>
          {channels.map((channel) => {
            const summary = summaryFor(channel.id);
            const status = statusMeta(channel);
            return (
              <Card key={channel.id}>
                <CardHeader className="card__head">
                  <div className="row" style={{ minWidth: 0 }}>
                    <span className="setting-row__icon" aria-hidden="true">
                      {KIND_ICONS[channel.kind]}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="row row-tight wrap">
                        <h2 style={{ fontSize: 15 }}>{channel.name}</h2>
                        <Badge tone={status.tone} dot>
                          {status.label}
                        </Badge>
                        {channel.autoAccept ? <Badge tone="info">Auto accept</Badge> : null}
                      </div>
                      <div className="hint" style={{ marginTop: 3 }}>
                        <span className="mono">{channel.code}</span>
                        <span aria-hidden="true"> · </span>
                        {kindLabel(channel.kind)}
                        {channel.commissionPercent > 0
                          ? ` · ${formatNumber(channel.commissionPercent, "en-GB")}% commission`
                          : " · no commission"}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardBody>
                  <div style={{ padding: "4px 16px 16px" }}>
                    <dl className="ledger">
                      <div className="ledger__row">
                        <dt>Orders (90d)</dt>
                        <dd className="num">{formatNumber(summary?.orders ?? 0)}</dd>
                      </div>
                      <div className="ledger__row">
                        <dt>Gross</dt>
                        <dd className="num">{formatCurrency(summary?.gross ?? 0, currency)}</dd>
                      </div>
                      <div className="ledger__row">
                        <dt>Commission</dt>
                        <dd className="num">
                          {summary?.commission
                            ? `−${formatCurrency(summary.commission, currency)}`
                            : formatCurrency(0, currency)}
                        </dd>
                      </div>
                      <div className="ledger__row ledger__row--total">
                        <dt>Net to store</dt>
                        <dd className="num">{formatCurrency(summary?.net ?? 0, currency)}</dd>
                      </div>
                    </dl>

                    <div className="row row-tight wrap" style={{ gap: 8, marginTop: 12 }}>
                      <Button variant="secondary" size="sm" onClick={() => setOrdersChannel(channel)}>
                        Orders
                        {summary?.openOrders ? <Badge tone="warning">{formatNumber(summary.openOrders)}</Badge> : null}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setMappingChannel(channel)}>
                        Menu mapping
                        <span className="hint">{formatNumber(channel.mappingsCount ?? 0)}</span>
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setConnectionChannel(channel)}>
                        Connection
                      </Button>
                      {canManage ? (
                        <Button
                          variant="quiet"
                          size="sm"
                          onClick={() => {
                            setEditing(channel);
                            setEditorOpen(true);
                          }}
                        >
                          <Pencil aria-hidden="true" /> Edit
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <ChannelEditor
        open={editorOpen}
        channel={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          void channelsQuery.refetch();
          void summaryQuery.refetch();
        }}
      />

      <MenuMappingSheet channel={mappingChannel} onClose={() => setMappingChannel(null)} />

      <ChannelOrdersSheet
        channel={ordersChannel}
        currency={currency}
        canManage={canManage}
        onClose={() => setOrdersChannel(null)}
        onChanged={() => {
          void summaryQuery.refetch();
          void channelsQuery.refetch();
        }}
      />

      <ConnectionSheet channel={connectionChannel} onClose={() => setConnectionChannel(null)} />
    </>
  );
}

function ChannelEditor({
  open,
  channel,
  onClose,
  onSaved,
}: {
  open: boolean;
  channel: SalesChannel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const { outlets } = useBusiness();
  const [form, setForm] = React.useState({ ...EMPTY_FORM });
  const [error, setError] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [credentials, setCredentials] = React.useState<ChannelCredentials | null>(null);

  const methodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => listPaymentMethods(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  React.useEffect(() => {
    if (!open) return;
    setCredentials(null);
    setError(null);
    setDeleteOpen(false);
    setForm(
      channel
        ? {
            name: channel.name,
            code: channel.code,
            kind: channel.kind,
            outletId: channel.outletId ?? "",
            commissionPercent: String(channel.commissionPercent),
            paymentMethodCode: channel.paymentMethodCode ?? "",
            autoAccept: channel.autoAccept,
            prepBufferMinutes: String(channel.prepBufferMinutes),
            active: channel.active,
          }
        : { ...EMPTY_FORM }
    );
  }, [open, channel]);

  const saveMutation = useMutation({
    mutationFn: async (): Promise<SalesChannel> => {
      const name = form.name.trim();
      if (!name) throw new Error("Give the channel a name.");
      const commission = form.commissionPercent.trim() === "" ? 0 : Number(form.commissionPercent);
      if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
        throw new Error("Commission must be between 0 and 100.");
      }
      const buffer = form.prepBufferMinutes.trim() === "" ? 0 : Number(form.prepBufferMinutes);
      if (!Number.isFinite(buffer) || buffer < 0) throw new Error("Prep buffer must be zero or more.");

      const input: SalesChannelInput = {
        name,
        code: form.code.trim() || undefined,
        kind: form.kind,
        outletId: form.outletId || null,
        commissionPercent: commission,
        paymentMethodCode: form.paymentMethodCode || null,
        autoAccept: form.autoAccept,
        prepBufferMinutes: buffer,
        active: form.active,
      };

      if (channel) return updateChannel(channel.id, input);

      const created = await createChannel(input);
      setCredentials(created.credentials);
      return created.channel;
    },
    onSuccess: (saved) => {
      push({
        title: channel ? "Channel updated" : "Channel created",
        description: channel ? saved.name : `${saved.name}. Copy its connector credentials now.`,
        variant: "success",
      });
      if (channel) {
        onSaved();
      } else {
        queryClient.invalidateQueries({ queryKey: ["channels"] });
      }
    },
    onError: (err) => setError(err instanceof Error ? err.message : "The channel could not be saved."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteChannel(channel!.id),
    onSuccess: () => {
      push({ title: "Channel deleted", description: "Its menu mapping went with it.", variant: "success" });
      setDeleteOpen(false);
      onSaved();
    },
    onError: (err) => {
      setDeleteOpen(false);
      setError(err instanceof Error ? err.message : "The channel could not be deleted.");
    },
  });

  const methods = methodsQuery.data ?? [];

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={channel ? `Edit ${channel.name}` : "New channel"}
        description="Commission is what the partner keeps; the register still records the guest's full total and the settlement rail below."
        width={520}
        footer={
          <div className="row between" style={{ gap: 10, width: "100%" }}>
            {channel ? (
              <Button variant="quiet" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden="true" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="row row-tight">
              <Button variant="secondary" onClick={onClose}>
                {credentials ? "Close" : "Cancel"}
              </Button>
              <Button variant="primary" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
                {channel ? "Save channel" : "Create channel"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="stack">
          {credentials ? (
            <ChannelCredentialsPanel credentials={credentials} />
          ) : (
            <div className="alert alert--info">
              <Globe aria-hidden="true" />
              <div>
                <b>Server-to-server ordering.</b>
                <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                  Velora does not call marketplaces itself. A partner (or your own ordering site) pushes orders to a
                  signed webhook, and Velora queues the status updates it should send back.
                </p>
              </div>
            </div>
          )}

          {error ? (
            <div className="alert alert--danger" role="alert">
              {error}
            </div>
          ) : null}

          <Field label="Name" htmlFor="channel-name" required>
            <Input
              id="channel-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="GoFood"
            />
          </Field>

          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="Connector code" htmlFor="channel-code" hint="Lowercase letters, numbers and underscores.">
              <Input
                id="channel-code"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                placeholder="gofood"
                className="mono"
              />
            </Field>
            <Field label="Kind" htmlFor="channel-kind">
              <Select
                id="channel-kind"
                value={form.kind}
                onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as ChannelKind }))}
              >
                {KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Outlet" htmlFor="channel-outlet" hint="Leave empty to accept orders for whichever outlet the partner names.">
            <Select
              id="channel-outlet"
              value={form.outletId}
              onChange={(event) => setForm((current) => ({ ...current, outletId: event.target.value }))}
            >
              <option value="">All outlets</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="Commission %" htmlFor="channel-commission" hint="What the channel keeps per order.">
              <Input
                id="channel-commission"
                inputMode="decimal"
                value={form.commissionPercent}
                onChange={(event) => setForm((current) => ({ ...current, commissionPercent: event.target.value }))}
                placeholder="20"
              />
            </Field>
            <Field label="Prep buffer (min)" htmlFor="channel-buffer" hint="Added to the quoted wait time.">
              <Input
                id="channel-buffer"
                inputMode="numeric"
                value={form.prepBufferMinutes}
                onChange={(event) => setForm((current) => ({ ...current, prepBufferMinutes: event.target.value }))}
                placeholder="10"
              />
            </Field>
          </div>

          <Field
            label="Settlement rail"
            htmlFor="channel-method"
            hint="Prepaid channel orders are settled with this method at checkout, so the cashier never charges the guest twice."
          >
            <Select
              id="channel-method"
              value={form.paymentMethodCode}
              onChange={(event) => setForm((current) => ({ ...current, paymentMethodCode: event.target.value }))}
            >
              <option value="">Nothing — the cashier takes payment</option>
              {methods.map((method) => (
                <option key={method.id} value={method.code}>
                  {method.name} ({method.code})
                </option>
              ))}
            </Select>
          </Field>

          <Switch
            checked={form.autoAccept}
            onChange={(event) => setForm((current) => ({ ...current, autoAccept: event.target.checked }))}
            label="Accept orders automatically"
            description="Incoming orders go straight to the kitchen instead of waiting for someone to accept them."
          />

          <Switch
            checked={form.active}
            onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
            label="Channel is live"
            description="A paused channel stops accepting pushes; its history is kept."
          />
        </div>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete this channel?"
        description="Its menu mapping and credentials are removed. A channel with orders cannot be deleted — pause it instead."
        confirmLabel="Delete channel"
        loading={deleteMutation.isPending}
      />
    </>
  );
}

function ChannelCredentialsPanel({ credentials }: { credentials: ChannelCredentials }) {
  const { push } = useToast();
  const [copied, setCopied] = React.useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      push({ title: `${label} copied`, variant: "success" });
    } catch {
      push({ title: "Copy failed", description: "Select the value and copy it manually.", variant: "error" });
    }
  };

  const rows: { label: string; value: string }[] = [
    { label: "Webhook URL", value: credentials.webhookUrl ?? "" },
    { label: "Signing secret", value: credentials.secret },
  ];

  return (
    <div className="alert alert--warning">
      <Check aria-hidden="true" />
      <div style={{ minWidth: 0 }}>
        <b>Copy these now — they are shown once.</b>
        <div className="stack-sm" style={{ marginTop: 8 }}>
          {rows.map((row) => (
            <div key={row.label} className="stack-sm">
              <div className="hint" style={{ color: "inherit" }}>
                {row.label}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Input readOnly value={row.value} className="mono" onFocus={(event) => event.target.select()} />
                <Button variant="secondary" size="sm" onClick={() => copy(row.label, row.value)}>
                  {copied === row.label ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                </Button>
              </div>
            </div>
          ))}
          <p className="hint" style={{ margin: 0, color: "inherit" }}>
            Partners sign every push with HMAC-SHA256 of the raw body using the secret, sent as the
            <span className="mono"> X-Channel-Signature </span> header.
          </p>
        </div>
      </div>
    </div>
  );
}

function MenuMappingSheet({ channel, onClose }: { channel: SalesChannel | null; onClose: () => void }) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = React.useState<{ externalItemId: string; productId: string; active: boolean }[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const mappingsQuery = useQuery({
    queryKey: ["channel-mappings", channel?.id],
    queryFn: () => listChannelMappings(channel!.id),
    enabled: Boolean(channel),
  });

  const productsQuery = useQuery({
    queryKey: ["products", "channel-mapping"],
    queryFn: () => listProducts({ pageSize: 200, activeOnly: true }),
    enabled: Boolean(channel),
    staleTime: 5 * 60_000,
  });

  React.useEffect(() => {
    if (!channel) return;
    setError(null);
    setRows([]);
  }, [channel]);

  React.useEffect(() => {
    if (!mappingsQuery.data) return;
    setRows(
      mappingsQuery.data.map((mapping) => ({
        externalItemId: mapping.externalItemId,
        productId: mapping.productId,
        active: mapping.active,
      }))
    );
  }, [mappingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const cleaned = rows
        .map((row) => ({ ...row, externalItemId: row.externalItemId.trim() }))
        .filter((row) => row.externalItemId !== "");
      if (cleaned.length !== rows.length) {
        throw new Error("Every row needs the partner's item id.");
      }
      if (new Set(cleaned.map((row) => row.externalItemId)).size !== cleaned.length) {
        throw new Error("Two rows share the same external item id.");
      }
      return saveChannelMappings(
        channel!.id,
        cleaned.map((row) => ({
          externalItemId: row.externalItemId,
          productId: row.productId,
          optionMap: {},
          active: row.active,
        }))
      );
    },
    onSuccess: (saved) => {
      push({ title: "Menu mapping saved", description: `${saved.length} item(s) mapped.`, variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["channel-mappings", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "The mapping could not be saved."),
  });

  const products = productsQuery.data?.data ?? [];

  return (
    <Sheet
      open={Boolean(channel)}
      onClose={onClose}
      title={channel ? `${channel.name} menu` : "Menu mapping"}
      description="Match the partner's item ids to your products. Orders are priced from your menu, never from the partner's payload."
      width={560}
      footer={
        <div className="row between" style={{ gap: 10, width: "100%" }}>
          <Button
            variant="quiet"
            size="sm"
            onClick={() => setRows((current) => [...current, { externalItemId: "", productId: products[0]?.id ?? "", active: true }])}
            disabled={products.length === 0}
          >
            <Plus aria-hidden="true" /> Add item
          </Button>
          <div className="row row-tight">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              Save mapping
            </Button>
          </div>
        </div>
      }
    >
      <div className="stack">
        {error ? (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        ) : null}

        {mappingsQuery.isError ? (
          <InlineError
            title="Mappings could not be loaded"
            error={mappingsQuery.error}
            onRetry={() => mappingsQuery.refetch()}
          />
        ) : mappingsQuery.isLoading ? (
          <div style={{ padding: 20, textAlign: "center" }}>
            <Spinner size={16} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            icon={<ArrowRight aria-hidden="true" />}
            title="Nothing mapped yet"
            description="Add a row per partner item and pick the product it sells as."
            actions={
              <Button
                variant="primary"
                onClick={() => setRows([{ externalItemId: "", productId: products[0]?.id ?? "", active: true }])}
                disabled={products.length === 0}
              >
                Add the first item
              </Button>
            }
          />
        ) : (
          <div className="stack-sm">
            {rows.map((row, index) => (
              <div className="row" style={{ gap: 8, alignItems: "flex-end" }} key={`${row.externalItemId}-${index}`}>
                <Field label={index === 0 ? "Partner item id" : undefined} className="grow">
                  <Input
                    value={row.externalItemId}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, externalItemId: event.target.value } : entry
                        )
                      )
                    }
                    placeholder="GF-KOPI"
                    className="mono"
                    aria-label="Partner item id"
                  />
                </Field>
                <Field label={index === 0 ? "Your product" : undefined} className="grow">
                  <Select
                    value={row.productId}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, productId: event.target.value } : entry
                        )
                      )
                    }
                    aria-label="Product"
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  variant="quiet"
                  size="sm"
                  aria-label="Remove row"
                  onClick={() => setRows((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="hint" style={{ margin: 0 }}>
          Saving replaces the whole set: a row you remove here stops selling on that channel. Modifier options can be
          mapped through the API with <span className="mono">option_map</span>.
        </p>
      </div>
    </Sheet>
  );
}

function ChannelOrdersSheet({
  channel,
  currency,
  canManage,
  onClose,
  onChanged,
}: {
  channel: SalesChannel | null;
  currency: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = React.useState<Transaction | null>(null);
  const [reason, setReason] = React.useState("");

  const ordersQuery = useQuery({
    queryKey: ["channel-orders", channel?.id],
    queryFn: () => listChannelOrders(channel!.id, { status: "all" }),
    enabled: Boolean(channel),
  });

  const acceptMutation = useMutation({
    mutationFn: (order: Transaction) => acceptChannelOrder(channel!.id, order.id),
    onSuccess: (order) => {
      push({ title: "Order accepted", description: `${order.orderNumber ?? order.receiptNumber} is on the kitchen line.`, variant: "success" });
      void ordersQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      onChanged();
    },
    onError: (err) => push({ title: "Could not accept", description: err instanceof Error ? err.message : undefined, variant: "error" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (order: Transaction) => rejectChannelOrder(channel!.id, order.id, reason.trim() || "Rejected by the store"),
    onSuccess: () => {
      push({ title: "Order rejected", variant: "success" });
      setRejecting(null);
      setReason("");
      void ordersQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      onChanged();
    },
    onError: (err) => push({ title: "Could not reject", description: err instanceof Error ? err.message : undefined, variant: "error" }),
  });

  React.useEffect(() => {
    if (!channel) return;
    setRejecting(null);
    setReason("");
  }, [channel]);

  const rows = ordersQuery.data?.data ?? [];

  return (
    <>
      <Sheet
        open={Boolean(channel)}
        onClose={onClose}
        title={channel ? `${channel.name} orders` : "Channel orders"}
        description="Orders pushed by the partner. Accepting one fires it to the kitchen and tells the partner."
        width={560}
      >
        <div className="stack">
          {ordersQuery.isError ? (
            <InlineError title="Orders could not be loaded" error={ordersQuery.error} onRetry={() => ordersQuery.refetch()} />
          ) : ordersQuery.isLoading ? (
            <div style={{ padding: 20, textAlign: "center" }}>
              <Spinner size={16} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              compact
              icon={<Truck aria-hidden="true" />}
              title="No orders from this channel yet"
              description="Once the connector pushes an order it appears here, and on the order board."
            />
          ) : (
            <div className="record-list">
              {rows.map((order) => {
                const open =
                  Boolean(order.orderStatus) && !["completed", "cancelled"].includes(order.orderStatus ?? "");
                return (
                  <div className="record" key={order.id}>
                    <div className="record__top">
                      <div style={{ minWidth: 0 }}>
                        <div className="record__title">
                          {order.orderNumber ?? order.receiptNumber}
                          <Badge tone={channelStatusTone(order.channelStatus)}>
                            {(order.channelStatus ?? "received").replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="record__meta">
                          {order.channelOrderRef ?? "no partner ref"} ·{" "}
                          {(order.orderType ?? "pickup").replace("_", " ")} · {formatNumber(order.items.length)} item(s)
                          {order.customerName ? ` · ${order.customerName}` : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <b className="num">{formatCurrency(order.total, currency)}</b>
                        <div className="hint">
                          {order.channelCommission
                            ? `−${formatCurrency(order.channelCommission, currency)} commission`
                            : "no commission"}
                        </div>
                      </div>
                    </div>

                    {open && canManage ? (
                      <div className="row row-tight" style={{ gap: 8, marginTop: 8 }}>
                        {order.channelStatus === "received" ? (
                          <Button
                            variant="primary"
                            size="sm"
                            loading={acceptMutation.isPending}
                            onClick={() => acceptMutation.mutate(order)}
                          >
                            <Check aria-hidden="true" /> Accept
                          </Button>
                        ) : null}
                        <Button variant="quiet" size="sm" onClick={() => setRejecting(order)}>
                          <X aria-hidden="true" /> Reject
                        </Button>
                        <Link href="/orders" className="btn btn--quiet btn--sm">
                          Order board <ArrowRight aria-hidden="true" />
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Sheet>

      <Sheet
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject channel order"
        description="The partner is told the order cannot be filled. If it was prepaid, refund it from the transactions ledger after cancelling."
        width={440}
        footer={
          <div className="row row-tight" style={{ justifyContent: "flex-end", gap: 8, width: "100%" }}>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Keep order
            </Button>
            <Button
              variant="danger"
              loading={rejectMutation.isPending}
              onClick={() => rejecting && rejectMutation.mutate(rejecting)}
            >
              Reject order
            </Button>
          </div>
        }
      >
        <Field label="Reason" hint="Shared with the channel partner and kept on the order.">
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Out of stock" />
        </Field>
      </Sheet>
    </>
  );
}

function ConnectionSheet({ channel, onClose }: { channel: SalesChannel | null; onClose: () => void }) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = React.useState<ChannelCredentials | null>(null);
  const [showSecret, setShowSecret] = React.useState(false);

  const eventsQuery = useQuery({
    queryKey: ["channel-events", channel?.id],
    queryFn: () => listChannelEvents(channel!.id, { status: "pending" }),
    enabled: Boolean(channel),
  });

  React.useEffect(() => {
    if (!channel) return;
    setCredentials(null);
    setShowSecret(false);
  }, [channel]);

  const rotateMutation = useMutation({
    mutationFn: () => rotateChannelSecret(channel!.id),
    onSuccess: (next) => {
      setCredentials(next);
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: (err) => push({ title: "Could not rotate", description: err instanceof Error ? err.message : undefined, variant: "error" }),
  });

  const pushMenuMutation = useMutation({
    mutationFn: () => pushChannelMenu(channel!.id),
    onSuccess: (result) => {
      push({
        title: "Menu queued",
        description: `${result.snapshot.items.length} item(s) will be sent to the partner.`,
        variant: "success",
      });
      void eventsQuery.refetch();
    },
    onError: (err) => push({ title: "Could not queue the menu", description: err instanceof Error ? err.message : undefined, variant: "error" }),
  });

  const ackMutation = useMutation({
    mutationFn: ({ event, status }: { event: ChannelEvent; status: "sent" | "failed" }) =>
      ackChannelEvent(channel!.id, event.id, status),
    onSuccess: () => {
      push({ title: "Event acknowledged", variant: "success" });
      void eventsQuery.refetch();
    },
    onError: (err) => push({ title: "Could not acknowledge", description: err instanceof Error ? err.message : undefined, variant: "error" }),
  });

  const events = eventsQuery.data ?? [];
  const url = credentials?.webhookUrl ?? channel?.webhookUrl;

  return (
    <Sheet
      open={Boolean(channel)}
      onClose={onClose}
      title={channel ? `${channel.name} connection` : "Connection"}
      description="Velora queues the messages a partner needs; the connector pulls this queue and acknowledges each one."
      width={560}
    >
      <div className="stack">
        {credentials ? (
          <ChannelCredentialsPanel credentials={credentials} />
        ) : (
          <>
            <Field label="Webhook URL" hint="Partners POST orders here. Treat it as a credential.">
              <div className="row" style={{ gap: 6 }}>
                <Input readOnly value={url ?? "Rotate the secret to issue a URL"} className="mono" />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!url}
                  onClick={async () => {
                    if (!url) return;
                    try {
                      await navigator.clipboard.writeText(url);
                      push({ title: "Webhook URL copied", variant: "success" });
                    } catch {
                      push({ title: "Copy failed", variant: "error" });
                    }
                  }}
                >
                  <Copy aria-hidden="true" />
                </Button>
              </div>
            </Field>

            <div className="row row-tight" style={{ gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={() => setShowSecret(true)}>
                <RefreshCw aria-hidden="true" /> Rotate secret
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={pushMenuMutation.isPending}
                onClick={() => pushMenuMutation.mutate()}
              >
                <Send aria-hidden="true" /> Push menu
              </Button>
            </div>

            {showSecret ? (
              <div className="alert alert--warning">
                <RefreshCw aria-hidden="true" />
                <div>
                  <b>Rotating signs the old connector out.</b>
                  <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                    The current webhook token and secret stop working immediately. Any partner still using them will
                    get a 401 until it is updated.
                  </p>
                  <div className="row row-tight" style={{ marginTop: 8, gap: 8 }}>
                    <Button variant="secondary" size="sm" onClick={() => setShowSecret(false)}>
                      Keep current secret
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={rotateMutation.isPending}
                      onClick={() => rotateMutation.mutate()}
                    >
                      Rotate now
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Queued messages
          </div>
          {eventsQuery.isError ? (
            <InlineError title="The queue could not be loaded" error={eventsQuery.error} onRetry={() => eventsQuery.refetch()} />
          ) : eventsQuery.isLoading ? (
            <div style={{ padding: 20, textAlign: "center" }}>
              <Spinner size={16} />
            </div>
          ) : events.length === 0 ? (
            <EmptyState
              compact
              icon={<Send aria-hidden="true" />}
              title="Nothing waiting"
              description="Every message this channel needs has been delivered."
            />
          ) : (
            <div className="record-list">
              {events.map((event) => (
                <div className="record" key={event.id}>
                  <div className="record__top">
                    <div style={{ minWidth: 0 }}>
                      <div className="record__title">
                        <span className="mono">{event.type}</span>
                        <Badge tone={event.status === "pending" ? "warning" : event.status === "sent" ? "success" : "danger"}>
                          {event.status}
                        </Badge>
                      </div>
                      <div className="record__meta">
                        {new Date(event.createdAt).toLocaleString()}
                        {event.saleId ? ` · order ${event.saleId}` : ""}
                        {event.attempts ? ` · ${event.attempts} attempt(s)` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="row row-tight" style={{ gap: 8, marginTop: 8 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => ackMutation.mutate({ event, status: "sent" })}
                    >
                      <Check aria-hidden="true" /> Delivered
                    </Button>
                    <Button variant="quiet" size="sm" onClick={() => ackMutation.mutate({ event, status: "failed" })}>
                      Mark failed
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
