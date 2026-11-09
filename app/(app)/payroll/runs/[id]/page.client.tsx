"use client";

export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Banknote, BookOpen, Download, Trash2, Wallet } from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, Button, Field, Input, Select } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  approvePayrollRun,
  deletePayrollRun,
  exportPayrollRun,
  getPayrollRun,
  payPayrollRun,
  postPayrollJournal,
  updatePayslip,
  type PayrollExportFormat,
  type Payslip,
} from "@/lib/api/payroll";
import { listAccounts } from "@/lib/api/finance";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatCurrency, formatNumber } from "@/lib/formatting/currency";
import { format } from "date-fns";

function formatPeriod(period: string) {
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return format(date, "MMMM yyyy");
}

const STATUS_TONE = { draft: "warning", approved: "info", paid: "success" } as const;

const grossOf = (slip: Payslip) =>
  slip.baseAmount + slip.allowancesTotal + slip.overtimeAmount + slip.bonusAmount + slip.commissionAmount;

const extraOf = (slip: Payslip) => slip.overtimeAmount + slip.bonusAmount + slip.commissionAmount;

type Action = "approve" | "pay" | "delete";

export default function PayrollRunPage({ runId }: { runId: string }) {
  const { has } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [editing, setEditing] = React.useState<Payslip | null>(null);
  const [action, setAction] = React.useState<Action | null>(null);
  const [posting, setPosting] = React.useState(false);

  const canRead = has("payroll.view");
  const canManage = has("payroll.manage");

  const query = useQuery({
    queryKey: ["payroll", "run", runId],
    queryFn: () => getPayrollRun(runId),
    enabled: canRead,
  });

  const run = query.data;
  const isDraft = run?.status === "draft";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["payroll"] });

  const actionMutation = useMutation({
    mutationFn: async (kind: Action) => {
      if (kind === "approve") await approvePayrollRun(runId);
      else if (kind === "pay") await payPayrollRun(runId);
      else await deletePayrollRun(runId);
    },
    onSuccess: (_data, kind) => {
      invalidate();
      setAction(null);
      if (kind === "approve") {
        push({ title: "Payroll approved", description: "Payslips are locked. Mark the run paid once the money leaves.", variant: "success" });
      } else if (kind === "pay") {
        push({ title: "Payroll marked paid", description: "The run is closed.", variant: "success" });
      } else {
        push({ title: "Draft deleted", description: "The month can be generated again.", variant: "success" });
        router.push("/payroll");
      }
    },
    onError: (error) => {
      push({
        title: "That did not go through",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "error",
      });
      setAction(null);
    },
  });

  const exportMutation = useMutation({
    mutationFn: (kind: PayrollExportFormat) => exportPayrollRun(runId, kind),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      push({ title: "Payslips exported", description: filename, variant: "success" });
    },
    onError: (error) => {
      push({
        title: "The payslip sheet could not be exported",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "error",
      });
    },
  });

  if (!canRead) {
    return <AccessDenied permission="payroll.view" />;
  }

  if (query.isError) {
    return (
      <div className="page">
        <PageHeader eyebrow="Payroll" title="Payroll run" />
        <Card>
          <div style={{ padding: 18 }}>
            <InlineError title="This payroll run could not be loaded" error={query.error} onRetry={() => query.refetch()} />
            <Link href="/payroll" className="btn btn--quiet btn--sm" style={{ marginTop: 12 }}>
              Back to payroll
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const payslips = run?.payslips ?? [];
  const gross = payslips.reduce((sum, slip) => sum + grossOf(slip), 0);
  const deductions = payslips.reduce((sum, slip) => sum + slip.deductionsTotal, 0);
  const netTotal = payslips.reduce((sum, slip) => sum + slip.netAmount, 0);

  const columns: Column<Payslip>[] = [
    {
      id: "person",
      header: "Person",
      sortable: true,
      sortValue: (slip) => slip.name,
      cell: (slip) => (
        <div>
          <div style={{ fontWeight: 600 }}>{slip.name || slip.email}</div>
          <div className="hint">
            {slip.hoursWorked
              ? `${formatNumber(slip.hoursWorked)} h over ${slip.daysWorked} ${slip.daysWorked === 1 ? "day" : "days"}`
              : slip.email}
          </div>
        </div>
      ),
    },
    {
      id: "base",
      header: "Base",
      align: "right",
      sortable: true,
      sortValue: (slip) => slip.baseAmount,
      cell: (slip) => <span className="num">{formatCurrency(slip.baseAmount)}</span>,
    },
    {
      id: "allowances",
      header: "Allowances",
      align: "right",
      cell: (slip) => (
        <span className="num" title={Object.keys(slip.allowances).join(", ") || undefined}>
          {slip.allowancesTotal ? formatCurrency(slip.allowancesTotal) : "—"}
        </span>
      ),
    },
    {
      id: "extra",
      header: "Overtime & bonus",
      align: "right",
      cell: (slip) => (
        <span
          className="num"
          title={
            [
              slip.overtimeAmount ? `Overtime ${formatCurrency(slip.overtimeAmount)}` : null,
              slip.bonusAmount ? `Bonus ${formatCurrency(slip.bonusAmount)}` : null,
              slip.commissionAmount ? `Commission ${formatCurrency(slip.commissionAmount)}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
        >
          {extraOf(slip) ? formatCurrency(extraOf(slip)) : "—"}
        </span>
      ),
    },
    {
      id: "deductions",
      header: "Deductions",
      align: "right",
      cell: (slip) => (
        <span className="num cell-muted" title={Object.keys(slip.deductions).join(", ") || undefined}>
          {slip.deductionsTotal ? `− ${formatCurrency(slip.deductionsTotal)}` : "—"}
        </span>
      ),
    },
    {
      id: "net",
      header: "Net pay",
      align: "right",
      sortable: true,
      sortValue: (slip) => slip.netAmount,
      cell: (slip) => <strong className="num">{formatCurrency(slip.netAmount)}</strong>,
    },
    ...(canManage && isDraft
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            cell: (slip: Payslip) => (
              <Button
                variant="quiet"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setEditing(slip);
                }}
              >
                Adjust
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
        title={run ? `${formatPeriod(run.period)} payroll` : "Payroll run"}
        description={
          run
            ? run.status === "draft"
              ? "Adjust overtime and bonuses, then approve to lock the payslips."
              : run.status === "approved"
                ? `Approved${run.approverName ? ` by ${run.approverName}` : ""}. Mark it paid once the transfers are done.`
                : "Paid and closed. Payslips can no longer change."
            : undefined
        }
        actions={
          <>
            <Link href="/payroll" className="btn btn--quiet btn--sm">
              <ArrowLeft aria-hidden="true" />
              Payroll
            </Link>
            {run ? <Badge tone={STATUS_TONE[run.status]}>{run.status}</Badge> : null}
            {canManage && run?.status === "draft" ? (
              <Button variant="primary" onClick={() => setAction("approve")}>
                <BadgeCheck aria-hidden="true" />
                Approve
              </Button>
            ) : null}
            {canManage && run?.status === "approved" ? (
              <Button variant="primary" onClick={() => setAction("pay")}>
                <Wallet aria-hidden="true" />
                Mark paid
              </Button>
            ) : null}
            {canManage && run?.status === "draft" ? (
              <Button variant="danger-quiet" onClick={() => setAction("delete")}>
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      <div className="stat-grid">
        <Stat label="Gross" value={formatCurrency(gross)} foot={`${payslips.length} payslips`} />
        <Stat label="Deductions" value={formatCurrency(deductions)} foot="Before net pay" />
        <Stat label="Net pay" value={formatCurrency(netTotal)} foot="What leaves the account" emphasis />
        <Stat
          label="Bonus & overtime"
          value={formatCurrency(payslips.reduce((sum, slip) => sum + extraOf(slip), 0))}
          foot={isDraft ? "Editable while draft" : "Locked"}
        />
      </div>

      <Card>
        <div className="row" style={{ justifyContent: "space-between", gap: 16, padding: 16, flexWrap: "wrap" }}>
          <div className="stack-sm" style={{ gap: 2 }}>
            <strong>Ledger & payslip sheet</strong>
            <span className="hint" style={{ margin: 0 }}>
              {run?.journalEntry ? (
                <>
                  Posted as <b className="num">{run.journalEntry.number}</b> ({run.journalEntry.status}).
                </>
              ) : run?.status === "draft" ? (
                "Approve the run, then post net wages to the books."
              ) : (
                "Net wages are not in the books yet."
              )}
            </span>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="quiet"
              size="sm"
              disabled={!payslips.length}
              loading={exportMutation.isPending && exportMutation.variables === "csv"}
              onClick={() => exportMutation.mutate("csv")}
            >
              <Download aria-hidden="true" />
              CSV
            </Button>
            <Button
              variant="quiet"
              size="sm"
              disabled={!payslips.length}
              loading={exportMutation.isPending && exportMutation.variables === "pdf"}
              onClick={() => exportMutation.mutate("pdf")}
            >
              <Download aria-hidden="true" />
              PDF
            </Button>
            {run?.journalEntry ? (
              <Link href="/finance/journal" className="btn btn--secondary btn--sm">
                Open journal
              </Link>
            ) : canManage && (run?.status === "approved" || run?.status === "paid") ? (
              <Button variant="secondary" size="sm" onClick={() => setPosting(true)}>
                <BookOpen aria-hidden="true" />
                Post to ledger
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <DataTable
          rows={payslips}
          columns={columns}
          rowId={(slip) => slip.id}
          loading={query.isLoading}
          minWidth={860}
          onRowClick={canManage && isDraft ? (slip) => setEditing(slip) : undefined}
          footer={
            payslips.length ? (
              <div className="row" style={{ justifyContent: "flex-end", gap: 24, padding: "12px 16px" }}>
                <span className="hint" style={{ margin: 0 }}>
                  Totals
                </span>
                <strong className="num">{formatCurrency(gross)}</strong>
                <span className="num cell-muted">− {formatCurrency(deductions)}</span>
                <strong className="num">{formatCurrency(netTotal)}</strong>
              </div>
            ) : undefined
          }
          empty={
            <div className="stack" style={{ alignItems: "center", gap: 8, padding: 24 }}>
              <Banknote aria-hidden="true" />
              <strong>No payslips on this run</strong>
              <p className="hint" style={{ margin: 0 }}>
                Add salary structures, then generate the month again.
              </p>
              <Link href="/payroll/structures" className="btn btn--secondary btn--sm">
                Salary structures
              </Link>
            </div>
          }
          mobile={(slip) => (
            <div className="record">
              <div className="record__head">
                <strong>{slip.name || slip.email}</strong>
                <span className="num">{formatCurrency(slip.netAmount)}</span>
              </div>
              <div className="record__meta">
                <span>Base {formatCurrency(slip.baseAmount)}</span>
                <span>{slip.deductionsTotal ? `Deductions ${formatCurrency(slip.deductionsTotal)}` : "No deductions"}</span>
              </div>
              {canManage && isDraft ? (
                <Button variant="quiet" size="sm" onClick={() => setEditing(slip)} style={{ marginTop: 6 }}>
                  Adjust
                </Button>
              ) : null}
            </div>
          )}
        />
      </Card>

      <PayslipEditor runId={runId} runStatus={run?.status ?? "draft"} payslip={editing} onClose={() => setEditing(null)} />

      <LedgerPoster
        runId={runId}
        open={posting}
        netTotal={netTotal}
        onClose={() => setPosting(false)}
      />

      <ConfirmDialog
        open={action !== null}
        onClose={() => setAction(null)}
        onConfirm={() => action && actionMutation.mutate(action)}
        title={
          action === "approve"
            ? "Approve this payroll?"
            : action === "pay"
              ? "Mark this payroll paid?"
              : "Delete this draft?"
        }
        description={
          action === "approve" ? (
            <>
              <b>{run ? formatPeriod(run.period) : "This month"}</b> locks at {formatCurrency(netTotal)} net. Payslips can
              no longer be edited afterwards.
            </>
          ) : action === "pay" ? (
            <>
              Confirms {formatCurrency(netTotal)} has been paid out. The run closes for good.
            </>
          ) : (
            <>The draft and its {payslips.length} payslips are deleted. The month can be generated again.</>
          )
        }
        confirmLabel={action === "approve" ? "Approve run" : action === "pay" ? "Mark paid" : "Delete draft"}
        loading={actionMutation.isPending}
      />
    </div>
  );
}

/**
 * Post the run to the general ledger. Payroll knows the total but not which
 * accounts the business keeps its wage cost and cash in, so the two accounts
 * are picked here, defaulted to the first expense and first asset account.
 */
function LedgerPoster({
  runId,
  open,
  netTotal,
  onClose,
}: {
  runId: string;
  open: boolean;
  netTotal: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [expense, setExpense] = React.useState("");
  const [payment, setPayment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const wasOpen = React.useRef(false);

  const accounts = useQuery({
    queryKey: ["finance", "accounts"],
    queryFn: () => listAccounts(),
    enabled: open,
    staleTime: 60_000,
  });

  const all = React.useMemo(() => accounts.data ?? [], [accounts.data]);
  const expenseOptions = React.useMemo(() => all.filter((account) => account.type === "expense" || account.type === "cogs"), [all]);
  const paymentOptions = React.useMemo(() => all.filter((account) => account.type === "asset" || account.type === "liability"), [all]);

  // Clear on open, then fill the defaults as the account list arrives. A choice
  // already made is never overwritten by a refetch.
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setExpense("");
      setPayment("");
      setError(null);
    }
    wasOpen.current = open;
    if (!open) return;
    setExpense((current) => current || expenseOptions[0]?.id || "");
    setPayment((current) => current || paymentOptions[0]?.id || "");
  }, [open, expenseOptions, paymentOptions]);

  const mutation = useMutation({
    mutationFn: () => postPayrollJournal(runId, { expenseAccountId: expense, paymentAccountId: payment }),
    onSuccess: (saved) => {
      push({
        title: "Posted to the ledger",
        description: `${saved.journalEntry?.number ?? "The entry"} records ${formatCurrency(netTotal)} of wages.`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      onClose();
    },
    onError: (mutationError) =>
      setError(mutationError instanceof Error ? mutationError.message : "The entry could not be posted."),
  });

  const missingAccounts = !accounts.isLoading && (expenseOptions.length === 0 || paymentOptions.length === 0);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Post payroll to the ledger"
      description="One balanced entry: the wage expense is debited, the account the money leaves is credited."
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending} style={{ marginLeft: "auto" }}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="ledger-poster"
            variant="primary"
            loading={mutation.isPending}
            disabled={!expense || !payment || expense === payment || missingAccounts}
          >
            Post {formatCurrency(netTotal)}
          </Button>
        </>
      }
    >
      <form
        id="ledger-poster"
        className="stack"
        style={{ gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (expense === payment) {
            setError("Choose two different accounts: one for the expense, one for the money leaving.");
            return;
          }
          setError(null);
          mutation.mutate();
        }}
      >
        {error ? (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        ) : null}

        {missingAccounts ? (
          <div className="alert alert--info">
            Posting needs a wage-expense account and a cash, bank or payable account.{" "}
            <Link href="/finance/accounts">Add them in the chart of accounts</Link> first.
          </div>
        ) : null}

        <Field label="Wage expense account" htmlFor="ledger-expense" required hint="Debited for the full net total.">
          <Select id="ledger-expense" value={expense} onChange={(event) => setExpense(event.target.value)}>
            <option value="">Choose account…</option>
            {expenseOptions.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} · {account.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Paid from" htmlFor="ledger-payment" required hint="Credited: cash, bank, or wages payable.">
          <Select id="ledger-payment" value={payment} onChange={(event) => setPayment(event.target.value)}>
            <option value="">Choose account…</option>
            {paymentOptions.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} · {account.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid hsl(var(--border))", paddingTop: 12 }}>
          <span>Debit / credit</span>
          <strong className="num">{formatCurrency(netTotal)}</strong>
        </div>
        <span className="hint" style={{ margin: 0 }}>
          Dated to the last day of the period, so the cost lands in the month it was earned. Reverse it from the journal if
          the wrong account was picked.
        </span>
      </form>
    </Sheet>
  );
}

function PayslipEditor({
  runId,
  runStatus,
  payslip,
  onClose,
}: {
  runId: string;
  runStatus: string;
  payslip: Payslip | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [form, setForm] = React.useState({ bonus: "0", overtime: "0", commission: "0" });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!payslip) return;
    setError(null);
    setForm({
      bonus: String(payslip.bonusAmount),
      overtime: String(payslip.overtimeAmount),
      commission: String(payslip.commissionAmount),
    });
  }, [payslip]);

  const mutation = useMutation({
    mutationFn: () =>
      updatePayslip(runId, payslip!.id, {
        bonusAmount: Math.round(Number(form.bonus || 0)),
        overtimeAmount: Math.round(Number(form.overtime || 0)),
        commissionAmount: Math.round(Number(form.commission || 0)),
      }),
    onSuccess: (saved) => {
      push({
        title: "Payslip updated",
        description: `${saved.name || saved.email} now nets ${formatCurrency(saved.netAmount)}.`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      onClose();
    },
    onError: (error) => setError(error instanceof Error ? error.message : "The payslip could not be saved."),
  });

  const values = {
    bonus: Number(form.bonus || 0),
    overtime: Number(form.overtime || 0),
    commission: Number(form.commission || 0),
  };
  const preview = payslip
    ? Math.max(
        0,
        payslip.baseAmount +
          payslip.allowancesTotal +
          values.overtime +
          values.bonus +
          values.commission -
          payslip.deductionsTotal
      )
    : 0;

  const locked = !payslip || runStatus !== "draft";

  return (
    <Sheet
      open={payslip !== null}
      onClose={onClose}
      title={payslip ? `Adjust ${payslip.name || "payslip"}` : "Adjust payslip"}
      description="Add overtime, a bonus or commission. Base pay and deductions come from the salary structure."
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending} style={{ marginLeft: "auto" }}>
            Cancel
          </Button>
          <Button type="submit" form="payslip-editor" variant="primary" loading={mutation.isPending} disabled={locked}>
            Save payslip
          </Button>
        </>
      }
    >
      {payslip ? (
        <form
          id="payslip-editor"
          className="stack"
          style={{ gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            const invalid = Object.values(form).some((value) => {
              const parsed = Number(value || 0);
              return !Number.isFinite(parsed) || parsed < 0;
            });
            if (invalid) {
              setError("Amounts must be zero or more.");
              return;
            }
            setError(null);
            mutation.mutate();
          }}
        >
          {error ? (
            <div className="alert alert--danger" role="alert">
              {error}
            </div>
          ) : null}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Base</span>
            <strong className="num">{formatCurrency(payslip.baseAmount)}</strong>
          </div>
          {payslip.allowancesTotal ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>
                Allowances <span className="hint">{Object.keys(payslip.allowances).join(", ")}</span>
              </span>
              <strong className="num">{formatCurrency(payslip.allowancesTotal)}</strong>
            </div>
          ) : null}
          {payslip.deductionsTotal ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>
                Deductions <span className="hint">{Object.keys(payslip.deductions).join(", ")}</span>
              </span>
              <strong className="num">− {formatCurrency(payslip.deductionsTotal)}</strong>
            </div>
          ) : null}
          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="Overtime" htmlFor="slip-overtime">
              <Input
                id="slip-overtime"
                value={form.overtime}
                inputMode="numeric"
                onChange={(event) => setForm((current) => ({ ...current, overtime: event.target.value }))}
              />
            </Field>
            <Field label="Bonus" htmlFor="slip-bonus">
              <Input
                id="slip-bonus"
                value={form.bonus}
                inputMode="numeric"
                onChange={(event) => setForm((current) => ({ ...current, bonus: event.target.value }))}
              />
            </Field>
          </div>
          <Field label="Commission" htmlFor="slip-commission" hint="Sales commission for the month, if any.">
            <Input
              id="slip-commission"
              value={form.commission}
              inputMode="numeric"
              onChange={(event) => setForm((current) => ({ ...current, commission: event.target.value }))}
            />
          </Field>
          <div
            className="row"
            style={{ justifyContent: "space-between", borderTop: "1px solid hsl(var(--border))", paddingTop: 12 }}
          >
            <span>Net pay</span>
            <strong className="num">{formatCurrency(preview)}</strong>
          </div>
        </form>
      ) : null}
    </Sheet>
  );
}
