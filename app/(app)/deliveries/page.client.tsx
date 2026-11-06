"use client";

export const instant = false;

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Button, EmptyState, Select } from "@/components/ui/primitives";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  assignDelivery,
  getDeliveryBoard,
  listDrivers,
  updateDeliveryStatus,
  type Delivery,
  type DeliveryStatus,
} from "@/lib/api/deliveries";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatCurrency } from "@/lib/formatting/currency";

const NEXT_STATUS: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  pending: "assigned",
  scheduled: "assigned",
  assigned: "picked_up",
  picked_up: "in_transit",
  in_transit: "delivered",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Unassigned",
  scheduled: "Scheduled",
  assigned: "Assigned",
  picked_up: "Picked up",
  in_transit: "In transit",
  delivered: "Delivered",
  failed: "Failed",
  cancelled: "Cancelled",
};

export default function DeliveriesPage() {
  const { has } = usePermissions();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));

  const board = useQuery({
    queryKey: ["deliveries", "board", date],
    queryFn: () => getDeliveryBoard(date),
    enabled: has("deliveries.view"),
    refetchInterval: 30_000,
  });
  const drivers = useQuery({
    queryKey: ["deliveries", "drivers"],
    queryFn: listDrivers,
    enabled: has("deliveries.view"),
  });

  const assign = useMutation({
    mutationFn: ({ deliveryId, driverId }: { deliveryId: string; driverId: string }) =>
      assignDelivery(deliveryId, driverId),
    onSuccess: () => {
      push({ title: "Driver assigned", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["deliveries", "board"] });
    },
    onError: (error) => push({ title: "Could not assign", description: String(error), variant: "error" }),
  });

  const advance = useMutation({
    mutationFn: ({ deliveryId, status }: { deliveryId: string; status: DeliveryStatus }) =>
      updateDeliveryStatus(deliveryId, status),
    onSuccess: () => {
      push({ title: "Delivery updated", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["deliveries", "board"] });
    },
    onError: (error) => push({ title: "Could not update", description: String(error), variant: "error" }),
  });

  if (!has("deliveries.view")) {
    return <AccessDenied permission="deliveries.view" />;
  }

  const canManage = has("deliveries.manage");
  const data = board.data;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operate"
        title="Deliveries"
        description="Dispatch board for today's delivery jobs, driver assignment and proof of delivery."
        actions={
          <label className="field" style={{ minWidth: 160 }}>
            <span className="field__label">Board date</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        }
      />

      <div className="stat-grid">
        <Stat label="Jobs" value={data?.totals.count ?? 0} />
        <Stat label="Delivered" value={data?.totals.delivered ?? 0} />
        <Stat label="Unassigned" value={data?.totals.unassigned ?? 0} />
        <Stat label="Fees" value={formatCurrency(data?.totals.fees ?? 0)} />
      </div>

      {board.isError ? <InlineError title="Could not load the delivery board" error={board.error} onRetry={() => board.refetch()} /> : null}

      {!data && board.isPending ? (
        <Card>
          <CardBody>
            <p className="hint">Loading the board…</p>
          </CardBody>
        </Card>
      ) : null}

      {data ? (
        <div className="grid-2">
          {data.columns.map((column) => (
            <Card key={column.status}>
              <CardHeader
                title={column.label}
                description={`${column.deliveries.length} job${column.deliveries.length === 1 ? "" : "s"}`}
              />
              <CardBody>
                {column.deliveries.length === 0 ? (
                  <p className="hint">Nothing in this lane.</p>
                ) : (
                  <div className="stack-sm">
                    {column.deliveries.map((delivery) => (
                      <DeliveryCard
                        key={delivery.id}
                        delivery={delivery}
                        drivers={drivers.data ?? []}
                        canManage={canManage}
                        busy={assign.isPending || advance.isPending}
                        onAssign={(driverId) => assign.mutate({ deliveryId: delivery.id, driverId })}
                        onAdvance={() => {
                          const next = NEXT_STATUS[delivery.status];
                          if (next) advance.mutate({ deliveryId: delivery.id, status: next });
                        }}
                      />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      {data && data.totals.count === 0 ? (
        <EmptyState
          icon={<Truck aria-hidden="true" />}
          title="No deliveries today"
          description="Delivery orders created from the storefront or a delivery sale appear here."
        />
      ) : null}
    </div>
  );
}

function DeliveryCard({
  delivery,
  drivers,
  canManage,
  busy,
  onAssign,
  onAdvance,
}: {
  delivery: Delivery;
  drivers: { id: string; name: string }[];
  canManage: boolean;
  busy: boolean;
  onAssign: (driverId: string) => void;
  onAdvance: () => void;
}) {
  const [driverId, setDriverId] = React.useState(delivery.driverId ?? "");

  return (
    <div className="record" style={{ padding: 12, border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
      <div className="record__top">
        <strong>{delivery.number}</strong>
        <Badge tone={delivery.status === "delivered" ? "success" : delivery.status === "failed" ? "danger" : "info"}>
          {STATUS_LABEL[delivery.status] ?? delivery.status}
        </Badge>
      </div>
      <div className="record__meta">
        <span>{delivery.recipientName || "No recipient"}</span>
        {delivery.address?.line1 ? <span>{delivery.address.line1}</span> : null}
      </div>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
        <span className="hint">{delivery.driverName ?? "No driver"}</span>
        <span>{formatCurrency(delivery.fee)}</span>
      </div>
      {canManage ? (
        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          {!delivery.driverId ? (
            <>
              <Select value={driverId} onChange={(event) => setDriverId(event.target.value)} aria-label="Driver">
                <option value="">Pick a driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </Select>
              <Button size="sm" disabled={!driverId || busy} onClick={() => onAssign(driverId)}>
                Assign
              </Button>
            </>
          ) : null}
          {NEXT_STATUS[delivery.status] ? (
            <Button size="sm" variant="quiet" disabled={busy} onClick={onAdvance}>
              Mark {STATUS_LABEL[NEXT_STATUS[delivery.status]!]?.toLowerCase()}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
