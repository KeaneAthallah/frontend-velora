import { apiDownload, apiRequest, USE_MOCK_API } from "./client";
import { mockId } from "./mock-db";

/**
 * Payroll: per-person salary structures and monthly runs.
 *
 * Amounts are whole-currency integers, matching the finance module — payroll
 * tables store `unsignedBigInteger`. A run is a month; its payslips are a
 * snapshot of the structures at generation time, so editing a structure or a
 * payslip never rewrites an approved run.
 */

export type PayrollType = "fixed" | "hourly";

/** Label => amount allowances and deductions, e.g. `{ Transport: 500000 }`. */
export type PayrollItems = Record<string, number>;

export type PayrollStructure = {
  id: string;
  userId: string;
  name: string;
  email: string;
  type: PayrollType;
  baseSalary: number;
  hourlyRate: number;
  allowances: PayrollItems;
  deductions: PayrollItems;
};

export type PayrollStructureInput = {
  userId: string;
  type: PayrollType;
  baseSalary?: number;
  hourlyRate?: number;
  allowances?: PayrollItems;
  deductions?: PayrollItems;
};

export type PayrollRunStatus = "draft" | "approved" | "paid";

export type Payslip = {
  id: string;
  runId: string;
  userId: string;
  name: string;
  email: string;
  /** Fixed salary, or rate × hours for an hourly structure. */
  baseAmount: number;
  allowancesTotal: number;
  deductionsTotal: number;
  overtimeAmount: number;
  bonusAmount: number;
  commissionAmount: number;
  netAmount: number;
  hoursWorked: number;
  daysWorked: number;
  allowances: PayrollItems;
  deductions: PayrollItems;
};

export type PayrollJournalEntry = {
  id: string;
  number: string;
  status: "draft" | "posted" | "reversed";
};

export type PayrollRun = {
  id: string;
  period: string;
  status: PayrollRunStatus;
  approverName: string | null;
  approvedAt: string | null;
  payslipCount: number;
  netTotal: number;
  payslips: Payslip[];
  /** The ledger entry the run posted, once finance has posted it. */
  journalEntry: PayrollJournalEntry | null;
};

export type PayrollExportFormat = "csv" | "pdf";

export type PayslipAdjustment = {
  bonusAmount?: number;
  overtimeAmount?: number;
  commissionAmount?: number;
};

function whole(value: unknown) {
  return Math.round(Number(value ?? 0));
}

function items(value: unknown): PayrollItems {
  if (!value || typeof value !== "object") return {};
  const result: PayrollItems = {};
  for (const [label, amount] of Object.entries(value as Record<string, unknown>)) {
    result[label] = whole(amount);
  }
  return result;
}

function net(slip: {
  baseAmount: number;
  allowancesTotal: number;
  overtimeAmount: number;
  bonusAmount: number;
  commissionAmount: number;
  deductionsTotal: number;
}) {
  return Math.max(
    0,
    slip.baseAmount +
      slip.allowancesTotal +
      slip.overtimeAmount +
      slip.bonusAmount +
      slip.commissionAmount -
      slip.deductionsTotal
  );
}

/* -------------------------------------------------------------------------- */
/* Structures                                                                 */
/* -------------------------------------------------------------------------- */

function mapStructure(row: any): PayrollStructure {
  return {
    id: String(row.id ?? ""),
    userId: row.user_id != null ? String(row.user_id) : "",
    name: row.user?.name ?? "",
    email: row.user?.email ?? "",
    type: (row.type ?? "fixed") as PayrollType,
    baseSalary: whole(row.base_salary),
    hourlyRate: whole(row.hourly_rate),
    allowances: items(row.allowances),
    deductions: items(row.deductions),
  };
}

export async function listPayrollStructures(): Promise<PayrollStructure[]> {
  if (USE_MOCK_API) return mockStructures.map((structure) => ({ ...structure }));

  const data = await apiRequest<any[]>("/payroll/structures");
  return (data ?? []).map(mapStructure);
}

