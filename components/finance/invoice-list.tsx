"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Banknote, Plus, Receipt } from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Button, EmptyState, Field, Input, Segmented, Select, Textarea } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { listCustomers } from "@/lib/api/customers";
import { listSuppliers } from "@/lib/api/purchasing";
import {
  createInvoice,
  getAging,
  listInvoices,
  payInvoice,
  type Invoice,
  type InvoiceInput,
  type InvoiceStatus,
} from "@/lib/api/finance";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatCurrency, formatShortDate, formatNumber } from "@/lib/formatting/currency";

type Kind = "ar" | "ap";
type Filter = "all" | InvoiceStatus;

const CONFIG: Record<
  Kind,
  {
    eyebrow: string;
    title: string;
    description: string;
    view: string;
    manage: string;
    partyLabel: string;
    numberExample: string;
    payLabel: string;
    direction: "in" | "out";
  }
> = {
  ar: {
    eyebrow: "Finance",
    title: "Receivables",
    description: "Invoices you have issued to customers, what has been paid, and what is overdue.",
    view: "ar.view",
    manage: "ar.manage",
    partyLabel: "Customer",
    numberExample: "INV-2026-001",
    payLabel: "Record payment",
    direction: "in",
  },
  ap: {
    eyebrow: "Finance",
    title: "Payables",
    description: "Supplier invoices you owe, how much has been paid, and what is falling due.",
    view: "ap.view",
    manage: "ap.manage",
    partyLabel: "Supplier",
    numberExample: "SUP-2026-014",
    payLabel: "Pay supplier",
    direction: "out",
  },
};

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  open: "info",
  partial: "warning",
  paid: "success",
  overdue: "danger",
  voided: "neutral",
};

