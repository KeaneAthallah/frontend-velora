"use client";

export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, HandCoins, Plus, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, Button, EmptyState, Field, IconButton, Input, Select } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  createPayrollStructure,
  deletePayrollStructure,
  listPayrollStructures,
  updatePayrollStructure,
  type PayrollItems,
  type PayrollStructure,
  type PayrollType,
} from "@/lib/api/payroll";
import { listEmployees } from "@/lib/api/employees";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatCurrency } from "@/lib/formatting/currency";

type ItemRow = { key: string; label: string; amount: string };

const newRow = (): ItemRow => ({ key: Math.random().toString(36).slice(2), label: "", amount: "" });

const toRows = (items: PayrollItems): ItemRow[] =>
  Object.entries(items).map(([label, amount]) => ({
    key: Math.random().toString(36).slice(2),
    label,
    amount: String(amount),
  }));

const toItems = (rows: ItemRow[]): PayrollItems => {
  const result: PayrollItems = {};
  for (const row of rows) {
    const label = row.label.trim();
    if (!label) continue;
    result[label] = Math.round(Number(row.amount || 0));
  }
  return result;
};

const total = (items: PayrollItems) => Object.values(items).reduce((sum, amount) => sum + amount, 0);

export default function PayrollStructuresPage() {
  const { has } = usePermissions();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PayrollStructure | null>(null);

  const canRead = has("payroll.view");
  const canManage = has("payroll.manage");

  const structures = useQuery({
    queryKey: ["payroll", "structures"],
    queryFn: () => listPayrollStructures(),
    enabled: canRead,
    staleTime: 30_000,
  });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees(),
    enabled: canRead && canManage,
    staleTime: 60_000,
  });

  if (!canRead) {
    return <AccessDenied permission="payroll.view" />;
  }

  const rows = structures.data ?? [];
  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (structure: PayrollStructure) => {
    setEditing(structure);
    setEditorOpen(true);
  };

  const columns: Column<PayrollStructure>[] = [
    {
      id: "person",
      header: "Person",
      sortable: true,
      sortValue: (structure) => structure.name,
      cell: (structure) => (
        <div>
          <div style={{ fontWeight: 600 }}>{structure.name || structure.email}</div>
          <div className="hint">{structure.email}</div>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      sortable: true,
      sortValue: (structure) => structure.type,
      cell: (structure) => (
        <Badge tone={structure.type === "hourly" ? "info" : "brand"}>
          {structure.type === "hourly" ? "Hourly" : "Fixed"}
        </Badge>
      ),
    },
    {
      id: "pay",
      header: "Pay",
      align: "right",
      cell: (structure) => (
        <div>
          <div className="num">{formatCurrency(structure.type === "hourly" ? structure.hourlyRate : structure.baseSalary)}</div>
          <div className="hint">{structure.type === "hourly" ? "per hour" : "per month"}</div>
        </div>
      ),
    },
    {
      id: "allowances",
      header: "Allowances",
      align: "right",
      cell: (structure) => (
        <span className="num" title={Object.keys(structure.allowances).join(", ") || undefined}>
          {total(structure.allowances) ? formatCurrency(total(structure.allowances)) : "—"}
        </span>
      ),
    },
    {
      id: "deductions",
      header: "Deductions",
      align: "right",
      cell: (structure) => (
        <span className="num cell-muted" title={Object.keys(structure.deductions).join(", ") || undefined}>
          {total(structure.deductions) ? formatCurrency(total(structure.deductions)) : "—"}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            cell: (structure: PayrollStructure) => (
              <Button
                variant="quiet"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openEdit(structure);
                }}
              >
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Payroll"
        title="Salary structures"
        description="What each person earns before a run. Hourly pay uses closed attendance hours for the month."
        actions={
          <>
            <Link href="/payroll" className="btn btn--quiet btn--sm">
              <ArrowLeft aria-hidden="true" />
              Payroll
            </Link>
            {canManage ? (
              <Button variant="primary" onClick={openNew}>
                <Plus aria-hidden="true" />
                Add structure
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        {structures.isError ? (
          <InlineError
            title="Salary structures could not be loaded"
            error={structures.error}
            onRetry={() => structures.refetch()}
          />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowId={(structure) => structure.id}
            loading={structures.isLoading}
            minWidth={760}
            onRowClick={canManage ? openEdit : undefined}
            empty={
              <EmptyState
                icon={<HandCoins aria-hidden="true" />}
                title="No salary structures yet"
                description="Add one per team member so payroll knows what to pay them each month."
                actions={
                  canManage ? (
                    <Button variant="primary" onClick={openNew}>
                      Add the first structure
                    </Button>
                  ) : (
                    <span className="hint">Ask a manager to set up payroll.</span>
                  )
                }
              />
            }
            mobile={(structure) => (
              <button
                type="button"
                className="record"
                onClick={() => canManage && openEdit(structure)}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: 0 }}
              >
                <div className="record__head">
                  <strong>{structure.name || structure.email}</strong>
                  <span className="num">
                    {formatCurrency(structure.type === "hourly" ? structure.hourlyRate : structure.baseSalary)}
                  </span>
                </div>
                <div className="record__meta">
                  <span>{structure.type === "hourly" ? "Per hour" : "Per month"}</span>
                  <span>{total(structure.allowances) ? `Allowances ${formatCurrency(total(structure.allowances))}` : "No allowances"}</span>
                </div>
              </button>
            )}
          />
        )}
      </Card>

      <StructureEditor
        open={editorOpen}
        structure={editing}
        canManage={canManage}
        employees={employees.data ?? []}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  );
}

function StructureEditor({
  open,
  structure,
  canManage,
  employees,
  onClose,
}: {
  open: boolean;
  structure: PayrollStructure | null;
  canManage: boolean;
  employees: { userId?: string; name: string; email: string; active: boolean }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [form, setForm] = React.useState<{
    userId: string;
    type: PayrollType;
    amount: string;
    allowances: ItemRow[];
    deductions: ItemRow[];
  }>({
    userId: "",
    type: "fixed",
    amount: "0",
    allowances: [newRow()],
    deductions: [],
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      structure
        ? {
            userId: structure.userId,
            type: structure.type,
            amount: String(structure.type === "hourly" ? structure.hourlyRate : structure.baseSalary),
            allowances: toRows(structure.allowances).length ? toRows(structure.allowances) : [newRow()],
            deductions: toRows(structure.deductions),
          }
        : { userId: "", type: "fixed", amount: "0", allowances: [newRow()], deductions: [] }
    );
  }, [open, structure]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["payroll"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const next: Record<string, string> = {};
      const amount = Math.round(Number(form.amount || 0));
      if (!structure && !form.userId) next.userId = "Choose who this structure is for.";
      if (!Number.isFinite(amount) || amount <= 0) {
        next.amount = form.type === "hourly" ? "Enter an hourly rate." : "Enter a monthly salary.";
      }
      for (const row of [...form.allowances, ...form.deductions]) {
        if (row.label.trim() && (!Number.isFinite(Number(row.amount)) || Number(row.amount) < 0)) {
          next.items = "Every allowance and deduction needs an amount of zero or more.";
        }
      }
      setErrors(next);
      if (Object.keys(next).length) throw new Error("Check the highlighted fields");

      const payload = {
        type: form.type,
        baseSalary: form.type === "fixed" ? amount : 0,
        hourlyRate: form.type === "hourly" ? amount : 0,
        allowances: toItems(form.allowances),
        deductions: toItems(form.deductions),
      };
      if (structure) return updatePayrollStructure(structure.id, payload);
      return createPayrollStructure({ userId: form.userId, ...payload });
    },
    onSuccess: (saved) => {
      push({
        title: structure ? "Structure updated" : "Structure added",
        description: `${saved.name || saved.email} is on payroll. Generate or regenerate a draft run to apply it.`,
        variant: "success",
      });
      invalidate();
      onClose();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Check the highlighted fields") return;
      setErrors((current) => ({
        ...current,
        form: error instanceof Error ? error.message : "The structure could not be saved.",
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePayrollStructure(structure!.id),
    onSuccess: () => {
      push({
        title: "Structure removed",
        description: `${structure?.name || structure?.email} will not be paid next month. Earlier runs are unchanged.`,
        variant: "success",
      });
      invalidate();
      setDeleteOpen(false);
      onClose();
    },
    onError: (error) => {
      setErrors((current) => ({
        ...current,
        form: error instanceof Error ? error.message : "The structure could not be removed.",
      }));
      setDeleteOpen(false);
    },
  });

  const taken = employees
    .filter((employee) => employee.userId)
    .map((employee) => employee.userId!);
  const selectable = employees.filter(
    (employee) => employee.userId && employee.active && (!taken.includes(employee.userId) || employee.userId === structure?.userId)
  );

  const setRows = (field: "allowances" | "deductions", rows: ItemRow[]) =>
    setForm((current) => ({ ...current, [field]: rows }));

  const itemEditor = (field: "allowances" | "deductions", label: string, hint: string, addLabel: string) => (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
          <div className="hint">{hint}</div>
        </div>
        <Button variant="quiet" size="sm" onClick={() => setRows(field, [...form[field], newRow()])}>
          <Plus aria-hidden="true" />
          {addLabel}
        </Button>
      </div>
      {form[field].length === 0 ? <p className="hint" style={{ margin: 0 }}>None.</p> : null}
      {form[field].map((row) => (
        <div key={row.key} className="row" style={{ gap: 8 }}>
          <Input
            aria-label={`${label} label`}
            placeholder="Transport"
            value={row.label}
            onChange={(event) =>
              setRows(
                field,
                form[field].map((entry) => (entry.key === row.key ? { ...entry, label: event.target.value } : entry))
              )
            }
          />
          <Input
            aria-label={`${label} amount`}
            placeholder="0"
            inputMode="numeric"
            value={row.amount}
            style={{ maxWidth: 140 }}
            onChange={(event) =>
              setRows(
                field,
                form[field].map((entry) => (entry.key === row.key ? { ...entry, amount: event.target.value } : entry))
              )
            }
          />
          <IconButton
            label={`Remove ${row.label || label.toLowerCase()}`}
            bordered
            onClick={() => setRows(field, form[field].filter((entry) => entry.key !== row.key))}
          >
            <X aria-hidden="true" />
          </IconButton>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={structure ? (canManage ? "Edit salary structure" : "Salary structure") : "Add salary structure"}
        description="Fixed pay is a monthly salary. Hourly pay multiplies the rate by closed attendance hours."
        width={540}
        footer={
          canManage ? (
            <>
              {structure ? (
                <Button variant="danger-quiet" onClick={() => setDeleteOpen(true)} disabled={saveMutation.isPending}>
                  <Trash2 aria-hidden="true" />
                  Remove
                </Button>
              ) : null}
              <Button variant="ghost" onClick={onClose} disabled={saveMutation.isPending} style={{ marginLeft: structure ? 0 : "auto" }}>
                Cancel
              </Button>
              <Button type="submit" form="structure-editor" variant="primary" loading={saveMutation.isPending}>
                {structure ? "Save changes" : "Add to payroll"}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onClose} style={{ marginLeft: "auto" }}>
              Close
            </Button>
          )
        }
      >
        <form
          id="structure-editor"
          className="stack"
          style={{ gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          {errors.form ? (
            <div className="alert alert--danger" role="alert">
              {errors.form}
            </div>
          ) : null}
          {structure ? (
            <div>
              <div className="hint">{structure.email}</div>
              <strong style={{ fontSize: 16 }}>{structure.name}</strong>
            </div>
          ) : (
            <Field label="Team member" htmlFor="structure-user" required error={errors.userId}>
              <Select
                id="structure-user"
                value={form.userId}
                onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
                disabled={!canManage}
              >
                <option value="">Choose someone</option>
                {selectable.map((employee) => (
                  <option key={employee.userId} value={employee.userId}>
                    {employee.name || employee.email}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="Pay type" htmlFor="structure-type">
              <Select
                id="structure-type"
                value={form.type}
                disabled={!canManage}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as PayrollType }))}
              >
                <option value="fixed">Fixed monthly</option>
                <option value="hourly">Hourly</option>
              </Select>
            </Field>
            <Field
              label={form.type === "hourly" ? "Hourly rate" : "Monthly salary"}
              htmlFor="structure-amount"
              required
              error={errors.amount}
            >
              <Input
                id="structure-amount"
                inputMode="numeric"
                value={form.amount}
                disabled={!canManage}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </Field>
          </div>
          {errors.items ? (
            <div className="alert alert--danger" role="alert">
              {errors.items}
            </div>
          ) : null}
          {itemEditor("allowances", "Allowances", "Added to base pay on every run.", "Add")}
          {itemEditor("deductions", "Deductions", "Taken off before net pay, such as BPJS or loans.", "Add")}
        </form>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Remove this salary structure?"
        description={
          <>
            <b>{structure?.name || structure?.email}</b> will not be included in future runs. Draft and approved runs keep
            their payslips.
          </>
        }
        confirmLabel="Remove structure"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
