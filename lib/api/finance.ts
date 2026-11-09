import { apiRequest, USE_MOCK_API } from "./client";
import { mockId } from "./mock-db";

/**
 * Finance module: chart of accounts, journal entries, receivables and payables.
 *
 * Amounts here are whole-currency integers, unlike the 4 dp decimal strings used
 * by sales and payments — the finance tables store `unsignedBigInteger`.
 */

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense" | "cogs";

export type Account = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  openingBalance: number;
  isActive: boolean;
  description: string | null;
};

export type AccountInput = {
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  openingBalance?: number;
  isActive?: boolean;
  description?: string;
};

export type JournalLine = {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string | null;
};

export type JournalStatus = "draft" | "posted" | "reversed";

export type JournalEntry = {
  id: string;
  number: string;
  entryDate: string;
  description: string;
  status: JournalStatus;
  referenceType: string | null;
  totalDebit: number;
  totalCredit: number;
  lines: JournalLine[];
};

export type JournalLineInput = {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
};

export type JournalInput = {
  entryDate: string;
  outletId?: string;
  description?: string;
  status?: "draft" | "posted";
  lines: JournalLineInput[];
};

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
};

export type TrialBalance = {
  accounts: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
};

export type AgingBuckets = {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
};

export type InvoicePayment = {
  id: string;
  amount: number;
  paymentDate: string;
  method: string | null;
  reference: string | null;
};

export type InvoiceStatus = "open" | "partial" | "paid" | "overdue" | "voided";

export type Invoice = {
  id: string;
  number: string;
  partyId: string | null;
  partyName: string;
  issueDate: string;
  dueDate: string | null;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
  notes: string | null;
  payments: InvoicePayment[];
};

export type InvoiceInput = {
  partyId?: string;
  number: string;
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  tax?: number;
  total: number;
  notes?: string;
};

export type InvoicePaymentInput = {
  amount: number;
  paymentDate: string;
  method?: string;
  reference?: string;
};

function num(value: unknown) {
  return Number(value ?? 0);
}

function whole(value: unknown) {
  return Math.round(num(value));
}

/* -------------------------------------------------------------------------- */
/* Chart of accounts                                                          */
/* -------------------------------------------------------------------------- */

function mapAccount(row: any): Account {
  return {
    id: String(row.id ?? ""),
    code: row.code ?? "",
    name: row.name ?? "",
    type: (row.type ?? "expense") as AccountType,
    parentId: row.parent_id != null ? String(row.parent_id) : null,
    openingBalance: whole(row.opening_balance),
    isActive: row.is_active == null ? true : Boolean(row.is_active),
    description: row.description ?? null,
  };
}

export async function listAccounts(): Promise<Account[]> {
  if (USE_MOCK_API) return mockAccounts.map((account) => ({ ...account }));

  const data = await apiRequest<any[]>("/accounts");
  return (data ?? []).map(mapAccount);
}

export async function createAccount(input: AccountInput): Promise<Account> {
  if (USE_MOCK_API) {
    if (mockAccounts.some((account) => account.code === input.code)) {
      throw new Error("That account code is already in use.");
    }
    const account: Account = {
      id: mockId("acc"),
      code: input.code,
      name: input.name,
      type: input.type,
      parentId: input.parentId ?? null,
      openingBalance: input.openingBalance ?? 0,
      isActive: input.isActive ?? true,
      description: input.description ?? null,
    };
    mockAccounts = [...mockAccounts, account];
    return { ...account };
  }

  const data = await apiRequest<any>("/accounts", {
    method: "POST",
    body: {
      code: input.code,
      name: input.name,
      type: input.type,
      parent_id: input.parentId ? Number(input.parentId) : undefined,
      opening_balance: input.openingBalance ?? 0,
      is_active: input.isActive ?? true,
      description: input.description,
    },
  });
  return mapAccount(data);
}

export async function updateAccount(id: string, input: Partial<AccountInput>): Promise<Account> {
  if (USE_MOCK_API) {
    const index = mockAccounts.findIndex((account) => account.id === id);
    if (index === -1) throw new Error("Account not found.");
    mockAccounts[index] = {
      ...mockAccounts[index],
      ...input,
      parentId: input.parentId ?? mockAccounts[index].parentId,
      openingBalance: input.openingBalance ?? mockAccounts[index].openingBalance,
      description: input.description ?? mockAccounts[index].description,
    };
    return { ...mockAccounts[index] };
  }

  const data = await apiRequest<any>(`/accounts/${id}`, {
    method: "PUT",
    body: {
      code: input.code,
      name: input.name,
      type: input.type,
      parent_id: input.parentId ? Number(input.parentId) : undefined,
      opening_balance: input.openingBalance,
      is_active: input.isActive,
      description: input.description,
    },
  });
  return mapAccount(data);
}

