"use client";

export const instant = false;

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Plus } from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Button, EmptyState, Field, Input, Select } from "@/components/ui/primitives";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  createStorefront,
  listStorefrontOrders,
  listStorefronts,
  setStorefrontPublished,
  updateStorefrontOrderStatus,
} from "@/lib/api/storefronts";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatCurrency, formatDateTime } from "@/lib/formatting/currency";

const ORDER_STATUSES = ["confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"];

export default function StorefrontsPage() {
  const { has } = usePermissions();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");

  const storefronts = useQuery({
    queryKey: ["storefronts"],
    queryFn: listStorefronts,
    enabled: has("storefront.view"),
  });
  const orders = useQuery({
    queryKey: ["storefronts", "orders"],
    queryFn: listStorefrontOrders,
    enabled: has("storefront.view"),
  });

  const create = useMutation({
    mutationFn: () => createStorefront({ name: name.trim(), slug: slug.trim() || undefined }),
    onSuccess: () => {
      push({ title: "Storefront created", variant: "success" });
      setName("");
      setSlug("");
      queryClient.invalidateQueries({ queryKey: ["storefronts"] });
    },
    onError: (error) => push({ title: "Could not create storefront", description: String(error), variant: "error" }),
  });

  const publish = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) => setStorefrontPublished(id, published),
    onSuccess: (_data, variables) => {
      push({ title: variables.published ? "Storefront published" : "Storefront unpublished", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["storefronts"] });
    },
    onError: (error) => push({ title: "Could not update storefront", description: String(error), variant: "error" }),
  });

  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => updateStorefrontOrderStatus(id, value),
    onSuccess: () => {
      push({ title: "Order updated", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["storefronts", "orders"] });
    },
    onError: (error) => push({ title: "Could not update the order", description: String(error), variant: "error" }),
  });

  if (!has("storefront.view")) {
    return <AccessDenied permission="storefront.view" />;
  }

  const rows = storefronts.data ?? [];
  const canManage = has("storefront.manage");

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operate"
        title="Storefront"
        description="Publish the online catalogue, follow incoming orders and move them through fulfilment."
      />

      <div className="stat-grid">
        <Stat label="Storefronts" value={rows.length} />
        <Stat label="Published" value={rows.filter((row) => row.active).length} />
        <Stat label="Online orders" value={orders.data?.length ?? 0} />
        <Stat label="Order value" value={formatCurrency((orders.data ?? []).reduce((sum, order) => sum + order.total, 0))} />
      </div>

      {canManage ? (
        <Card>
          <CardHeader title="New storefront" description="A storefront gets a public slug and starts unpublished." />
          <CardBody>
            <form
              className="row"
              style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim()) create.mutate();
              }}
            >
              <Field label="Name" htmlFor="storefront-name">
                <Input id="storefront-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Kopi Senja online" />
              </Field>
              <Field label="Slug" htmlFor="storefront-slug" hint="Optional; generated from the name">
                <Input id="storefront-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="kopi-senja" />
              </Field>
              <Button type="submit" variant="primary" loading={create.isPending} disabled={!name.trim()}>
                <Plus aria-hidden="true" /> Create
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Storefronts" />
        <CardBody>
          {storefronts.isError ? (
            <InlineError title="Could not load storefronts" error={storefronts.error} onRetry={() => storefronts.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState icon={<Globe aria-hidden="true" />} title="No storefront yet" description="Create one to start selling online." />
          ) : (
            <div className="stack-sm">
              {rows.map((row) => (
                <div key={row.id} className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <strong>{row.name}</strong>
                      <Badge tone={row.active ? "success" : "neutral"}>{row.active ? "Published" : "Draft"}</Badge>
                    </div>
                    <div className="hint">/{row.slug} · {row.itemsCount ?? 0} items · {row.ordersCount ?? 0} orders</div>
                  </div>
                  {canManage ? (
                    <Button
                      size="sm"
                      variant={row.active ? "quiet" : "primary"}
                      loading={publish.isPending}
                      onClick={() => publish.mutate({ id: row.id, published: !row.active })}
                    >
                      {row.active ? "Unpublish" : "Publish"}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Online orders" description="Confirm, prepare and fulfil orders placed through the storefront." />
        <CardBody>
          {orders.isError ? (
            <InlineError title="Could not load online orders" error={orders.error} onRetry={() => orders.refetch()} />
          ) : (orders.data ?? []).length === 0 ? (
            <p className="hint">No online orders yet.</p>
          ) : (
            <div className="stack-sm">
              {(orders.data ?? []).map((order) => (
                <div key={order.id} className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <strong>{order.number}</strong>
                      <Badge tone={order.status === "cancelled" ? "danger" : order.status === "completed" ? "success" : "info"}>
                        {order.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="hint">
                      {order.customerName ?? "Guest"} · {order.fulfilmentType ?? "pickup"} · {formatDateTime(order.createdAt)}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <span>{formatCurrency(order.total)}</span>
                    {canManage || has("storefront.orders") ? (
                      <Select
                        aria-label={`Status for ${order.number}`}
                        value={order.status}
                        onChange={(event) => status.mutate({ id: order.id, value: event.target.value })}
                      >
                        {ORDER_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {value.replace(/_/g, " ")}
                          </option>
                        ))}
                      </Select>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
