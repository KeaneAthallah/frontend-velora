"use client";

// Opt out of instant-navigation validation: this page renders data-dependent client UI.
export const instant = false;

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CheckCheck,
  ChefHat,
  CircleCheck,
  Flame,
  Inbox,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Badge,
  Button,
  Checkbox,
  ChipButton,
  EmptyState,
  Field,
  Input,
  Select,
} from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { AccessDenied } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  createKitchenStation,
  deleteKitchenStation,
  listKitchenStations,
  listKitchenTickets,
  markKitchenTicketPrinted,
  printKitchenTicket,
  setKitchenTicketStatus,
  stationKindLabel,
  updateKitchenStation,
  type KitchenStationInput,
  type ManualTicketStatus,
} from "@/lib/api/kitchen";
import { orderTypeLabel } from "@/lib/api/orders";
import { listCategories } from "@/lib/api/products";
import type {
  KitchenStation,
  KitchenStationKind,
  KitchenTicket,
  KitchenTicketStatus,
} from "@/lib/api/types";
import { usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";

const STATION_KINDS: KitchenStationKind[] = ["kitchen", "bar", "pastry", "cold", "expediter"];

const LATE_MINUTES = 12;

type StationFormState = {
  id?: string;
  name: string;
  code: string;
  kind: KitchenStationKind;
  printerName: string;
  printerTarget: string;
  copies: string;
  autoPrint: boolean;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: string;
  categoryIds: string[];
};

function emptyStationForm(): StationFormState {
  return {
    name: "",
    code: "",
    kind: "kitchen",
    printerName: "",
    printerTarget: "",
    copies: "1",
    autoPrint: true,
    isDefault: false,
    isActive: true,
    sortOrder: "0",
    categoryIds: [],
  };
}

function minutesSince(iso?: string) {
  if (!iso) return 0;
  const started = new Date(iso).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.floor((Date.now() - started) / 60_000));
}

function elapsedLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function clockTime(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "HH:mm");
}

const STATUS_TONE: Record<KitchenTicketStatus, "neutral" | "info" | "warning" | "success"> = {
  queued: "neutral",
  preparing: "info",
  ready: "warning",
  served: "success",
  voided: "neutral",
};