export async function deleteAccount(id: string): Promise<void> {
  if (USE_MOCK_API) {
    mockAccounts = mockAccounts.filter((account) => account.id !== id);
    return;
  }
  await apiRequest<null>(`/accounts/${id}`, { method: "DELETE" });
}

/* -------------------------------------------------------------------------- */
/* Journal entries                                                            */
/* -------------------------------------------------------------------------- */

function mapJournalLine(row: any): JournalLine {
  return {
    id: String(row.id ?? ""),
    accountId: row.account_id != null ? String(row.account_id) : "",
    accountCode: row.account?.code ?? "",
    accountName: row.account?.name ?? "",
    debit: whole(row.debit),
    credit: whole(row.credit),
    description: row.description ?? null,
  };
}

function mapJournalEntry(row: any): JournalEntry {
  const lines = Array.isArray(row.lines) ? row.lines.map(mapJournalLine) : [];
  return {
    id: String(row.id ?? ""),
    number: row.number ?? `#${row.id ?? ""}`,
    entryDate: row.entry_date ?? "",
    description: row.description ?? "",
    status: (row.status ?? "draft") as JournalStatus,
    referenceType: row.reference_type ?? null,
    totalDebit: lines.reduce((sum: number, line: JournalLine) => sum + line.debit, 0),
    totalCredit: lines.reduce((sum: number, line: JournalLine) => sum + line.credit, 0),
    lines,
  };
}

export async function listJournalEntries(status?: JournalStatus): Promise<JournalEntry[]> {
  if (USE_MOCK_API) {
    return mockJournal
      .filter((entry) => !status || entry.status === status)
      .map((entry) => ({ ...entry, lines: entry.lines.map((line) => ({ ...line })) }));
  }

  const data = await apiRequest<any[]>(`/journal-entries${status ? `?status=${status}` : ""}`);
  return (data ?? []).map(mapJournalEntry);
}

export async function createJournalEntry(input: JournalInput): Promise<JournalEntry> {
  const totalDebit = input.lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
  const totalCredit = input.lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);
  if (totalDebit !== totalCredit) {
    throw new Error("Debits and credits must balance before the entry can be saved.");
  }
  if (totalDebit === 0) {
    throw new Error("Add at least one amount to the entry.");
  }

  if (USE_MOCK_API) {
    const accountsById = new Map(mockAccounts.map((account) => [account.id, account]));
    const entry: JournalEntry = {
      id: mockId("je"),
      number: `JE-${String(mockJournal.length + 1).padStart(4, "0")}`,
      entryDate: input.entryDate,
      description: input.description ?? "",
      status: input.status ?? "draft",
      referenceType: null,
      totalDebit,
      totalCredit,
      lines: input.lines.map((line) => {
        const account = accountsById.get(line.accountId);
        return {
          id: mockId("jel"),
          accountId: line.accountId,
          accountCode: account?.code ?? "",
          accountName: account?.name ?? "Unknown account",
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
          description: line.description ?? null,
        };
      }),
    };
    mockJournal = [entry, ...mockJournal];
    return { ...entry };
  }

  const data = await apiRequest<any>("/journal-entries", {
    method: "POST",
    body: {
      entry_date: input.entryDate,
      outlet_id: input.outletId ? Number(input.outletId) : undefined,
      description: input.description,
      status: input.status,
      lines: input.lines.map((line) => ({
        account_id: Number(line.accountId),
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
        description: line.description,
      })),
    },
  });
  return mapJournalEntry(data);
}

export async function postJournalEntry(id: string): Promise<JournalEntry> {
  if (USE_MOCK_API) {
    const entry = mockJournal.find((row) => row.id === id);
    if (!entry) throw new Error("Journal entry not found.");
    if (entry.status !== "draft") throw new Error("Only draft entries can be posted.");
    entry.status = "posted";
    return { ...entry };
  }

  const data = await apiRequest<any>(`/journal-entries/${id}/post`, { method: "POST" });
  return mapJournalEntry(data);
}