function structureBody(input: PayrollStructureInput) {
  return {
    user_id: Number(input.userId),
    type: input.type,
    base_salary: Math.round(input.baseSalary ?? 0),
    hourly_rate: Math.round(input.hourlyRate ?? 0),
    allowances: input.allowances ?? {},
    deductions: input.deductions ?? {},
  };
}

export async function createPayrollStructure(input: PayrollStructureInput): Promise<PayrollStructure> {
  if (USE_MOCK_API) {
    if (mockStructures.some((structure) => structure.userId === input.userId)) {
      throw new Error("This person already has a payroll structure. Edit it instead.");
    }
    const created: PayrollStructure = {
      id: mockId("pstruct"),
      userId: input.userId,
      name: mockEmployeeNames[input.userId] ?? "Team member",
      email: "",
      type: input.type,
      baseSalary: input.type === "fixed" ? Math.round(input.baseSalary ?? 0) : 0,
      hourlyRate: input.type === "hourly" ? Math.round(input.hourlyRate ?? 0) : 0,
      allowances: { ...(input.allowances ?? {}) },
      deductions: { ...(input.deductions ?? {}) },
    };
    mockStructures = [...mockStructures, created];
    return { ...created };
  }

  const data = await apiRequest<any>("/payroll/structures", {
    method: "POST",
    body: structureBody(input),
  });
  return mapStructure(data);
}

export async function updatePayrollStructure(
  id: string,
  input: Omit<PayrollStructureInput, "userId">
): Promise<PayrollStructure> {
  if (USE_MOCK_API) {
    const index = mockStructures.findIndex((structure) => structure.id === id);
    if (index === -1) throw new Error("Payroll structure not found.");
    mockStructures[index] = {
      ...mockStructures[index],
      type: input.type,
      baseSalary: input.type === "fixed" ? Math.round(input.baseSalary ?? 0) : 0,
      hourlyRate: input.type === "hourly" ? Math.round(input.hourlyRate ?? 0) : 0,
      allowances: { ...(input.allowances ?? {}) },
      deductions: { ...(input.deductions ?? {}) },
    };
    return { ...mockStructures[index] };
  }

  const data = await apiRequest<any>(`/payroll/structures/${id}`, {
    method: "PUT",
    body: {
      type: input.type,
      base_salary: Math.round(input.baseSalary ?? 0),
      hourly_rate: Math.round(input.hourlyRate ?? 0),
      allowances: input.allowances ?? {},
      deductions: input.deductions ?? {},
    },
  });
  return mapStructure(data);
}

export async function deletePayrollStructure(id: string): Promise<void> {
  if (USE_MOCK_API) {
    mockStructures = mockStructures.filter((structure) => structure.id !== id);
    return;
  }
  await apiRequest<null>(`/payroll/structures/${id}`, { method: "DELETE" });
}

/* -------------------------------------------------------------------------- */
/* Runs and payslips                                                          */
/* -------------------------------------------------------------------------- */

function mapPayslip(row: any): Payslip {
  const details = row.details ?? {};
  return {
    id: String(row.id ?? ""),
    runId: row.payroll_run_id != null ? String(row.payroll_run_id) : "",
    userId: row.user_id != null ? String(row.user_id) : "",
    name: row.user?.name ?? "",
    email: row.user?.email ?? "",
    baseAmount: whole(row.base_amount),
    allowancesTotal: whole(row.allowances_total),
    deductionsTotal: whole(row.deductions_total),
    overtimeAmount: whole(row.overtime_amount),
    bonusAmount: whole(row.bonus_amount),
    commissionAmount: whole(row.commission_amount),
    netAmount: whole(row.net_amount),
    hoursWorked: Number(details.hours_worked ?? 0),
    daysWorked: Number(details.days_worked ?? 0),
    allowances: items(details.allowances),
    deductions: items(details.deductions),
  };
}

