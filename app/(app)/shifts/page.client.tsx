"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Lock, Plus, Unlock, Wallet } from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Button, EmptyState, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/table";
import { AccessDenied, InlineError, SectionSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  closeShift,
  createCashRegister,
  listCashRegisters,
  listCashMovements,
  listShifts,
  openShift,
  recordCashMovement,
} from "@/lib/api/shifts";
import type { CashMovement, CashMovementType, CashRegister, RegisterShift } from "@/lib/api/types";
import { formatCurrency, formatDateTime } from "@/lib/formatting/currency";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";

export const instant = false;

type OpenShiftTarget = { register: CashRegister } | null;

export default function ShiftsPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outlets, outletId } = useBusiness();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const currency = session?.business.currency ?? "IDR";
  const canManage = has("shifts.manage");
  const canManageRegisters = has("settings.manage");

  const registersQuery = useQuery({ queryKey: ["cash-registers"], queryFn: listCashRegisters });
  const shiftsQuery = useQuery({ queryKey: ["shifts"], queryFn: listShifts });
  const cashMovementsCache = new Map<string, CashMovement[]>();

  const registers = registersQuery.data ?? [];
  const shifts = shiftsQuery.data ?? [];
  const openShifts = shifts.filter((shift) => shift.status === "open");
  const closedShifts = shifts.filter((shift) => shift.status === "closed");
  const openByRegister = new Map(openShifts.map((shift) => [shift.registerId, shift]));

  const [openDialog, setOpenDialog] = React.useState<OpenShiftTarget>(null);
  const [closeTarget, setCloseTarget] = React.useState<RegisterShift | null>(null);
  const [movementTarget, setMovementTarget] = React.useState<{ shift: RegisterShift; type: CashMovementType } | null>(null);
  const [registerDialog, setRegisterDialog] = React.useState(false);

  const [openRegisterId, setOpenRegisterId] = React.useState("");
  const [openingCash, setOpeningCash] = React.useState("");
  const [actualCash, setActualCash] = React.useState("");
  const [closeNotes, setCloseNotes] = React.useState("");
  const [movementAmount, setMovementAmount] = React.useState("");
  const [movementReason, setMovementReason] = React.useState("");
  const [registerName, setRegisterName] = React.useState("");
  const [registerCode, setRegisterCode] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const invalidateShifts = () => queryClient.invalidateQueries({ queryKey: ["shifts"] });

  const openMutation = useMutation({
    mutationFn: () => openShift({ registerId: openRegisterId, openingCash: Number(openingCash || 0) }),
    onSuccess: (shift) => {
      invalidateShifts();
      setOpenDialog(null);
      setOpeningCash("");
      push({ title: "Shift opened", description: `${shift.registerName ?? "Register"} is ready to take sales.`, variant: "success" });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeShift(closeTarget!.id, { actualCash: Number(actualCash || 0), notes: closeNotes || undefined }),
    onSuccess: (shift) => {
      invalidateShifts();
      setCloseTarget(null);
      setActualCash("");
      setCloseNotes("");
      const variance = shift.difference ?? 0;
      push({
        title: "Shift closed",
        description:
          variance === 0
            ? "Drawer balanced exactly."
            : `Drawer is ${variance > 0 ? "over" : "short"} by ${formatCurrency(Math.abs(variance), currency)}.`,
        variant: variance === 0 ? "success" : "warning",
      });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const movementMutation = useMutation({
    mutationFn: () =>
      recordCashMovement(movementTarget!.shift.id, {
        type: movementTarget!.type,
        amount: Number(movementAmount || 0),
        reason: movementReason || undefined,
      }),
    onSuccess: () => {
      invalidateShifts();
      setMovementTarget(null);
      setMovementAmount("");
      setMovementReason("");
      push({ title: "Cash movement recorded", variant: "success" });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const registerMutation = useMutation({
    mutationFn: () => createCashRegister({ name: registerName, code: registerCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      setRegisterDialog(false);
      setRegisterName("");
      setRegisterCode("");
      push({ title: "Register created", variant: "success" });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const resetForm = () => {
    setFormError(null);
    openMutation.reset();
    closeMutation.reset();
    movementMutation.reset();
    registerMutation.reset();
  };

  if (!has("shifts.view")) {
    return (
      <div className="page">
        <PageHeader title="Cash registers" description="Open and close tills, and reconcile the drawer." />
        <AccessDenied permission="shifts.view" />
      </div>
    );
  }

  const drawerCash = openShifts.reduce((total, shift) => total + (shift.expectedCash ?? shift.openingCash), 0);
  const lastClosed = closedShifts[0];

  const historyColumns: Column<RegisterShift>[] = [
    {
      id: "register",
      header: "Register",
      cell: (shift) => (
        <div className="stack-sm" style={{ gap: 2 }}>
          <b>{shift.registerName ?? "—"}</b>
          <span className="hint">{shift.cashierName ?? "—"}</span>
        </div>
      ),
    },
    { id: "opened", header: "Opened", cell: (shift) => formatDateTime(shift.openedAt) },
    { id: "closed", header: "Closed", cell: (shift) => (shift.closedAt ? formatDateTime(shift.closedAt) : "—") },
    { id: "opening", header: "Opening", align: "right", cell: (shift) => formatCurrency(shift.openingCash, currency) },
    {
      id: "expected",
      header: "Expected",
      align: "right",
      cell: (shift) => (shift.expectedCash == null ? "—" : formatCurrency(shift.expectedCash, currency)),
    },
    {
      id: "actual",
      header: "Counted",
      align: "right",
      cell: (shift) => (shift.actualCash == null ? "—" : formatCurrency(shift.actualCash, currency)),
    },
    {
      id: "difference",
      header: "Variance",
      align: "right",
      cell: (shift) => <Variance value={shift.difference} currency={currency} />,
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Cash registers"
        description="Open a till at the start of a shift, record cash in and out, then count the drawer at close."
        actions={
          canManageRegisters ? (
            <Button
              variant="secondary"
              onClick={() => {
                resetForm();
                setRegisterDialog(true);
              }}
            >
              <Plus aria-hidden="true" /> New register
            </Button>
          ) : undefined
        }
      />

      <div className="grid-3">
        <Stat label="Registers" value={String(registers.length)} foot={`${registers.filter((r) => r.status === "active").length} active`} />
        <Stat label="Open shifts" value={String(openShifts.length)} foot="Drawers in use" />
        <Stat label="Cash in drawers" value={formatCurrency(drawerCash, currency)} foot="Opening float plus movements" />
      </div>

      {openShifts.length > 0 && (
        <Card>
          <CardHeader title="Open shifts" description="Reconcile or hand over cash without closing the till." />
          <CardBody className="stack">
            {openShifts.map((shift) => (
              <div key={shift.id} className="row row-between" style={{ gap: 12, flexWrap: "wrap" }}>
                <div className="stack-sm" style={{ gap: 2 }}>
                  <b>{shift.registerName ?? "Register"}</b>
                  <span className="hint">
                    {shift.cashierName ?? "Cashier"} · opened {formatDateTime(shift.openedAt)} ·{" "}
                    {formatCurrency(shift.expectedCash ?? shift.openingCash, currency)} expected
                  </span>
                </div>
                {canManage && (
                  <div className="row row-tight">
                    <Button variant="quiet" size="sm" onClick={() => { resetForm(); setMovementTarget({ shift, type: "in" }); }}>
                      <ArrowDownLeft aria-hidden="true" /> Cash in
                    </Button>
                    <Button variant="quiet" size="sm" onClick={() => { resetForm(); setMovementTarget({ shift, type: "out" }); }}>
                      <ArrowUpRight aria-hidden="true" /> Cash out
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        resetForm();
                        setCloseTarget(shift);
                        setActualCash((shift.expectedCash ?? shift.openingCash).toString());
                      }}
                    >
                      <Lock aria-hidden="true" /> Close shift
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Registers" description="Each till belongs to one outlet." />
        <CardBody flush>
          {registersQuery.isLoading ? (
            <div style={{ padding: 16 }}>
              <SectionSkeleton rows={3} />
            </div>
          ) : registersQuery.isError ? (
            <div style={{ padding: 16 }}>
              <InlineError title="Could not load registers" error={registersQuery.error} onRetry={() => registersQuery.refetch()} />
            </div>
          ) : registers.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState
                icon={<Wallet aria-hidden="true" />}
                title="No registers yet"
                description="Create a register to start opening shifts and tracking cash."
                actions={
                  canManageRegisters ? (
                    <Button
                      onClick={() => {
                        resetForm();
                        setRegisterDialog(true);
                      }}
                    >
                      <Plus aria-hidden="true" /> New register
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Register</th>
                    <th>Code</th>
                    <th>Outlet</th>
                    <th>Status</th>
                    <th>Shift</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {registers.map((register) => {
                    const active = openByRegister.get(register.id);
                    const outlet = outlets.find((item) => item.id === register.outletId);
                    return (
                      <tr key={register.id}>
                        <td>
                          <b>{register.name}</b>
                        </td>
                        <td className="mono">{register.code}</td>
                        <td>{outlet?.name ?? "—"}</td>
                        <td>
                          <Badge tone={register.status === "active" ? "success" : "neutral"}>{register.status}</Badge>
                        </td>
                        <td>
                          {active ? <Badge tone="info">Open · {formatCurrency(active.expectedCash ?? active.openingCash, currency)}</Badge> : <span className="hint">Closed</span>}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {active ? (
                            canManage ? (
                              <Button
                                variant="quiet"
                                size="sm"
                                onClick={() => {
                                  resetForm();
                                  setCloseTarget(active);
                                  setActualCash((active.expectedCash ?? active.openingCash).toString());
                                }}
                              >
                                Close
                              </Button>
                            ) : null
                          ) : canManage ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={register.status !== "active"}
                              onClick={() => {
                                resetForm();
                                setOpenDialog({ register });
                                setOpenRegisterId(register.id);
                                setOpeningCash("");
                              }}
                            >
                              <Unlock aria-hidden="true" /> Open shift
                            </Button>
                          ) : (
                            <span className="hint">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Shift history"
          description={lastClosed ? `Last closed ${formatDateTime(lastClosed.closedAt ?? lastClosed.openedAt)}` : "Closed shifts appear here."}
        />
        <CardBody flush>
          {shiftsQuery.isLoading ? (
            <div style={{ padding: 16 }}>
              <SectionSkeleton rows={4} />
            </div>
          ) : shiftsQuery.isError ? (
            <div style={{ padding: 16 }}>
              <InlineError title="Could not load shifts" error={shiftsQuery.error} onRetry={() => shiftsQuery.refetch()} />
            </div>
          ) : (
            <DataTable
              rows={closedShifts}
              columns={historyColumns}
              rowId={(shift) => shift.id}
              minWidth={760}
              empty={<EmptyState title="No shifts recorded yet" description="Close a shift to see its reconciliation here." compact />}
            />
          )}
        </CardBody>
      </Card>

      {/* ── Open shift ── */}
      <Dialog
        open={Boolean(openDialog)}
        onClose={() => setOpenDialog(null)}
        title="Open shift"
        description={openDialog?.register.name}
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpenDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={openMutation.isPending}
              disabled={!openRegisterId}
              onClick={() => openMutation.mutate()}
            >
              Open shift
            </Button>
          </>
        }
      >
        <div className="stack">
          {formError && <div className="alert alert--danger">{formError}</div>}
          <Field label="Opening cash" htmlFor="opening-cash" hint={`Counted float in ${currency}.`} required>
            <Input
              id="opening-cash"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={openingCash}
              onChange={(event) => setOpeningCash(event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <p className="hint">Sales and cash movements attach to this shift until you close it.</p>
        </div>
      </Dialog>

      {/* ── Close shift ── */}
      <Dialog
        open={Boolean(closeTarget)}
        onClose={() => setCloseTarget(null)}
        title="Close shift"
        description={closeTarget ? `${closeTarget.registerName ?? "Register"} · opened ${formatDateTime(closeTarget.openedAt)}` : undefined}
        footer={
          <>
            <Button variant="quiet" onClick={() => setCloseTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={closeMutation.isPending} onClick={() => closeMutation.mutate()}>
              Close &amp; reconcile
            </Button>
          </>
        }
      >
        <div className="stack">
          {formError && <div className="alert alert--danger">{formError}</div>}
          <div className="row row-between">
            <span className="hint">Expected in drawer</span>
            <b>{formatCurrency(closeTarget?.expectedCash ?? closeTarget?.openingCash ?? 0, currency)}</b>
          </div>
          <Field label="Counted cash" htmlFor="actual-cash" hint="Enter the notes and coins you physically counted." required>
            <Input
              id="actual-cash"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={actualCash}
              onChange={(event) => setActualCash(event.target.value)}
            />
          </Field>
          <Variance
            value={actualCash === "" ? null : Number(actualCash) - (closeTarget?.expectedCash ?? closeTarget?.openingCash ?? 0)}
            currency={currency}
          />
          <Field label="Notes" htmlFor="close-notes">
            <Textarea
              id="close-notes"
              rows={3}
              value={closeNotes}
              onChange={(event) => setCloseNotes(event.target.value)}
              placeholder="Anything worth remembering about this drawer?"
            />
          </Field>
        </div>
      </Dialog>

      {/* ── Cash movement ── */}
      <Dialog
        open={Boolean(movementTarget)}
        onClose={() => setMovementTarget(null)}
        title={movementTarget?.type === "out" ? "Cash out" : "Cash in"}
        description={movementTarget?.shift.registerName}
        width={420}
        footer={
          <>
            <Button variant="quiet" onClick={() => setMovementTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={movementMutation.isPending} onClick={() => movementMutation.mutate()}>
              Record
            </Button>
          </>
        }
      >
        <div className="stack">
          {formError && <div className="alert alert--danger">{formError}</div>}
          <Field label="Amount" htmlFor="movement-amount" required>
            <Input
              id="movement-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={movementAmount}
              onChange={(event) => setMovementAmount(event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Reason" htmlFor="movement-reason" hint="Change float, supplier payment, cash pickup…">
            <Input
              id="movement-reason"
              value={movementReason}
              onChange={(event) => setMovementReason(event.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>
      </Dialog>

      {/* ── New register ── */}
      <Dialog
        open={registerDialog}
        onClose={() => setRegisterDialog(false)}
        title="New register"
        description={outlets.find((outlet) => outlet.id === outletId)?.name ?? "Active outlet"}
        footer={
          <>
            <Button variant="quiet" onClick={() => setRegisterDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={registerMutation.isPending}
              disabled={!registerName.trim() || !registerCode.trim()}
              onClick={() => registerMutation.mutate()}
            >
              Create register
            </Button>
          </>
        }
      >
        <div className="stack">
          {formError && <div className="alert alert--danger">{formError}</div>}
          <Field label="Name" htmlFor="register-name" required>
            <Input
              id="register-name"
              value={registerName}
              onChange={(event) => setRegisterName(event.target.value)}
              placeholder="Front counter"
            />
          </Field>
          <Field label="Code" htmlFor="register-code" hint="Short identifier used on receipts and reports." required>
            <Input
              id="register-code"
              value={registerCode}
              onChange={(event) => setRegisterCode(event.target.value)}
              placeholder="FRONT"
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

function Variance({ value, currency }: { value: number | null; currency: string }) {
  if (value == null) return <span className="hint">—</span>;
  if (Math.abs(value) < 0.00005) return <Badge tone="success">Balanced</Badge>;
  const over = value > 0;
  return (
    <Badge tone={over ? "warning" : "danger"}>
      {over ? "Over " : "Short "}
      {formatCurrency(Math.abs(value), currency)}
    </Badge>
  );
}