export async function reverseJournalEntry(id: string): Promise<JournalEntry> {
  if (USE_MOCK_API) {
    const entry = mockJournal.find((row) => row.id === id);
    if (!entry) throw new Error("Journal entry not found.");
    if (entry.status !== "posted") throw new Error("Only posted entries can be reversed.");
    entry.status = "reversed";
    const reversal: JournalEntry = {
      id: mockId("je"),
      number: `JE-${String(mockJournal.length + 1).padStart(4, "0")}`,
      entryDate: new Date().toISOString().slice(0, 10),
      description: `Reversal of ${entry.number}`,
      status: "posted",
      referenceType: "reversal",
      totalDebit: entry.totalCredit,
      totalCredit: entry.totalDebit,
      lines: entry.lines.map((line) => ({
        ...line,
        id: mockId("jel"),
        debit: line.credit,
        credit: line.debit,
      })),
    };
    mockJournal = [reversal, ...mockJournal];
    return { ...reversal };
  }

  const data = await apiRequest<any>(`/journal-entries/${id}/reverse`, { method: "POST" });
  return mapJournalEntry(data);
}

export async function getTrialBalance(): Promise<TrialBalance> {
  if (USE_MOCK_API) {
    const rows: TrialBalanceRow[] = mockAccounts.map((account) => {
      const lines = mockJournal
        .filter((entry) => entry.status === "posted")
        .flatMap((entry) => entry.lines)
        .filter((line) => line.accountId === account.id);
      const debitNature = account.type === "asset" || account.type === "expense" || account.type === "cogs";
      const debit = lines.reduce((sum, line) => sum + line.debit, 0) + (debitNature ? account.openingBalance : 0);
      const credit = lines.reduce((sum, line) => sum + line.credit, 0) + (debitNature ? 0 : account.openingBalance);
      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
      };
    });
    return {
      accounts: rows,
      totalDebit: rows.reduce((sum, row) => sum + row.debit, 0),
      totalCredit: rows.reduce((sum, row) => sum + row.credit, 0),
    };
  }

  const data = await apiRequest<any>("/trial-balance");
  return {
    accounts: (data?.accounts ?? []).map((row: any) => ({
      accountId: String(row.account_id ?? ""),
      code: row.code ?? "",
      name: row.name ?? "",
      type: (row.type ?? "expense") as AccountType,
      debit: whole(row.debit),
      credit: whole(row.credit),
    })),
    totalDebit: whole(data?.total_debit),
    totalCredit: whole(data?.total_credit),
  };
}

/* -------------------------------------------------------------------------- */
/* Receivables / payables                                                     */
/* -------------------------------------------------------------------------- */

function mapInvoice(row: any, party: "customer" | "supplier"): Invoice {
  const related = row[party];
  return {
    id: String(row.id ?? ""),
    number: row.number ?? "",
    partyId: row[`${party}_id`] != null ? String(row[`${party}_id`]) : null,
    partyName: related?.name ?? "",
    issueDate: row.issue_date ?? "",
    dueDate: row.due_date ?? null,
    subtotal: whole(row.subtotal),
    tax: whole(row.tax),
    total: whole(row.total),
    amountPaid: whole(row.amount_paid),
    status: (row.status ?? "open") as InvoiceStatus,
    notes: row.notes ?? null,
    payments: (row.payments ?? []).map((payment: any) => ({
      id: String(payment.id ?? ""),
      amount: whole(payment.amount),
      paymentDate: payment.payment_date ?? "",
      method: payment.method ?? null,
      reference: payment.reference ?? null,
    })),
  };
}

function mapAging(data: any): AgingBuckets {
  const buckets = data?.buckets ?? {};
  return {
    current: whole(buckets.current),
    days1to30: whole(buckets["1_30"]),
    days31to60: whole(buckets["31_60"]),
    days61to90: whole(buckets["61_90"]),
    over90: whole(buckets.over_90),
    total: whole(data?.total),
  };
}

type InvoiceKind = "ar" | "ap";

function invoicePath(kind: InvoiceKind) {
  return kind === "ar" ? "ar-invoices" : "ap-invoices";
}