function mapRun(row: any): PayrollRun {
  const payslips: Payslip[] = Array.isArray(row.payslips) ? row.payslips.map(mapPayslip) : [];
  return {
    id: String(row.id ?? ""),
    period: row.period ?? "",
    status: (row.status ?? "draft") as PayrollRunStatus,
    approverName: row.approver?.name ?? null,
    approvedAt: row.approved_at ?? null,
    journalEntry: row.journal_entry
      ? {
          id: String(row.journal_entry.id ?? ""),
          number: row.journal_entry.number ?? "",
          status: (row.journal_entry.status ?? "posted") as PayrollJournalEntry["status"],
        }
      : null,
    payslipCount: row.payslips_count != null ? Number(row.payslips_count) : payslips.length,
    netTotal:
      row.payslips_sum_net_amount != null
        ? whole(row.payslips_sum_net_amount)
        : payslips.reduce((sum, slip) => sum + slip.netAmount, 0),
    payslips,
  };
}

export async function listPayrollRuns(status?: PayrollRunStatus): Promise<PayrollRun[]> {
  if (USE_MOCK_API) {
    return mockRuns
      .filter((run) => !status || run.status === status)
      .map((run) => ({ ...run, payslips: run.payslips.map((slip) => ({ ...slip })) }));
  }

  const data = await apiRequest<any[]>(`/payroll/runs${status ? `?status=${status}` : ""}`);
  return (data ?? []).map(mapRun);
}

export async function getPayrollRun(id: string): Promise<PayrollRun> {
  if (USE_MOCK_API) {
    const run = mockRuns.find((entry) => entry.id === id);
    if (!run) throw new Error("Payroll run not found.");
    return { ...run, payslips: run.payslips.map((slip) => ({ ...slip })) };
  }

  const data = await apiRequest<any>(`/payroll/runs/${id}`);
  return mapRun(data);
}

/** Create (or regenerate) the draft for a `YYYY-MM` period. */
export async function generatePayrollRun(period: string): Promise<PayrollRun> {
  if (USE_MOCK_API) {
    const existing = mockRuns.find((run) => run.period === period);
    if (existing && existing.status !== "draft") {
      throw new Error(`The ${period} run is already ${existing.status}.`);
    }
    const payslips: Payslip[] = mockStructures.map((structure) => {
      const hoursWorked = structure.type === "hourly" ? 160 : 0;
      const baseAmount =
        structure.type === "hourly" ? Math.round(structure.hourlyRate * hoursWorked) : structure.baseSalary;
      const allowancesTotal = Object.values(structure.allowances).reduce((sum, amount) => sum + amount, 0);
      const deductionsTotal = Object.values(structure.deductions).reduce((sum, amount) => sum + amount, 0);
      const previous = existing?.payslips.find((slip) => slip.userId === structure.userId);
      const slip: Payslip = {
        id: previous?.id ?? mockId("slip"),
        runId: existing?.id ?? mockId("prun"),
        userId: structure.userId,
        name: structure.name,
        email: structure.email,
        baseAmount,
        allowancesTotal,
        deductionsTotal,
        overtimeAmount: previous?.overtimeAmount ?? 0,
        bonusAmount: previous?.bonusAmount ?? 0,
        commissionAmount: previous?.commissionAmount ?? 0,
        netAmount: 0,
        hoursWorked,
        daysWorked: structure.type === "hourly" ? 20 : 0,
        allowances: { ...structure.allowances },
        deductions: { ...structure.deductions },
      };
      slip.netAmount = net(slip);
      return slip;
    });

    const run: PayrollRun = {
      id: existing?.id ?? mockId("prun"),
      period,
      status: "draft",
      approverName: null,
      approvedAt: null,
      payslipCount: payslips.length,
      netTotal: payslips.reduce((sum, slip) => sum + slip.netAmount, 0),
      payslips,
      journalEntry: existing?.journalEntry ?? null,
    };
    for (const slip of payslips) slip.runId = run.id;

    mockRuns = existing ? mockRuns.map((entry) => (entry.id === run.id ? run : entry)) : [run, ...mockRuns];
    return { ...run, payslips: payslips.map((slip) => ({ ...slip })) };
  }

  const data = await apiRequest<any>("/payroll/runs", { method: "POST", body: { period } });
  return mapRun(data);
}