export default function KitchenPage() {
  const { has } = usePermissions();
  const { outletId, outlet } = useBusiness();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const canView = has("kitchen.view");
  const canManage = has("kitchen.manage");
  const canPrint = has("kitchen.print");
  const canSeeCategories = has("products.view");

  const [stationFilter, setStationFilter] = React.useState<"all" | string>("all");
  const [showDone, setShowDone] = React.useState(false);
  const [stationsOpen, setStationsOpen] = React.useState(false);
  const [stationForm, setStationForm] = React.useState<StationFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<KitchenStation | null>(null);
  const [printTicket, setPrintTicket] = React.useState<KitchenTicket | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const stationsQuery = useQuery({
    queryKey: ["kitchen-stations", outletId],
    queryFn: () => listKitchenStations({ outletId: outletId ?? undefined, includeInactive: true }),
    enabled: canView && Boolean(outletId),
    staleTime: 15000,
  });

  const ticketsQuery = useQuery({
    queryKey: ["kitchen-tickets", outletId, stationFilter, showDone ? "all" : "active"],
    queryFn: () =>
      listKitchenTickets({
        outletId: outletId ?? undefined,
        stationId: stationFilter === "all" ? undefined : stationFilter,
        status: showDone ? "all" : "active",
      }),
    enabled: canView && Boolean(outletId),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 2000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
    enabled: canManage && canSeeCategories && Boolean(stationForm),
    staleTime: 60000,
  });

  const stations = React.useMemo(() => stationsQuery.data ?? [], [stationsQuery.data]);
  const activeStations = React.useMemo(
    () => stations.filter((station) => station.isActive),
    [stations]
  );
  const board = ticketsQuery.data;
  const tickets = board?.tickets ?? [];
  const counts = board?.counts;

  React.useEffect(() => {
    if (
      stationFilter !== "all" &&
      stations.length &&
      !activeStations.some((station) => station.id === stationFilter)
    ) {
      setStationFilter("all");
    }
  }, [activeStations, stationFilter, stations.length]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["kitchen-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["kitchen-stations"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["floor-plan"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ManualTicketStatus }) =>
      setKitchenTicketStatus(id, status),
    onSuccess: (ticket) => {
      setActionError(null);
      invalidate();
      push({ title: `${ticket.ticketNumber} · ${ticket.status}`, variant: "success" });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "The ticket could not be updated"),
  });

  const printMutation = useMutation({
    mutationFn: (ticket: KitchenTicket) => printKitchenTicket(ticket.id),
    onSuccess: (ticket) => {
      setPrintTicket(ticket);
      setActionError(null);
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "The ticket could not be printed"),
  });

  const markPrintedMutation = useMutation({
    mutationFn: (ticket: KitchenTicket) => markKitchenTicketPrinted(ticket.id),
    onSuccess: (ticket) => {
      // The printed endpoint does not return the text payload; keep what is on screen.
      setPrintTicket((current) =>
        current && current.id === ticket.id ? { ...ticket, text: current.text } : ticket
      );
      invalidate();
    },
  });

  const saveStationMutation = useMutation({
    mutationFn: (form: StationFormState) => {
      if (!outletId) throw new Error("Choose an outlet before adding stations");
      if (!form.name.trim()) throw new Error("Give the station a name");

      const input: KitchenStationInput = {
        outletId,
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        kind: form.kind,
        printerName: form.printerName.trim() || undefined,
        printerTarget: form.printerTarget.trim() || undefined,
        copies: Number(form.copies) || 1,
        autoPrint: form.autoPrint,
        isDefault: form.isDefault,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
        categoryIds: form.categoryIds,
      };

      return form.id ? updateKitchenStation(form.id, input) : createKitchenStation(input);
    },
    onSuccess: (station, form) => {
      setStationForm(null);
      setActionError(null);
      invalidate();
      push({ title: form.id ? `${station.name} saved` : `${station.name} added`, variant: "success" });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "The station could not be saved"),
  });

  const removeStationMutation = useMutation({
    mutationFn: (station: KitchenStation) => deleteKitchenStation(station.id),
    onSuccess: () => {
      setDeleteTarget(null);
      setActionError(null);
      invalidate();
      push({ title: "Station deleted", variant: "success" });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "The station could not be deleted"),
  });

  if (!canView) {
    return <AccessDenied />;
  }

  const openStationForm = (station?: KitchenStation) => {
    setActionError(null);
    setStationsOpen(true);
    setStationForm(
      station
        ? {
            id: station.id,
            name: station.name,
            code: station.code,
            kind: station.kind,
            printerName: station.printerName ?? "",
            printerTarget: station.printerTarget ?? "",
            copies: String(station.copies),
            autoPrint: station.autoPrint,
            isDefault: station.isDefault,
            isActive: station.isActive,
            sortOrder: String(station.sortOrder),
            categoryIds: station.categories.map((category) => category.id),
          }
        : emptyStationForm()
    );
  };

  const closeStationDialog = () => {
    setStationsOpen(false);
    setStationForm(null);
    setActionError(null);
  };

  const visibleTickets = (status: KitchenTicketStatus) => {
    const list = tickets.filter((ticket) => ticket.status === status);
    if (status === "served") {
      return list
        .slice()
        .sort((a, b) => new Date(b.servedAt ?? b.createdAt).getTime() - new Date(a.servedAt ?? a.createdAt).getTime())
        .slice(0, 12);
    }
    return list;
  };

  const renderTicket = (ticket: KitchenTicket) => {
    const minutes = minutesSince(ticket.startedAt ?? ticket.createdAt);
    const late =
      minutes >= LATE_MINUTES && (ticket.status === "queued" || ticket.status === "preparing");
    const printing = printMutation.isPending && printMutation.variables?.id === ticket.id;

    return (
      <article
        className="ticket-card"
        key={ticket.id}
        data-status={ticket.status}
        data-late={late || undefined}
      >
        <div className="ticket-card__head">
          <div style={{ minWidth: 0 }}>
            <span className="ticket-card__number mono">{ticket.ticketNumber}</span>
            <span className="ticket-card__station">{ticket.station.name}</span>
          </div>
          <Badge tone={STATUS_TONE[ticket.status]} dot>
            {ticket.status === "queued"
              ? "Queued"
              : ticket.status === "preparing"
                ? "Preparing"
                : ticket.status === "ready"
                  ? "Ready"
                  : "Served"}
          </Badge>
        </div>

        <div className="ticket-card__meta">
          <span className="mono">{ticket.sale.orderNumber ?? `#${ticket.sale.id}`}</span>
          <span aria-hidden="true">·</span>
          <span>{orderTypeLabel(ticket.sale.orderType)}</span>
          {ticket.sale.table ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="tag">{ticket.sale.table}</span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{clockTime(ticket.createdAt)}</span>
        </div>

        <ul className="ticket-card__items">
          {ticket.items.map((item, index) => (
            <li key={`${ticket.id}-${index}`}>
              <span className="order-card__qty">{item.quantity}×</span>
              <span className="ticket-card__item">
                <span>{item.name}</span>
                {item.modifiers.length ? (
                  <span className="ticket-card__mod">+ {item.modifiers.join(", ")}</span>
                ) : null}
                {item.notes ? <span className="ticket-card__mod">» {item.notes}</span> : null}
              </span>
            </li>
          ))}
        </ul>

        {ticket.note ? <p className="ticket-card__note">{ticket.note}</p> : null}

        <div className="ticket-card__foot">
          <span className="ticket-card__elapsed" data-late={late || undefined}>
            {ticket.status === "queued"
              ? "Waiting"
              : ticket.status === "preparing"
                ? "Cooking"
                : ticket.status === "served"
                  ? "Served"
                  : "Ready"}{" "}
            {elapsedLabel(minutes)}
          </span>
          <div className="ticket-card__actions">
            {canManage && ticket.status === "queued" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => statusMutation.mutate({ id: ticket.id, status: "preparing" })}
                disabled={statusMutation.isPending}
              >
                <Flame aria-hidden="true" />
                Start
              </Button>
            ) : null}
            {canManage && (ticket.status === "queued" || ticket.status === "preparing") ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => statusMutation.mutate({ id: ticket.id, status: "ready" })}
                disabled={statusMutation.isPending}
              >
                <CircleCheck aria-hidden="true" />
                Ready
              </Button>
            ) : null}
            {canManage && ticket.status === "ready" ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => statusMutation.mutate({ id: ticket.id, status: "served" })}
                disabled={statusMutation.isPending}
              >
                <CheckCheck aria-hidden="true" />
                Served
              </Button>
            ) : null}
            {canPrint ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => printMutation.mutate(ticket)}
                loading={printing}
              >
                <Printer aria-hidden="true" />
                Print
              </Button>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  const columns: {
    status: KitchenTicketStatus;
    label: string;
    hint: string;
    icon: React.ReactNode;
  }[] = [
    { status: "queued", label: "Queued", hint: "Waiting to start", icon: <Inbox aria-hidden="true" /> },
    { status: "preparing", label: "Preparing", hint: "On the line", icon: <Flame aria-hidden="true" /> },
    { status: "ready", label: "Ready", hint: "Waiting for pickup", icon: <CircleCheck aria-hidden="true" /> },
  ];

  if (showDone) {
    columns.push({
      status: "served",
      label: "Served",
      hint: "Latest 12 bumped",
      icon: <CheckCheck aria-hidden="true" />,
    });
  }

  return (
    <>
      <PageHeader
        eyebrow={outlet?.name ?? "No outlet selected"}
        title="Kitchen display"
        description="Live tickets per station. Firing an order on the board sends it here; bumping every station forward rolls the order along too."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                stationsQuery.refetch();
                ticketsQuery.refetch();
              }}
              loading={ticketsQuery.isFetching}
            >
              <RefreshCw aria-hidden="true" />
              Refresh
            </Button>
            {canManage ? (
              <Button
                variant="primary"
                onClick={() => {
                  setActionError(null);
                  setStationsOpen(true);
                }}
              >
                <ChefHat aria-hidden="true" />
                Stations
              </Button>
            ) : null}
          </>
        }
      />

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div className="chips grow" role="group" aria-label="Filter tickets by station">
          <ChipButton active={stationFilter === "all"} onClick={() => setStationFilter("all")}>
            All stations
          </ChipButton>
          {activeStations.map((station) => (
            <ChipButton
              key={station.id}
              active={stationFilter === station.id}
              onClick={() => setStationFilter(station.id)}
            >
              {station.name}
            </ChipButton>
          ))}
        </div>
        <div className="chips" role="group" aria-label="How many tickets to show">
          <ChipButton active={!showDone} onClick={() => setShowDone(false)}>
            Live
            <span className="chip__count">
              {(counts?.queued ?? 0) + (counts?.preparing ?? 0) + (counts?.ready ?? 0)}
            </span>
          </ChipButton>
          <ChipButton active={showDone} onClick={() => setShowDone(true)}>
            Include served
          </ChipButton>
        </div>
      </div>

      {actionError && !stationForm && !printTicket ? (
        <div className="alert alert--danger" role="alert">
          <p>{actionError}</p>
        </div>
      ) : null}

      {!outletId ? (
        <div className="card">
          <EmptyState
            icon={<ChefHat aria-hidden="true" />}
            title="Choose an outlet"
            description="Stations and tickets belong to one outlet. Pick one in the top bar to open its kitchen display."
          />
        </div>
      ) : ticketsQuery.isError ? (
        <div className="card">
          <EmptyState
            icon={<Flame aria-hidden="true" />}
            title="The kitchen board could not be loaded"
            description={ticketsQuery.error instanceof Error ? ticketsQuery.error.message : "Try again."}
            actions={
              <Button variant="secondary" onClick={() => ticketsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {!stationsQuery.isLoading && !activeStations.length ? (
            <div className="alert alert--info kitchen-empty-stations" role="status">
              <p>
                This outlet has no active stations. Orders still fire from the board, but no tickets are
                created until you add one.
              </p>
              {canManage ? (
                <Button size="sm" variant="secondary" onClick={() => openStationForm()}>
                  <Plus aria-hidden="true" />
                  Add station
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className={showDone ? "order-board" : "order-board kitchen-board--three"}>
            {columns.map((column) => {
              const list = visibleTickets(column.status);
              return (
                <section className="order-column" key={column.status} aria-label={column.label}>
                  <header className="order-column__head">
                    <div className="row row-tight">
                      <span className="order-column__icon">{column.icon}</span>
                      <b>{column.label}</b>
                      <span className="chip__count">{counts?.[column.status] ?? list.length}</span>
                    </div>
                    <p className="hint">{column.hint}</p>
                  </header>
                  <div className="order-column__list">
                    {ticketsQuery.isLoading ? (
                      Array.from({ length: 2 }).map((_, index) => (
                        <div className="order-card" key={index} aria-hidden="true">
                          <div className="skeleton" style={{ height: 12, width: "70%" }} />
                          <div className="skeleton" style={{ height: 9, width: "90%" }} />
                          <div className="skeleton" style={{ height: 9, width: "45%" }} />
                        </div>
                      ))
                    ) : list.length ? (
                      list.map(renderTicket)
                    ) : (
                      <p className="order-column__empty">
                        {stationFilter === "all" ? "Nothing here right now" : "No tickets for this station"}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <Dialog
        open={stationsOpen || Boolean(stationForm)}
        onClose={closeStationDialog}
        title={stationForm ? (stationForm.id ? `Edit ${stationForm.name || "station"}` : "New station") : "Kitchen stations"}
        description={
          stationForm
            ? "Category routing decides which station receives each item."
            : `Prep points for ${outlet?.name ?? "this outlet"}. Tickets are routed by product category.`
        }
        width={stationForm ? 520 : 560}
        footer={
          stationForm ? (
            <>
              {stationForm.id ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    const station = stations.find((entry) => entry.id === stationForm.id);
                    if (station) {
                      setStationForm(null);
                      setDeleteTarget(station);
                    }
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setStationForm(null)}>
                Back
              </Button>
              <Button
                variant="primary"
                loading={saveStationMutation.isPending}
                onClick={() => stationForm && saveStationMutation.mutate(stationForm)}
              >
                {stationForm.id ? "Save station" : "Add station"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={closeStationDialog}>
                Close
              </Button>
              <Button variant="primary" onClick={() => openStationForm()}>
                <Plus aria-hidden="true" />
                New station
              </Button>
            </>
          )
        }
      >
        {stationForm ? (
          <div className="stack-sm">
            {actionError ? (
              <div className="alert alert--danger" role="alert">
                <p>{actionError}</p>
              </div>
            ) : null}
            <div className="grid-2">
              <Field label="Name" htmlFor="station-name" required hint="Shown on the kitchen screen and ticket.">
                <Input
                  id="station-name"
                  value={stationForm.name}
                  onChange={(event) => setStationForm({ ...stationForm, name: event.target.value })}
                  placeholder="Grill"
                  autoComplete="off"
                  autoFocus
                />
              </Field>
              <Field label="Code" htmlFor="station-code" hint="Optional. Derived from the name.">
                <Input
                  id="station-code"
                  value={stationForm.code}
                  onChange={(event) => setStationForm({ ...stationForm, code: event.target.value })}
                  placeholder="GRL"
                  autoComplete="off"
                />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Kind" htmlFor="station-kind">
                <Select
                  id="station-kind"
                  value={stationForm.kind}
                  onChange={(event) =>
                    setStationForm({ ...stationForm, kind: event.target.value as KitchenStationKind })
                  }
                >
                  {STATION_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {stationKindLabel(kind)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Order" htmlFor="station-order" hint="Lower numbers appear first.">
                <Input
                  id="station-order"
                  type="number"
                  min={0}
                  max={999}
                  value={stationForm.sortOrder}
                  onChange={(event) => setStationForm({ ...stationForm, sortOrder: event.target.value })}
                />
              </Field>
            </div>

            <Field label="Categories" hint="Items in these categories print here. Anything else falls back to the default station.">
              {canSeeCategories ? (
                categoriesQuery.isLoading ? (
                  <span className="hint">Loading categories…</span>
                ) : categoriesQuery.isError ? (
                  <span className="hint">Categories could not be loaded.</span>
                ) : (
                  <div className="kitchen-category-list">
                    {(categoriesQuery.data ?? []).map((category) => (
                      <Checkbox
                        key={category.id}
                        label={category.name}
                        checked={stationForm.categoryIds.includes(category.id)}
                        onChange={(event) => {
                          const categoryIds = event.target.checked
                            ? [...stationForm.categoryIds, category.id]
                            : stationForm.categoryIds.filter((id) => id !== category.id);
                          setStationForm({ ...stationForm, categoryIds });
                        }}
                      />
                    ))}
                    {categoriesQuery.data?.length ? null : (
                      <span className="hint">No categories yet.</span>
                    )}
                  </div>
                )
              ) : (
                <span className="hint">Category routing needs product access. You can still save the station.</span>
              )}
            </Field>

            <div className="grid-2">
              <Field label="Printer name" htmlFor="station-printer" hint="Optional label.">
                <Input
                  id="station-printer"
                  value={stationForm.printerName}
                  onChange={(event) => setStationForm({ ...stationForm, printerName: event.target.value })}
                  placeholder="Bar printer"
                  autoComplete="off"
                />
              </Field>
              <Field label="Printer target" htmlFor="station-target" hint="IP, queue, or driver name.">
                <Input
                  id="station-target"
                  value={stationForm.printerTarget}
                  onChange={(event) => setStationForm({ ...stationForm, printerTarget: event.target.value })}
                  placeholder="tcp://192.168.1.51:9100"
                  autoComplete="off"
                />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Copies" htmlFor="station-copies">
                <Input
                  id="station-copies"
                  type="number"
                  min={1}
                  max={5}
                  value={stationForm.copies}
                  onChange={(event) => setStationForm({ ...stationForm, copies: event.target.value })}
                />
              </Field>
              <div className="stack-sm" style={{ paddingTop: 22 }}>
                <Checkbox
                  label="Auto print on fire"
                  checked={stationForm.autoPrint}
                  onChange={(event) => setStationForm({ ...stationForm, autoPrint: event.target.checked })}
                />
              </div>
            </div>
            <Checkbox
              label="Default station"
              description="Catches items whose category is not routed to another station."
              checked={stationForm.isDefault}
              onChange={(event) => setStationForm({ ...stationForm, isDefault: event.target.checked })}
            />
            <Checkbox
              label="Station is active"
              description="Inactive stations stop receiving new tickets."
              checked={stationForm.isActive}
              onChange={(event) => setStationForm({ ...stationForm, isActive: event.target.checked })}
            />
          </div>
        ) : (
          <div className="stack-sm">
            {actionError ? (
              <div className="alert alert--danger" role="alert">
                <p>{actionError}</p>
              </div>
            ) : null}
            {stationsQuery.isLoading ? (
              <div className="stack-sm" aria-hidden="true">
                <div className="skeleton" style={{ height: 42 }} />
                <div className="skeleton" style={{ height: 42 }} />
              </div>
            ) : stations.length ? (
              <div className="kitchen-station-list">
                {stations.map((station) => (
                  <div className="kitchen-station-row" key={station.id} data-inactive={!station.isActive || undefined}>
                    <div style={{ minWidth: 0 }}>
                      <div className="row row-tight">
                        <b>{station.name}</b>
                        <Badge tone={station.isActive ? "success" : "neutral"} dot>
                          {station.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {station.isDefault ? <Badge tone="brand">Default</Badge> : null}
                      </div>
                      <span className="hint">
                        {stationKindLabel(station.kind)} · {station.code} · {station.copies}{" "}
                        {station.copies === 1 ? "copy" : "copies"}
                        {station.autoPrint ? " · auto print" : ""}
                      </span>
                      <span className="hint">
                        {station.categories.length
                          ? station.categories.map((category) => category.name).join(", ")
                          : "Fallback for unrouted items"}
                      </span>
                    </div>
                    {canManage ? (
                      <div className="kitchen-station-row__tools">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${station.name}`}
                          onClick={() => openStationForm(station)}
                        >
                          <Pencil aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Delete ${station.name}`}
                          onClick={() => {
                            setActionError(null);
                            setDeleteTarget(station);
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ChefHat aria-hidden="true" />}
                title="No stations yet"
                description="Add a station for each prep point. Without one, firing an order creates no tickets."
              />
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "station"}?`}
        width={430}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={removeStationMutation.isPending}
              onClick={() => deleteTarget && removeStationMutation.mutate(deleteTarget)}
            >
              Delete station
            </Button>
          </>
        }
      >
        <div className="stack-sm">
          {actionError ? (
            <div className="alert alert--danger" role="alert">
              <p>{actionError}</p>
            </div>
          ) : null}
          <p style={{ fontSize: 13, lineHeight: 1.55, color: "hsl(var(--ink-2))" }}>
            Stations that already printed tickets cannot be deleted. Deactivate them instead so their history
            stays intact.
          </p>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(printTicket)}
        onClose={() => setPrintTicket(null)}
        title={`Ticket ${printTicket?.ticketNumber ?? ""}`}
        description={
          printTicket
            ? `${printTicket.station.name} · printed ${printTicket.printCount} ${
                printTicket.printCount === 1 ? "time" : "times"
              }`
            : undefined
        }
        className="dialog--print"
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPrintTicket(null)}>
              Close
            </Button>
            {printTicket && canPrint ? (
              <Button
                variant="primary"
                onClick={() => {
                  window.print();
                  markPrintedMutation.mutate(printTicket);
                }}
                loading={markPrintedMutation.isPending}
              >
                <Printer aria-hidden="true" />
                Print
              </Button>
            ) : null}
          </>
        }
      >
        <pre className="ticket-print">{printTicket?.text ?? ""}</pre>
      </Dialog>
    </>
  );
}
