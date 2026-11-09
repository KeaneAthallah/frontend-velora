"use client";

export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CalendarPlus, HandCoins } from "lucide-react";
import { format } from "date-fns";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, Button, EmptyState, Field, Input } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { generatePayrollRun, listPayrollRuns, listPayrollStructures, type PayrollRun } from "@/lib/api/payroll";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatCurrency, formatNumber } from "@/lib/formatting/currency";

function formatPeriod(period: string) {
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return format(date, "MMMM yyyy");
}

const STATUS_TONE = { draft: "warning", approved: "info", paid: "success" } as const;

export default function PayrollPage() {
  const { has } = usePermissions();
  const canRead = has("payroll.view");
  const canManage = has("payroll.manage");
  const [generatorOpen, setGeneratorOpen] = React.useState(false);

  const runs = useQuery({
    queryKey: ["payroll", "runs"],
    queryFn: () => listPayrollRuns(),
    enabled: canRead,
    staleTime: 30_000,
  });
  const structures = useQuery({
    queryKey: ["payroll", "structures"],
    queryFn: () => listPayrollStructures(),
    enabled: canRead,
    staleTime: 30_000,
  });

  if (!canRead) {
    return <AccessDenied permission="payroll.view" />;
  }

  const rows = runs.data ?? [];
  const latest = rows[0];
  const drafts = rows.filter((run) => run.status === "draft");
  const paidTotal = rows.filter((run) => run.status === "paid").reduce((sum, run) => sum + run.netTotal, 0);
  const onPayroll = structures.data?.length ?? 0;

  const columns: Column<PayrollRun>[] = [
    {
      id: "period",
      header: "Month",
      sortable: true,
      sortValue: (run) => run.period,
      cell: (run) => (
        <div>
          <div style={{ fontWeight: 600 }}>{formatPeriod(run.period)}</div>
          <div className="hint">{run.payslipCount === 1 ? "1 payslip" : `${run.payslipCount} payslips`}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (run) => run.status,
      cell: (run) => <Badge tone={STATUS_TONE[run.status]}>{run.status}</Badge>,
    },
    {
      id: "approvedBy",
      header: "Approved by",
      cell: (run) => <span className="cell-muted">{run.approverName ?? "—"}</span>,
    },
    {
      id: "net",
      header: "Net pay",
      align: "right",
      sortable: true,
      sortValue: (run) => run.netTotal,
      cell: (run) => <span className="num">{formatCurrency(run.netTotal)}</span>,
    },
    {
      id: "open",
      header: "",
      align: "right",
      cell: (run) => (
        <Link href={`/payroll/runs/${run.id}`} className="btn btn--quiet btn--sm">
          Open
        </Link>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Payroll"
        title="Payroll"
        description="Generate a month from the salary structures, check each payslip, then approve and pay."
        actions={
          <>
            <Link href="/payroll/structures" className="btn btn--secondary btn--sm">
              <HandCoins aria-hidden="true" />
              Salary structures
            </Link>
            {canManage ? (
              <Button variant="primary" onClick={() => setGeneratorOpen(true)}>
                <CalendarPlus aria-hidden="true" />
                Generate payroll
              </Button>
            ) : null}
          </>
        }
      />

      <div className="stat-grid">
        <Stat
          label="Latest run"
          value={latest ? formatCurrency(latest.netTotal) : "—"}
          foot={latest ? `${formatPeriod(latest.period)} · ${latest.status}` : "No payroll yet"}
          emphasis={latest?.status === "draft"}
        />
        <Stat
          label="Draft runs"
          value={formatNumber(drafts.length)}
          foot={drafts.length ? "Waiting for approval" : "Nothing waiting"}
          emphasis={drafts.length > 0}
        />
        <Stat label="Paid out" value={formatCurrency(paidTotal)} foot="Across paid runs" />
        <Stat label="On payroll" value={formatNumber(onPayroll)} foot="People with a salary structure" />
      </div>

      {drafts.length ? (
        <Card>
          <div className="row" style={{ justifyContent: "space-between", gap: 16, padding: "16px 18px" }}>
            <div>
              <strong>
                {drafts.length === 1 ? "1 draft run is ready" : `${drafts.length} draft runs are ready`}
              </strong>
              <p className="hint" style={{ margin: "2px 0 0" }}>
                Open a draft to adjust bonuses and overtime, then approve it.
              </p>
            </div>
            <Link href={`/payroll/runs/${drafts[0].id}`} className="btn btn--secondary btn--sm">
              Review {formatPeriod(drafts[0].period)}
            </Link>
          </div>
        </Card>
      ) : null}

      <Card>
        {runs.isError ? (
          <InlineError title="Payroll runs could not be loaded" error={runs.error} onRetry={() => runs.refetch()} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowId={(run) => run.id}
            loading={runs.isLoading}
            minWidth={680}
            empty={
              <EmptyState
                icon={<Banknote aria-hidden="true" />}
                title="No payroll runs yet"
                description={
                  onPayroll
                    ? "Generate the first month and every person with a structure gets a payslip."
                    : "Add a salary structure for each team member, then generate the first month."
                }
                actions={
                  canManage ? (
                    onPayroll ? (
                      <Button variant="primary" onClick={() => setGeneratorOpen(true)}>
                        Generate payroll
                      </Button>
                    ) : (
                      <Link href="/payroll/structures" className="btn btn--primary">
                        Set up salary structures
                      </Link>
                    )
                  ) : (
                    <span className="hint">Ask a manager to set up payroll.</span>
                  )
                }
              />
            }
            mobile={(run) => (
              <Link href={`/payroll/runs/${run.id}`} className="record" style={{ display: "block" }}>
                <div className="record__head">
                  <strong>{formatPeriod(run.period)}</strong>
                  <span className="num">{formatCurrency(run.netTotal)}</span>
                </div>
                <div className="record__meta">
                  <Badge tone={STATUS_TONE[run.status]}>{run.status}</Badge>
                  <span>{run.payslipCount === 1 ? "1 payslip" : `${run.payslipCount} payslips`}</span>
                </div>
              </Link>
            )}
          />
        )}
      </Card>

      <GenerateSheet open={generatorOpen} onClose={() => setGeneratorOpen(false)} runs={rows} />
    </div>
  );
}

function GenerateSheet({
  open,
  onClose,
  runs,
}: {
  open: boolean;
  onClose: () => void;
  runs: PayrollRun[];
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { push } = useToast();
  const [period, setPeriod] = React.useState(() => new Date().toISOString().slice(0, 7));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const draftForPeriod = runs.find((run) => run.period === period && run.status === "draft");

  const mutation = useMutation({
    mutationFn: () => generatePayrollRun(period),
    onSuccess: (run) => {
      push({
        title: `${formatPeriod(run.period)} drafted`,
        description: `${run.payslipCount === 1 ? "1 payslip" : `${run.payslipCount} payslips`} totalling ${formatCurrency(run.netTotal)}.`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      onClose();
      router.push(`/payroll/runs/${run.id}`);
    },
    onError: (error) => setError(error instanceof Error ? error.message : "Payroll could not be generated."),
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Generate payroll"
      description="Hours come from closed attendance records for the month."
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending} style={{ marginLeft: "auto" }}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="payroll-generate"
            variant="primary"
            loading={mutation.isPending}
            disabled={!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)}
          >
            {draftForPeriod ? "Regenerate draft" : "Generate"}
          </Button>
        </>
      }
    >
      <form
        id="payroll-generate"
        className="stack"
        style={{ gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
            setError("Choose a month.");
            return;
          }
          mutation.mutate();
        }}
      >
        {error ? (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        ) : null}
        <Field label="Month" htmlFor="payroll-period" required hint="Each month can only have one run.">
          <Input
            id="payroll-period"
            type="month"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            autoFocus
          />
        </Field>
        {draftForPeriod ? (
          <p className="hint" style={{ margin: 0 }}>
            {formatPeriod(period)} already has a draft. Regenerating replaces its payslips but keeps manual bonuses and
            overtime.
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}