function InvoiceStatusPill({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

export function InvoiceList({ kind }: { kind: Kind }) {
  const config = CONFIG[kind];
  const { has } = usePermissions();
  const queryClient = useQueryClient();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [paying, setPaying] = React.useState<Invoice | null>(null);

  const canView = has(config.view);
  const canManage = has(config.manage);

  const invoices = useQuery({
    queryKey: ["finance", "invoices", kind, filter],
    queryFn: () => listInvoices(kind, filter === "all" ? undefined : filter),
    enabled: canView,
    staleTime: 30_000,
  });

  const aging = useQuery({
    queryKey: ["finance", "aging", kind],
    queryFn: () => getAging(kind),
    enabled: canView,
  });

  const parties = useQuery({
    queryKey: ["finance", "parties", kind],
    queryFn: async () => {
      if (kind === "ar") {
        const page = await listCustomers({ pageSize: 200 });
        return page.data.map((customer) => ({ id: customer.id, name: customer.name }));
      }
      const suppliers = await listSuppliers();
      return suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }));
    },
    enabled: canManage,
    staleTime: 60_000,
  });

  if (!canView) {
    return <AccessDenied permission={config.view} />;
  }

  const rows = invoices.data ?? [];
  const outstanding = aging.data?.total ?? 0;
  const overdue = (aging.data?.days31to60 ?? 0) + (aging.data?.days61to90 ?? 0) + (aging.data?.over90 ?? 0);

  const buckets = [
    { label: "Current", value: aging.data?.current ?? 0 },
    { label: "1–30 days", value: aging.data?.days1to30 ?? 0 },
    { label: "31–60 days", value: aging.data?.days31to60 ?? 0 },
    { label: "61–90 days", value: aging.data?.days61to90 ?? 0 },
    { label: "Over 90 days", value: aging.data?.over90 ?? 0 },
  ];

  const columns: Column<Invoice>[] = [
    {
      id: "number",
      header: "Invoice",
      sortable: true,
      sortValue: (row) => row.number,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }} className="num">
            {row.number}
          </div>
          <div className="hint">{row.partyName || `No ${config.partyLabel.toLowerCase()}`}</div>
        </div>
      ),
    },
    {
      id: "issue",
      header: "Issued",
      sortable: true,
      sortValue: (row) => row.issueDate,
      cell: (row) => <span className="num cell-muted">{formatShortDate(row.issueDate)}</span>,
    },
    {
      id: "due",
      header: "Due",
      sortable: true,
      sortValue: (row) => row.dueDate ?? "",
      cell: (row) => <span className="num cell-muted">{row.dueDate ? formatShortDate(row.dueDate) : "—"}</span>,
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      sortable: true,
      sortValue: (row) => row.total,
      cell: (row) => <span className="num">{formatCurrency(row.total)}</span>,
    },
    {
      id: "outstanding",
      header: "Outstanding",
      align: "right",
      sortable: true,
      sortValue: (row) => row.total - row.amountPaid,
      cell: (row) => (
        <span className="num" style={{ fontWeight: row.total - row.amountPaid > 0 ? 600 : 400 }}>
          {formatCurrency(row.total - row.amountPaid)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      align: "center",
      cell: (row) => <InvoiceStatusPill status={row.status} />,
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            cell: (row: Invoice) =>
              row.status !== "paid" && row.status !== "voided" ? (
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPaying(row);
                  }}
                >
                  <Banknote aria-hidden="true" />
                  {config.payLabel}
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              New invoice
            </Button>
          ) : null
        }
      />

      <div className="stat-grid">
        <Stat
          label="Outstanding"
          value={formatCurrency(outstanding)}
          foot={`${formatNumber(rows.length)} ${rows.length === 1 ? "invoice" : "invoices"} in this view`}
        />
        <Stat
          label="More than 30 days late"
          value={formatCurrency(overdue)}
          foot={overdue > 0 ? "Chase these first" : "Nothing overdue"}
          emphasis={overdue > 0}
        />
        {buckets.slice(0, 2).map((bucket) => (
          <Stat
            key={bucket.label}
            label={bucket.label}
            value={formatCurrency(bucket.value)}
            foot={kind === "ar" ? "Owed to you" : "Owed by you"}
          />
        ))}
      </div>

      <Card>
        <div className="toolbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <Segmented
            label="Filter by status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "open", label: "Open" },
              { value: "partial", label: "Partial" },
              { value: "paid", label: "Paid" },
            ]}
          />
          <div className="spacer" />
          <span className="hint" style={{ margin: 0 }}>
            {invoices.isLoading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "invoice" : "invoices"}`}
          </span>
        </div>

        {invoices.isError ? (
          <InlineError title={`${config.title} could not be loaded`} error={invoices.error} onRetry={() => invoices.refetch()} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowId={(row) => row.id}
            loading={invoices.isLoading}
            minWidth={860}
            empty={
              <EmptyState
                icon={kind === "ar" ? <ArrowDownLeft aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
                title={filter === "all" ? "No invoices yet" : `No ${filter} invoices`}
                description={
                  filter === "all"
                    ? `Raise an invoice when a ${config.partyLabel.toLowerCase()} is billed for goods or services outside the register.`
                    : "Switch the filter to see the rest of the ledger."
                }
                actions={
                  canManage && filter === "all" ? (
                    <Button variant="primary" onClick={() => setCreateOpen(true)}>
                      New invoice
                    </Button>
                  ) : undefined
                }
              />
            }
            mobile={(row) => (
              <div className="record">
                <div className="record__head">
                  <strong className="num">{row.number}</strong>
                  <span className="num">{formatCurrency(row.total - row.amountPaid)}</span>
                </div>
                <div className="record__meta">
                  <span>{row.partyName || `No ${config.partyLabel.toLowerCase()}`}</span>
                  <span>{row.dueDate ? `Due ${formatShortDate(row.dueDate)}` : "No due date"}</span>
                  <InvoiceStatusPill status={row.status} />
                </div>
              </div>
            )}
          />
        )}
      </Card>

      <Card>
        <CardHeader
          title="Aging"
          description={`Unpaid ${kind === "ar" ? "customer" : "supplier"} invoices by days past due.`}
          actions={
            <Badge tone="neutral">
              <Receipt aria-hidden="true" size={12} /> {formatCurrency(outstanding)}
            </Badge>
          }
        />
        <CardBody>
          {aging.isError ? (
            <InlineError title="Could not load the aging report" error={aging.error} onRetry={() => aging.refetch()} />
          ) : (
            <div className="grid-3" style={{ gap: 12 }}>
              {buckets.map((bucket) => (
                <div key={bucket.label} className="stack-sm">
                  <span className="hint" style={{ margin: 0 }}>
                    {bucket.label}
                  </span>
                  <strong className="num">{formatCurrency(bucket.value)}</strong>
                </div>
              ))}
              <div className="stack-sm">
                <span className="hint" style={{ margin: 0 }}>
                  Total
                </span>
                <strong className="num">{formatCurrency(outstanding)}</strong>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <InvoiceEditor
        open={createOpen}
        kind={kind}
        parties={parties.data ?? []}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          queryClient.invalidateQueries({ queryKey: ["finance"] });
        }}
      />

      <PaymentSheet
        invoice={paying}
        kind={kind}
        onClose={() => setPaying(null)}
        onSaved={() => {
          setPaying(null);
          queryClient.invalidateQueries({ queryKey: ["finance"] });
        }}
      />
    </>
  );
}

function InvoiceEditor({
  open,
  kind,
  parties,
  onClose,
  onSaved,
}: {
  open: boolean;
  kind: Kind;
  parties: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const config = CONFIG[kind];
  const { push } = useToast();
  const [form, setForm] = React.useState({
    number: "",
    partyId: "",
    issueDate: "",
    dueDate: "",
    subtotal: "",
    tax: "",
    notes: "",
  });
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    setForm({ number: "", partyId: "", issueDate: today, dueDate: "", subtotal: "", tax: "", notes: "" });
    setError("");
  }, [open]);

  const subtotal = Number(form.subtotal) || 0;
  const tax = Number(form.tax) || 0;
  const total = subtotal + tax;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.number.trim()) throw new Error("Enter the invoice number from the document.");
      if (subtotal < 0 || tax < 0) throw new Error("Amounts cannot be negative.");
      if (total <= 0) throw new Error("Enter a subtotal so the invoice has a total.");
      const input: InvoiceInput = {
        number: form.number.trim(),
        partyId: form.partyId || undefined,
        issueDate: form.issueDate,
        dueDate: form.dueDate || undefined,
        subtotal: Math.round(subtotal),
        tax: Math.round(tax),
        total: Math.round(total),
        notes: form.notes.trim() || undefined,
      };
      return createInvoice(kind, input);
    },
    onSuccess: (invoice) => {
      push({
        title: "Invoice created",
        description: `${invoice.number} · ${formatCurrency(invoice.total)}`,
        variant: "success",
      });
      onSaved();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "The invoice could not be saved.");
    },
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`New ${kind === "ar" ? "receivable" : "payable"} invoice`}
      description="Record the document once; payments are applied against it afterwards."
      width={520}
      footer={
        <>
          <span className="hint" style={{ marginRight: "auto" }}>
            Total {formatCurrency(total)}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="invoice-editor" variant="primary" loading={mutation.isPending} disabled={total <= 0}>
            Create invoice
          </Button>
        </>
      }
    >
      <form
        id="invoice-editor"
        className="stack"
        style={{ gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        {error ? (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        ) : null}
        <Field label="Invoice number" htmlFor="invoice-number" required>
          <Input
            id="invoice-number"
            value={form.number}
            onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))}
            placeholder={config.numberExample}
            autoFocus
          />
        </Field>
        <Field label={config.partyLabel} htmlFor="invoice-party" hint="Optional — leave blank for a cash document.">
          <Select
            id="invoice-party"
            value={form.partyId}
            onChange={(event) => setForm((current) => ({ ...current, partyId: event.target.value }))}
          >
            <option value="">No {config.partyLabel.toLowerCase()}</option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Issue date" htmlFor="invoice-issue" required>
            <Input
              id="invoice-issue"
              type="date"
              value={form.issueDate}
              onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value }))}
            />
          </Field>
          <Field label="Due date" htmlFor="invoice-due" hint="Used by the aging report.">
            <Input
              id="invoice-due"
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
            />
          </Field>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Subtotal" htmlFor="invoice-subtotal" required>
            <Input
              id="invoice-subtotal"
              value={form.subtotal}
              onChange={(event) => setForm((current) => ({ ...current, subtotal: event.target.value }))}
              inputMode="numeric"
              placeholder="0"
            />
          </Field>
          <Field label="Tax" htmlFor="invoice-tax">
            <Input
              id="invoice-tax"
              value={form.tax}
              onChange={(event) => setForm((current) => ({ ...current, tax: event.target.value }))}
              inputMode="numeric"
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Notes" htmlFor="invoice-notes">
          <Textarea
            id="invoice-notes"
            rows={2}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Reference, project, or delivery note"
          />
        </Field>
      </form>
    </Sheet>
  );
}

function PaymentSheet({
  invoice,
  kind,
  onClose,
  onSaved,
}: {
  invoice: Invoice | null;
  kind: Kind;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const outstanding = invoice ? Math.max(0, invoice.total - invoice.amountPaid) : 0;
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState("");
  const [method, setMethod] = React.useState("transfer");
  const [reference, setReference] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!invoice) return;
    setAmount(String(Math.max(0, invoice.total - invoice.amountPaid)));
    setDate(new Date().toISOString().slice(0, 10));
    setMethod("transfer");
    setReference("");
    setError("");
  }, [invoice]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error("No invoice selected.");
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Enter how much was paid.");
      if (value > outstanding) throw new Error(`That is more than the ${formatCurrency(outstanding)} outstanding.`);
      return payInvoice(kind, invoice.id, {
        amount: Math.round(value),
        paymentDate: date,
        method,
        reference: reference.trim() || undefined,
      });
    },
    onSuccess: (updated) => {
      push({
        title: kind === "ar" ? "Payment recorded" : "Payment made",
        description: `${updated.number} · ${formatCurrency(updated.total - updated.amountPaid)} still outstanding.`,
        variant: "success",
      });
      onSaved();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "The payment could not be recorded.");
    },
  });

  return (
    <Sheet
      open={Boolean(invoice)}
      onClose={onClose}
      title={kind === "ar" ? "Record a payment" : "Pay supplier invoice"}
      description={
        invoice
          ? `${invoice.number} · ${formatCurrency(invoice.total - invoice.amountPaid)} outstanding of ${formatCurrency(invoice.total)}.`
          : undefined
      }
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="payment-editor" variant="primary" loading={mutation.isPending}>
            Record payment
          </Button>
        </>
      }
    >
      <form
        id="payment-editor"
        className="stack"
        style={{ gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        {error ? (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        ) : null}
        <Field label="Amount" htmlFor="payment-amount" required hint={`Outstanding ${formatCurrency(outstanding)}`}>
          <Input
            id="payment-amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="numeric"
            autoFocus
          />
        </Field>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Payment date" htmlFor="payment-date" required>
            <Input id="payment-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Method" htmlFor="payment-method">
            <Select id="payment-method" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="cash">Cash</option>
              <option value="transfer">Bank transfer</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </Select>
          </Field>
        </div>
        <Field label="Reference" htmlFor="payment-reference" hint="Bank reference or receipt number.">
          <Input
            id="payment-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="TRX-8842"
          />
        </Field>
      </form>
    </Sheet>
  );
}