export async function listInvoices(kind: InvoiceKind, status?: InvoiceStatus): Promise<Invoice[]> {
  const party = kind === "ar" ? "customer" : "supplier";
  if (USE_MOCK_API) {
    const source = kind === "ar" ? mockAr : mockAp;
    return source.filter((invoice) => !status || invoice.status === status).map((invoice) => ({ ...invoice }));
  }

  const data = await apiRequest<any[]>(`/${invoicePath(kind)}${status ? `?status=${status}` : ""}`);
  return (data ?? []).map((row) => mapInvoice(row, party));
}

export async function createInvoice(kind: InvoiceKind, input: InvoiceInput): Promise<Invoice> {
  const party = kind === "ar" ? "customer" : "supplier";
  const partyKey = kind === "ar" ? "customerId" : "supplierId";

  if (USE_MOCK_API) {
    const source = kind === "ar" ? mockAr : mockAp;
    if (source.some((invoice) => invoice.number === input.number)) {
      throw new Error("That invoice number already exists.");
    }
    const created: Invoice = {
      id: mockId(`${kind}-inv`),
      number: input.number,
      partyId: input.partyId ?? null,
      partyName: mockParties[kind].find((entry) => entry.id === input.partyId)?.name ?? "",
      issueDate: input.issueDate,
      dueDate: input.dueDate ?? null,
      subtotal: input.subtotal,
      tax: input.tax ?? 0,
      total: input.total,
      amountPaid: 0,
      status: "open",
      notes: input.notes ?? null,
      payments: [],
    };
    if (kind === "ar") mockAr = [created, ...mockAr];
    else mockAp = [created, ...mockAp];
    return { ...created };
  }

  const data = await apiRequest<any>(`/${invoicePath(kind)}`, {
    method: "POST",
    body: {
      [partyKey]: input.partyId ? Number(input.partyId) : undefined,
      number: input.number,
      issue_date: input.issueDate,
      due_date: input.dueDate,
      subtotal: Math.round(input.subtotal),
      tax: Math.round(input.tax ?? 0),
      total: Math.round(input.total),
      notes: input.notes,
    },
  });
  return mapInvoice(data, party);
}

export async function payInvoice(
  kind: InvoiceKind,
  id: string,
  input: InvoicePaymentInput
): Promise<Invoice> {
  const party = kind === "ar" ? "customer" : "supplier";

  if (USE_MOCK_API) {
    const source = kind === "ar" ? mockAr : mockAp;
    const invoice = source.find((row) => row.id === id);
    if (!invoice) throw new Error("Invoice not found.");
    invoice.amountPaid += input.amount;
    invoice.status = invoice.amountPaid >= invoice.total ? "paid" : "partial";
    invoice.payments = [
      ...invoice.payments,
      {
        id: mockId("pay"),
        amount: input.amount,
        paymentDate: input.paymentDate,
        method: input.method ?? null,
        reference: input.reference ?? null,
      },
    ];
    return { ...invoice };
  }

  const data = await apiRequest<any>(`/${invoicePath(kind)}/${id}/pay`, {
    method: "POST",
    body: {
      amount: Math.round(input.amount),
      payment_date: input.paymentDate,
      method: input.method,
      reference: input.reference,
    },
  });
  // The pay endpoint returns the invoice with its payments but no party relation.
  return mapInvoice({ ...data, [`${party}_id`]: data?.[`${party}_id`] }, party);
}

export async function getAging(kind: InvoiceKind): Promise<AgingBuckets> {
  if (USE_MOCK_API) {
    const source = kind === "ar" ? mockAr : mockAp;
    const today = new Date();
    const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
    for (const invoice of source) {
      if (invoice.status === "paid" || invoice.status === "voided") continue;
      const due = invoice.dueDate ? new Date(invoice.dueDate) : today;
      const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
      const remaining = invoice.total - invoice.amountPaid;
      if (days <= 0) buckets.current += remaining;
      else if (days <= 30) buckets.days1to30 += remaining;
      else if (days <= 60) buckets.days31to60 += remaining;
      else if (days <= 90) buckets.days61to90 += remaining;
      else buckets.over90 += remaining;
    }
    return {
      ...buckets,
      total: Object.values(buckets).reduce((sum, value) => sum + value, 0),
    };
  }

  const data = await apiRequest<any>(`/${kind === "ar" ? "ar-aging" : "ap-aging"}`);
  return mapAging(data);
}

/* -------------------------------------------------------------------------- */
/* Mock fixtures                                                              */
/* -------------------------------------------------------------------------- */

const today = () => new Date().toISOString().slice(0, 10);

const dayOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