export async function approvePayrollRun(id: string): Promise<PayrollRun> {
  if (USE_MOCK_API) {
    const run = mockRuns.find((entry) => entry.id === id);
    if (!run) throw new Error("Payroll run not found.");
    if (run.status !== "draft") throw new Error(`Only a draft run can be approved; this one is ${run.status}.`);
    if (!run.payslips.length) throw new Error("This run has no payslips. Generate it first.");
    run.status = "approved";
    run.approverName = null;
    run.approvedAt = new Date().toISOString();
    return { ...run, payslips: run.payslips.map((slip) => ({ ...slip })) };
  }

  const data = await apiRequest<any>(`/payroll/runs/${id}/approve`, { method: "POST" });
  return mapRun(data);
}

export async function payPayrollRun(id: string): Promise<PayrollRun> {
  if (USE_MOCK_API) {
    const run = mockRuns.find((entry) => entry.id === id);
    if (!run) throw new Error("Payroll run not found.");
    if (run.status !== "approved") throw new Error("Approve the run before marking it paid.");
    run.status = "paid";
    return { ...run, payslips: run.payslips.map((slip) => ({ ...slip })) };
  }

  const data = await apiRequest<any>(`/payroll/runs/${id}/pay`, { method: "POST" });
  return mapRun(data);
}

export async function deletePayrollRun(id: string): Promise<void> {
  if (USE_MOCK_API) {
    const run = mockRuns.find((entry) => entry.id === id);
    if (!run) return;
    if (run.status !== "draft") throw new Error("Only a draft run can be deleted.");
    mockRuns = mockRuns.filter((entry) => entry.id !== id);
    return;
  }
  await apiRequest<null>(`/payroll/runs/${id}`, { method: "DELETE" });
}

/** Adjust one payslip while its run is still a draft. */
export async function updatePayslip(
  runId: string,
  payslipId: string,
  input: PayslipAdjustment
): Promise<Payslip> {
  if (USE_MOCK_API) {
    const run = mockRuns.find((entry) => entry.id === runId);
    const slip = run?.payslips.find((entry) => entry.id === payslipId);
    if (!run || !slip) throw new Error("Payslip not found.");
    if (run.status !== "draft") throw new Error("Payslips are locked once the run is approved.");
    slip.bonusAmount = Math.round(input.bonusAmount ?? slip.bonusAmount);
    slip.overtimeAmount = Math.round(input.overtimeAmount ?? slip.overtimeAmount);
    slip.commissionAmount = Math.round(input.commissionAmount ?? slip.commissionAmount);
    slip.netAmount = net(slip);
    run.netTotal = run.payslips.reduce((sum, entry) => sum + entry.netAmount, 0);
    return { ...slip };
  }

  const data = await apiRequest<any>(`/payroll/runs/${runId}/payslips/${payslipId}`, {
    method: "PUT",
    body: {
      bonus_amount: Math.round(input.bonusAmount ?? 0),
      overtime_amount: Math.round(input.overtimeAmount ?? 0),
      commission_amount: Math.round(input.commissionAmount ?? 0),
    },
  });
  return mapPayslip(data);
}

/**
 * Post the run's net wages to the general ledger: one balanced entry, wages
 * debited to the expense account and credited to the account the money leaves.
 */
export async function postPayrollJournal(
  id: string,
  input: { expenseAccountId: string; paymentAccountId: string }
): Promise<PayrollRun> {
  if (USE_MOCK_API) {
    const run = mockRuns.find((entry) => entry.id === id);
    if (!run) throw new Error("Payroll run not found.");
    if (run.status === "draft") throw new Error("Approve the run before posting it to the ledger.");
    if (run.journalEntry) throw new Error("This run is already posted to the ledger.");
    if (input.expenseAccountId === input.paymentAccountId) {
      throw new Error("Choose two different accounts: one for the expense, one for the money leaving.");
    }
    run.journalEntry = { id: mockId("je"), number: `PAY-${run.period}`, status: "posted" };
    return { ...run, payslips: run.payslips.map((slip) => ({ ...slip })) };
  }

  const data = await apiRequest<any>(`/payroll/runs/${id}/post-journal`, {
    method: "POST",
    body: {
      expense_account_id: Number(input.expenseAccountId),
      payment_account_id: Number(input.paymentAccountId),
    },
  });
  return mapRun(data);
}

