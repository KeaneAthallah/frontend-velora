"use client";

// Opt out of instant-navigation validation: this page renders data-dependent client UI.
export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BrushCleaning,
  CalendarClock,
  CircleCheck,
  LayoutGrid,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  Users,
  UtensilsCrossed,
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
  createArea,
  createTable,
  deleteArea,
  deleteTable,
  listFloorPlan,
  setTableStatus,
  updateArea,
  updateTable,
  type ManualTableStatus,
  type TableUpdate,
} from "@/lib/api/tables";
import type { DiningTable, FloorArea, TableShape, TableStatus } from "@/lib/api/types";
import { formatCurrency } from "@/lib/formatting/currency";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";

const STATUS_TONE: Record<TableStatus, "success" | "danger" | "warning" | "neutral"> = {
  available: "success",
  occupied: "danger",
  reserved: "warning",
  cleaning: "neutral",
};

const STATUS_LABEL: Record<TableStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  cleaning: "Cleaning",
};

const STATUS_FILTERS: { value: "" | TableStatus; label: string }[] = [
  { value: "", label: "All tables" },
  { value: "available", label: "Free" },
  { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" },
  { value: "cleaning", label: "Cleaning" },
];

const SHAPES: { value: TableShape; label: string }[] = [
  { value: "round", label: "Round" },
  { value: "square", label: "Square" },
  { value: "rect", label: "Rectangle" },
];

type TableFormState = {
  id?: string;
  name: string;
  areaId: string;
  seats: string;
  shape: TableShape;
  status: ManualTableStatus;
  isActive: boolean;
  notes: string;
};

type AreaFormState = {
  id?: string;
  name: string;
  sortOrder: string;
};

function emptyTableForm(): TableFormState {
  return {
    name: "",
    areaId: "",
    seats: "2",
    shape: "square",
    status: "available",
    isActive: true,
    notes: "",
  };
}

function waitedMinutes(iso: string) {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.round((Date.now() - created) / 60_000));
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function TablesPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId, outlet } = useBusiness();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const currency = session?.business.currency ?? "IDR";
  const canManage = has("tables.manage");
  const canSell = has("sales.create");

  const [filter, setFilter] = React.useState<"" | TableStatus>("");
  const [tableForm, setTableForm] = React.useState<TableFormState | null>(null);
  const [areaForm, setAreaForm] = React.useState<AreaFormState | null>(null);
  const [deleteTableTarget, setDeleteTableTarget] = React.useState<DiningTable | null>(null);
  const [deleteAreaTarget, setDeleteAreaTarget] = React.useState<FloorArea | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const planQuery = useQuery({
    queryKey: ["floor-plan", outletId],
    queryFn: () => listFloorPlan({ outletId: outletId ?? undefined }),
    enabled: has("tables.view") && Boolean(outletId),
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const plan = planQuery.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["floor-plan"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ManualTableStatus }) =>
      setTableStatus(id, status),
    onSuccess: (table) => {
      setActionError(null);
      invalidate();
      push({ title: `${table.name} is ${STATUS_LABEL[table.status].toLowerCase()}`, variant: "success" });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "The table could not be updated"),
  });

  const saveTableMutation = useMutation({
    mutationFn: (form: TableFormState) => {
      if (!outletId) throw new Error("Choose an outlet before editing the floor plan");
      if (!form.name.trim()) throw new Error("Give the table a name");

      const input: TableUpdate = {
        name: form.name.trim(),
        floorAreaId: form.areaId || null,
        seats: Number(form.seats) || 1,
        shape: form.shape,
        status: form.status,
        isActive: form.isActive,
        notes: form.notes.trim(),
      };

      return form.id
        ? updateTable(form.id, input)
        : createTable({ ...input, outletId, name: form.name.trim() });
    },
    onSuccess: (table, form) => {
      setTableForm(null);
      setActionError(null);
      invalidate();
      push({ title: form.id ? `${table.name} saved` : `${table.name} added`, variant: "success" });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "The table could not be saved"),
  });

  const removeTableMutation = useMutation({
    mutationFn: (table: DiningTable) => deleteTable(table.id),
    onSuccess: () => {
      setDeleteTableTarget(null);
      setActionError(null);
      invalidate();
      push({ title: "Table deleted", variant: "success" });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "The table could not be deleted"),
  });

  const saveAreaMutation = useMutation({
    mutationFn: (form: AreaFormState) => {
      if (!outletId) throw new Error("Choose an outlet before editing the floor plan");
      if (!form.name.trim()) throw new Error("Give the area a name");

      return form.id
        ? updateArea(form.id, { name: form.name.trim(), sortOrder: Number(form.sortOrder) || 0 })
        : createArea({ outletId, name: form.name.trim(), sortOrder: Number(form.sortOrder) || 0 });
    },
    onSuccess: (area) => {
      setAreaForm(null);
      setActionError(null);
      invalidate();
      push({ title: `${area.name} saved`, variant: "success" });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "The area could not be saved"),
  });

  const removeAreaMutation = useMutation({
    mutationFn: (area: FloorArea) => deleteArea(area.id),
    onSuccess: () => {
      setDeleteAreaTarget(null);
      setActionError(null);
      invalidate();
      push({ title: "Area deleted", variant: "success" });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "The area could not be deleted"),
  });

  if (!has("tables.view")) {
    return <AccessDenied />;
  }

  const tables = plan?.tables ?? [];
  const counts = {
    available: tables.filter((table) => table.status === "available").length,
    occupied: tables.filter((table) => table.status === "occupied").length,
    reserved: tables.filter((table) => table.status === "reserved").length,
    cleaning: tables.filter((table) => table.status === "cleaning").length,
  };

  const visible = (list: DiningTable[]) =>
    filter ? list.filter((table) => table.status === filter) : list;

  const groups = (plan?.areas ?? [])
    .map((area) => ({
      area,
      tables: visible(tables.filter((table) => table.area?.id === area.id)),
    }))
    .filter((group) => !filter || group.tables.length > 0);

  const unassigned = visible(tables.filter((table) => !table.area));
  const noMatches = Boolean(filter) && !groups.length && !unassigned.length;

  const openTableForm = (table?: DiningTable) => {
    setActionError(null);
    setTableForm(
      table
        ? {
            id: table.id,
            name: table.name,
            areaId: table.area?.id ?? "",
            seats: String(table.seats),
            shape: table.shape,
            status: table.manualStatus,
            isActive: table.isActive,
            notes: table.notes ?? "",
          }
        : emptyTableForm()
    );
  };

  const openAreaForm = (area?: FloorArea) => {
    setActionError(null);
    setAreaForm(
      area
        ? { id: area.id, name: area.name, sortOrder: String(area.sortOrder) }
        : { name: "", sortOrder: String((plan?.areas.length ?? 0) + 1) }
    );
  };

  const renderCard = (table: DiningTable) => {
    const order = table.activeOrder;
    const canSeat = !table.occupied && table.manualStatus !== "cleaning" && canSell;
    const resumeHref = canSell ? `/sales?order=${encodeURIComponent(order?.id ?? "")}` : "/orders";

    return (
      <article className="table-card" key={table.id} data-status={table.status}>
        <div className="table-card__head">
          <div style={{ minWidth: 0 }}>
            <b className="table-card__name">{table.name}</b>
            <span className="table-card__seats">
              <Users aria-hidden="true" />
              {plural(table.seats, "seat")}
              {table.area ? ` · ${table.area.name}` : ""}
            </span>
          </div>
          <Badge tone={STATUS_TONE[table.status]} dot>
            {STATUS_LABEL[table.status]}
          </Badge>
        </div>

        {order ? (
          <div className="table-card__order">
            <span className="mono">{order.orderNumber}</span>
            <span className="hint">
              {plural(order.itemsCount, "item")} · {formatCurrency(order.total, currency)} · {waitedMinutes(order.createdAt)}m
            </span>
            {table.notes ? <span className="table-card__note">{table.notes}</span> : null}
          </div>
        ) : (
          <div className="table-card__order table-card__order--empty">
            <span className="hint">
              {table.isActive
                ? table.notes || (table.manualStatus === "reserved" ? "Held for a reservation" : "Ready for guests")
                : "Inactive · not bookable"}
            </span>
          </div>
        )}

        <div className="table-card__actions">
          {order ? (
            <Link href={resumeHref} className="btn btn--primary btn--sm">
              <ReceiptText aria-hidden="true" />
              Resume tab
            </Link>
          ) : canSeat ? (
            <Link
              href={`/sales?table=${encodeURIComponent(table.id)}`}
              className="btn btn--primary btn--sm"
            >
              <UtensilsCrossed aria-hidden="true" />
              Open tab
            </Link>
          ) : null}

          {canManage && !order ? (
            <div className="table-card__tools">
              {table.manualStatus !== "available" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => statusMutation.mutate({ id: table.id, status: "available" })}
                  disabled={statusMutation.isPending}
                >
                  <CircleCheck aria-hidden="true" />
                  Free
                </Button>
              ) : null}
              {table.manualStatus === "available" ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => statusMutation.mutate({ id: table.id, status: "reserved" })}
                    disabled={statusMutation.isPending}
                  >
                    <CalendarClock aria-hidden="true" />
                    Reserve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => statusMutation.mutate({ id: table.id, status: "cleaning" })}
                    disabled={statusMutation.isPending}
                  >
                    <BrushCleaning aria-hidden="true" />
                    Cleaning
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          {canManage ? (
            <button
              type="button"
              className="icon-btn"
              aria-label={`Edit ${table.name}`}
              onClick={() => openTableForm(table)}
            >
              <Pencil aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </article>
    );
  };

  const renderSection = (key: string, title: string, list: DiningTable[], area?: FloorArea) => (
    <section className="floor-area" key={key} aria-label={title}>
      <header className="floor-area__head">
        <div>
          <b>{title}</b>
          <span className="hint">
            {list.length ? plural(list.length, "table") : "No tables here yet"}
          </span>
        </div>
        {canManage && area ? (
          <div className="floor-area__tools">
            <button
              type="button"
              className="icon-btn"
              aria-label={`Edit ${area.name}`}
              onClick={() => openAreaForm(area)}
            >
              <Pencil aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Delete ${area.name}`}
              onClick={() => {
                setActionError(null);
                setDeleteAreaTarget(area);
              }}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </header>
      {list.length ? (
        <div className="floor-grid">{list.map(renderCard)}</div>
      ) : (
        <p className="floor-area__empty">
          {filter ? "No tables match this filter" : "Add a table to start taking dine-in orders."}
        </p>
      )}
    </section>
  );

  return (
    <>
      <PageHeader
        eyebrow={outlet?.name ?? "No outlet selected"}
        title="Floor plan"
        description="Live table occupancy. Opening a tab never moves stock; the table frees itself when the order is checked out or cancelled."
        actions={
          <>
            <Button variant="secondary" onClick={() => planQuery.refetch()} loading={planQuery.isFetching}>
              <RefreshCw aria-hidden="true" />
              Refresh
            </Button>
            {canManage ? (
              <>
                <Button variant="secondary" onClick={() => openAreaForm()}>
                  <LayoutGrid aria-hidden="true" />
                  New area
                </Button>
                <Button variant="primary" onClick={() => openTableForm()}>
                  <Plus aria-hidden="true" />
                  Add table
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="chips" role="group" aria-label="Filter tables by status">
        {STATUS_FILTERS.map((entry) => (
          <ChipButton
            key={entry.value || "all"}
            active={filter === entry.value}
            count={entry.value ? counts[entry.value] : tables.length}
            onClick={() => setFilter(entry.value)}
          >
            {entry.label}
          </ChipButton>
        ))}
      </div>

      {actionError && !tableForm && !areaForm ? (
        <div className="alert alert--danger" role="alert">
          <p>{actionError}</p>
        </div>
      ) : null}

      {!outletId ? (
        <div className="card">
          <EmptyState
            icon={<LayoutGrid aria-hidden="true" />}
            title="Choose an outlet"
            description="The floor plan is scoped to one outlet. Pick one in the top bar to see its tables."
          />
        </div>
      ) : planQuery.isError ? (
        <div className="card">
          <EmptyState
            icon={<LayoutGrid aria-hidden="true" />}
            title="Floor plan could not be loaded"
            description={planQuery.error instanceof Error ? planQuery.error.message : "Try again."}
            actions={
              <Button variant="secondary" onClick={() => planQuery.refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : planQuery.isLoading ? (
        <div className="floor-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="table-card" key={index} aria-hidden="true">
              <div className="skeleton" style={{ height: 14, width: "45%" }} />
              <div className="skeleton" style={{ height: 9, width: "70%" }} />
              <div className="skeleton" style={{ height: 30, width: "100%" }} />
            </div>
          ))}
        </div>
      ) : !tables.length ? (
        <div className="card">
          <EmptyState
            icon={<LayoutGrid aria-hidden="true" />}
            title="No tables yet"
            description="Add areas and tables so the register can take dine-in orders and the kitchen knows where food is going."
            actions={
              canManage ? (
                <Button variant="primary" onClick={() => openTableForm()}>
                  <Plus aria-hidden="true" />
                  Add the first table
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : noMatches ? (
        <div className="card">
          <EmptyState
            icon={<LayoutGrid aria-hidden="true" />}
            title="No tables match this filter"
            description="Pick another status or add a table for this outlet."
            actions={
              <Button variant="secondary" onClick={() => setFilter("")}>
                Show all tables
              </Button>
            }
          />
        </div>
      ) : (
        <div className="floor-plan">
          {groups.map((group) => renderSection(group.area.id, group.area.name, group.tables, group.area))}
          {unassigned.length || (!filter && tables.some((table) => !table.area)) ? (
            renderSection("unassigned", "No area", unassigned)
          ) : null}
        </div>
      )}

      <Dialog
        open={Boolean(tableForm)}
        onClose={() => setTableForm(null)}
        title={tableForm?.id ? `Edit ${tableForm.name || "table"}` : "Add a table"}
        description="Tables belong to the outlet selected in the top bar."
        width={470}
        footer={
          tableForm ? (
            <>
              {tableForm.id ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    const table = tables.find((entry) => entry.id === tableForm.id);
                    if (table) {
                      setTableForm(null);
                      setDeleteTableTarget(table);
                    }
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setTableForm(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={saveTableMutation.isPending}
                onClick={() => tableForm && saveTableMutation.mutate(tableForm)}
              >
                {tableForm.id ? "Save table" : "Add table"}
              </Button>
            </>
          ) : null
        }
      >
        {tableForm ? (
          <div className="stack-sm">
            {actionError ? (
              <div className="alert alert--danger" role="alert">
                <p>{actionError}</p>
              </div>
            ) : null}
            <Field label="Name" htmlFor="table-name" required hint="Shown on the floor plan, receipts and the order board.">
              <Input
                id="table-name"
                value={tableForm.name}
                onChange={(event) => setTableForm({ ...tableForm, name: event.target.value })}
                placeholder="T01"
                autoComplete="off"
                autoFocus
              />
            </Field>
            <div className="grid-2">
              <Field label="Seats" htmlFor="table-seats" required>
                <Input
                  id="table-seats"
                  type="number"
                  min={1}
                  max={200}
                  value={tableForm.seats}
                  onChange={(event) => setTableForm({ ...tableForm, seats: event.target.value })}
                />
              </Field>
              <Field label="Shape" htmlFor="table-shape">
                <Select
                  id="table-shape"
                  value={tableForm.shape}
                  onChange={(event) =>
                    setTableForm({ ...tableForm, shape: event.target.value as TableShape })
                  }
                >
                  {SHAPES.map((shape) => (
                    <option key={shape.value} value={shape.value}>
                      {shape.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Area" htmlFor="table-area" hint="Group tables by room so servers can find them faster.">
              <Select
                id="table-area"
                value={tableForm.areaId}
                onChange={(event) => setTableForm({ ...tableForm, areaId: event.target.value })}
              >
                <option value="">No area</option>
                {(plan?.areas ?? []).map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid-2">
              <Field label="Manual status" htmlFor="table-status" hint="Occupancy always comes first.">
                <Select
                  id="table-status"
                  value={tableForm.status}
                  onChange={(event) =>
                    setTableForm({ ...tableForm, status: event.target.value as ManualTableStatus })
                  }
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="cleaning">Cleaning</option>
                </Select>
              </Field>
              <Field label="Note" htmlFor="table-note" hint="Optional.">
                <Input
                  id="table-note"
                  value={tableForm.notes}
                  onChange={(event) => setTableForm({ ...tableForm, notes: event.target.value })}
                  placeholder="Window seat"
                  autoComplete="off"
                />
              </Field>
            </div>
            <Checkbox
              label="Table is active"
              description="Inactive tables stay out of the register and the floor plan."
              checked={tableForm.isActive}
              onChange={(event) => setTableForm({ ...tableForm, isActive: event.target.checked })}
            />
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(areaForm)}
        onClose={() => setAreaForm(null)}
        title={areaForm?.id ? `Edit ${areaForm.name || "area"}` : "New area"}
        description="Areas group tables by room, floor or terrace."
        width={420}
        footer={
          areaForm ? (
            <>
              {areaForm.id ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    const area = plan?.areas.find((entry) => entry.id === areaForm.id);
                    if (area) {
                      setAreaForm(null);
                      setDeleteAreaTarget(area);
                    }
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setAreaForm(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={saveAreaMutation.isPending}
                onClick={() => areaForm && saveAreaMutation.mutate(areaForm)}
              >
                {areaForm.id ? "Save area" : "Add area"}
              </Button>
            </>
          ) : null
        }
      >
        {areaForm ? (
          <div className="stack-sm">
            {actionError ? (
              <div className="alert alert--danger" role="alert">
                <p>{actionError}</p>
              </div>
            ) : null}
            <Field label="Name" htmlFor="area-name" required>
              <Input
                id="area-name"
                value={areaForm.name}
                onChange={(event) => setAreaForm({ ...areaForm, name: event.target.value })}
                placeholder="Main hall"
                autoComplete="off"
                autoFocus
              />
            </Field>
            <Field label="Order" htmlFor="area-order" hint="Lower numbers appear first on the floor plan.">
              <Input
                id="area-order"
                type="number"
                min={0}
                max={999}
                value={areaForm.sortOrder}
                onChange={(event) => setAreaForm({ ...areaForm, sortOrder: event.target.value })}
              />
            </Field>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(deleteTableTarget)}
        onClose={() => setDeleteTableTarget(null)}
        title={`Delete ${deleteTableTarget?.name ?? "table"}?`}
        width={430}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTableTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={removeTableMutation.isPending}
              onClick={() => deleteTableTarget && removeTableMutation.mutate(deleteTableTarget)}
            >
              Delete table
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
            Tables with sales history cannot be deleted; deactivate them instead. This cannot be undone.
          </p>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deleteAreaTarget)}
        onClose={() => setDeleteAreaTarget(null)}
        title={`Delete ${deleteAreaTarget?.name ?? "area"}?`}
        width={430}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteAreaTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={removeAreaMutation.isPending}
              onClick={() => deleteAreaTarget && removeAreaMutation.mutate(deleteAreaTarget)}
            >
              Delete area
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
            Areas that still contain tables cannot be deleted. Move the tables first.
          </p>
        </div>
      </Dialog>
    </>
  );
}