let mockAccounts: Account[] = [
  { id: "acc-1000", code: "1000", name: "Cash on hand", type: "asset", parentId: null, openingBalance: 4_500_000, isActive: true, description: "Till floats and petty cash" },
  { id: "acc-1100", code: "1100", name: "Bank", type: "asset", parentId: null, openingBalance: 18_000_000, isActive: true, description: null },
  { id: "acc-1200", code: "1200", name: "Accounts receivable", type: "asset", parentId: null, openingBalance: 0, isActive: true, description: null },
  { id: "acc-2000", code: "2000", name: "Accounts payable", type: "liability", parentId: null, openingBalance: 0, isActive: true, description: null },
  { id: "acc-3000", code: "3000", name: "Owner equity", type: "equity", parentId: null, openingBalance: 20_000_000, isActive: true, description: null },
  { id: "acc-4000", code: "4000", name: "Sales revenue", type: "revenue", parentId: null, openingBalance: 0, isActive: true, description: null },
  { id: "acc-5000", code: "5000", name: "Cost of goods sold", type: "cogs", parentId: null, openingBalance: 0, isActive: true, description: null },
  { id: "acc-6100", code: "6100", name: "Rent", type: "expense", parentId: null, openingBalance: 0, isActive: true, description: null },
];

let mockJournal: JournalEntry[] = [
  {
    id: "je-1",
    number: "JE-0001",
    entryDate: dayOffset(-3),
    description: "Monthly rent",
    status: "posted",
    referenceType: null,
    totalDebit: 2_500_000,
    totalCredit: 2_500_000,
    lines: [
      { id: "jel-1", accountId: "acc-6100", accountCode: "6100", accountName: "Rent", debit: 2_500_000, credit: 0, description: "Outlet lease" },
      { id: "jel-2", accountId: "acc-1100", accountCode: "1100", accountName: "Bank", debit: 0, credit: 2_500_000, description: null },
    ],
  },
  {
    id: "je-2",
    number: "JE-0002",
    entryDate: today(),
    description: "Till top-up",
    status: "draft",
    referenceType: null,
    totalDebit: 500_000,
    totalCredit: 500_000,
    lines: [
      { id: "jel-3", accountId: "acc-1000", accountCode: "1000", accountName: "Cash on hand", debit: 500_000, credit: 0, description: null },
      { id: "jel-4", accountId: "acc-1100", accountCode: "1100", accountName: "Bank", debit: 0, credit: 500_000, description: null },
    ],
  },
];

let mockAr: Invoice[] = [
  {
    id: "ar-1",
    number: "INV-2026-001",
    partyId: "cust-1",
    partyName: "Budi Santoso",
    issueDate: dayOffset(-24),
    dueDate: dayOffset(-14),
    subtotal: 1_200_000,
    tax: 132_000,
    total: 1_332_000,
    amountPaid: 0,
    status: "open",
    notes: "Corporate catering",
    payments: [],
  },
  {
    id: "ar-2",
    number: "INV-2026-002",
    partyId: "cust-2",
    partyName: "Siti Rahayu",
    issueDate: dayOffset(-6),
    dueDate: dayOffset(8),
    subtotal: 480_000,
    tax: 52_800,
    total: 532_800,
    amountPaid: 200_000,
    status: "partial",
    notes: null,
    payments: [{ id: "arp-1", amount: 200_000, paymentDate: dayOffset(-2), method: "transfer", reference: "TRX-8842" }],
  },
];

let mockAp: Invoice[] = [
  {
    id: "ap-1",
    number: "SUP-2026-014",
    partyId: "sup-1",
    partyName: "Nusantara Coffee Roasters",
    issueDate: dayOffset(-40),
    dueDate: dayOffset(-10),
    subtotal: 3_600_000,
    tax: 396_000,
    total: 3_996_000,
    amountPaid: 1_000_000,
    status: "partial",
    notes: "November beans",
    payments: [{ id: "app-1", amount: 1_000_000, paymentDate: dayOffset(-8), method: "transfer", reference: null }],
  },
];

const mockParties: Record<InvoiceKind, { id: string; name: string }[]> = {
  ar: [
    { id: "cust-1", name: "Budi Santoso" },
    { id: "cust-2", name: "Siti Rahayu" },
  ],
  ap: [
    { id: "sup-1", name: "Nusantara Coffee Roasters" },
    { id: "sup-2", name: "Fresh Produce Co." },
  ],
};