/** Payslip sheet for the run: CSV for spreadsheets, PDF to print or send. */
export async function exportPayrollRun(
  id: string,
  format: PayrollExportFormat = "csv"
): Promise<{ blob: Blob; filename: string }> {
  if (USE_MOCK_API) {
    const run = mockRuns.find((entry) => entry.id === id);
    if (!run) throw new Error("Payroll run not found.");
    if (format === "pdf") throw new Error("PDF export needs the API — demo mode only produces CSV.");

    const header = ["Employee", "Type", "Hours", "Base", "Allowances", "Overtime", "Bonus", "Commission", "Deductions", "Net"];
    const rows = run.payslips.map((slip) => [
      slip.name || slip.email,
      slip.hoursWorked ? "Hourly" : "Fixed",
      slip.hoursWorked,
      slip.baseAmount,
      slip.allowancesTotal,
      slip.overtimeAmount,
      slip.bonusAmount,
      slip.commissionAmount,
      slip.deductionsTotal,
      slip.netAmount,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    return { blob: new Blob([csv], { type: "text/csv" }), filename: `payslips-${run.period}.csv` };
  }

  return apiDownload(`/payroll/runs/${id}/export?format=${format}`);
}

/* -------------------------------------------------------------------------- */
/* Mock fixtures                                                              */
/* -------------------------------------------------------------------------- */

const mockEmployeeNames: Record<string, string> = {
  "u-1": "Keane Athallah",
  "u-2": "Siti Rahayu",
  "u-3": "Budi Santoso",
};

let mockStructures: PayrollStructure[] = [
  {
    id: "pstruct-1",
    userId: "u-1",
    name: "Keane Athallah",
    email: "keane@velora.test",
    type: "fixed",
    baseSalary: 8_500_000,
    hourlyRate: 0,
    allowances: { Transport: 600_000 },
    deductions: { BPJS: 425_000 },
  },
  {
    id: "pstruct-2",
    userId: "u-2",
    name: "Siti Rahayu",
    email: "siti@velora.test",
    type: "hourly",
    baseSalary: 0,
    hourlyRate: 45_000,
    allowances: {},
    deductions: {},
  },
];

let mockRuns: PayrollRun[] = [
  {
    id: "prun-1",
    period: "2026-10",
    status: "approved",
    approverName: "Keane Athallah",
    approvedAt: "2026-11-03T02:00:00Z",
    payslipCount: 2,
    netTotal: 15_675_000,
    journalEntry: { id: "je-1", number: "PAY-2026-10", status: "posted" },
    payslips: [
      {
        id: "slip-1",
        runId: "prun-1",
        userId: "u-1",
        name: "Keane Athallah",
        email: "keane@velora.test",
        baseAmount: 8_500_000,
        allowancesTotal: 600_000,
        deductionsTotal: 425_000,
        overtimeAmount: 0,
        bonusAmount: 0,
        commissionAmount: 0,
        netAmount: 8_675_000,
        hoursWorked: 0,
        daysWorked: 0,
        allowances: { Transport: 600_000 },
        deductions: { BPJS: 425_000 },
      },
      {
        id: "slip-2",
        runId: "prun-1",
        userId: "u-2",
        name: "Siti Rahayu",
        email: "siti@velora.test",
        baseAmount: 7_200_000,
        allowancesTotal: 0,
        deductionsTotal: 0,
        overtimeAmount: 0,
        bonusAmount: 0,
        commissionAmount: 200_000,
        netAmount: 7_400_000,
        hoursWorked: 160,
        daysWorked: 20,
        allowances: {},
        deductions: {},
      },
    ],
  },
];
