"use client";

export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, BookOpen, Landmark, ReceiptText, Scale } from "lucide-react";
import { PageHeader, Stat } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { getAging, getTrialBalance, listJournalEntries, type TrialBalanceRow } from "@/lib/api/finance";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatCurrency, formatNumber } from "@/lib/formatting/currency";

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense",
  cogs: "Cost of goods sold",
};

export default function FinanceOverviewPage() {
  const { has } = usePermissions();
  const canReadFinance = has("financial_reports.view");
  const canReadAr = has("ar.view");
  const canReadAp = has("ap.view");
  const canReadJournal = has("journal.view");

  const trialBalance = useQuery({
    queryKey: ["finance", "trial-balance"],
    queryFn: () => getTrialBalance(),
    enabled: canReadFinance,
    staleTime: 60_000,
  });
  const arAging = useQuery({
    queryKey: ["finance", "aging", "ar"],
    queryFn: () => getAging("ar"),
    enabled: canReadAr,
  });
  const apAging = useQuery({
    queryKey: ["finance", "aging", "ap"],
    queryFn: () => getAging("ap"),
    enabled: canReadAp,
  });
  const drafts = useQuery({
    queryKey: ["finance", "journal", "draft"],
    queryFn: () => listJournalEntries("draft"),
    enabled: canReadJournal,
  });

  if (!canReadFinance && !canReadAr && !canReadAp && !canReadJournal) {
    return <AccessDenied permission="financial_reports.view" />;
  }

  const receivable = arAging.data?.total ?? 0;
  const payable = apAging.data?.total ?? 0;
  const overdue = (arAging.data?.days31to60 ?? 0) + (arAging.data?.days61to90 ?? 0) + (arAging.data?.over90 ?? 0);
  const draftCount = drafts.data?.length;

  const buckets = (aging?: typeof arAging.data) => [
    { label: "Current", value: aging?.current ?? 0 },
    { label: "1–30 days", value: aging?.days1to30 ?? 0 },
    { label: "31–60 days", value: aging?.days31to60 ?? 0 },
    { label: "61–90 days", value: aging?.days61to90 ?? 0 },
    { label: "Over 90 days", value: aging?.over90 ?? 0 },
  ];

  const columns: Column<TrialBalanceRow>[] = [
    {
      id: "code",
      header: "Code",
      sortable: true,
      sortValue: (row) => row.code,
      cell: (row) => <span className="num cell-muted">{row.code}</span>,
    },
    {
      id: "name",
      header: "Account",
      sortable: true,
      sortValue: (row) => row.name,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div className="hint">{ACCOUNT_TYPE_LABEL[row.type] ?? row.type}</div>
        </div>
      ),
    },
    {
      id: "debit",
      header: "Debit",
      align: "right",
      sortable: true,
      sortValue: (row) => row.debit,
      cell: (row) => (row.debit ? formatCurrency(row.debit) : "—"),
    },
    {
      id: "credit",
      header: "Credit",
      align: "right",
      sortable: true,
      sortValue: (row) => row.credit,
      cell: (row) => (row.credit ? formatCurrency(row.credit) : "—"),
    },
  ];

  const totalDebit = trialBalance.data?.totalDebit ?? 0;
  const totalCredit = trialBalance.data?.totalCredit ?? 0;
  const balanced = totalDebit === totalCredit;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Finance"
        title="Finance overview"
        description="What you are owed, what you owe, and whether the books balance."
        actions={
          <>
            {has("accounts.view") ? (
              <Link href="/finance/accounts" className="btn btn--secondary btn--sm">
                <Landmark aria-hidden="true" />
                Chart of accounts
              </Link>
            ) : null}
            {canReadJournal ? (
              <Link href="/finance/journal" className="btn btn--secondary btn--sm">
                <BookOpen aria-hidden="true" />
                Journal
              </Link>
            ) : null}
            {canReadAr ? (
              <Link href="/finance/receivables" className="btn btn--secondary btn--sm">
                <ArrowDownLeft aria-hidden="true" />
                Receivables
              </Link>
            ) : null}
            {canReadAp ? (
              <Link href="/finance/payables" className="btn btn--secondary btn--sm">
                <ArrowUpRight aria-hidden="true" />
                Payables
              </Link>
            ) : null}
          </>
        }
      />

      <div className="stat-grid">
        {canReadAr ? (
          <Stat
            label="Receivable"
            value={formatCurrency(receivable)}
            foot={overdue > 0 ? `${formatCurrency(overdue)} more than 30 days late` : "Nothing overdue"}
            emphasis={overdue > 0}
          />
        ) : null}
        {canReadAp ? (
          <Stat label="Payable" value={formatCurrency(payable)} foot="Open supplier invoices" />
        ) : null}
        {canReadFinance ? (
          <Stat
            label="Debits"
            value={formatCurrency(totalDebit)}
            foot={balanced ? "Matches credits" : `${formatCurrency(Math.abs(totalDebit - totalCredit))} out of balance`}
            emphasis={!balanced}
          />
        ) : null}
        {canReadJournal ? (
          <Stat
            label="Draft entries"
            value={formatNumber(draftCount ?? 0)}
            foot={draftCount ? "Waiting to be posted" : "Everything is posted"}
          />
        ) : null}
      </div>

      <div className="grid-2">
        {canReadAr ? (
          <Card>
            <CardHeader
              title="Receivables aging"
              description="Unpaid customer invoices by days past due."
              actions={
                <Link href="/finance/receivables" className="btn btn--quiet btn--sm">
                  Open
                </Link>
              }
            />
            <CardBody>
              {arAging.isError ? (
                <InlineError title="Could not load receivables aging" error={arAging.error} onRetry={() => arAging.refetch()} />
              ) : receivable === 0 && !arAging.isLoading ? (
                <p className="hint" style={{ margin: 0 }}>
                  No outstanding customer invoices.
                </p>
              ) : (
                <div className="stack-sm">
                  {buckets(arAging.data).map((bucket) => (
                    <div key={bucket.label} className="row" style={{ justifyContent: "space-between" }}>
                      <span>{bucket.label}</span>
                      <strong className="num">{formatCurrency(bucket.value)}</strong>
                    </div>
                  ))}
                  <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid hsl(var(--border))", paddingTop: 10 }}>
                    <span>Total outstanding</span>
                    <strong className="num">{formatCurrency(receivable)}</strong>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        ) : null}

        {canReadAp ? (
          <Card>
            <CardHeader
              title="Payables aging"
              description="Supplier invoices still to pay, by days past due."
              actions={
                <Link href="/finance/payables" className="btn btn--quiet btn--sm">
                  Open
                </Link>
              }
            />
            <CardBody>
              {apAging.isError ? (
                <InlineError title="Could not load payables aging" error={apAging.error} onRetry={() => apAging.refetch()} />
              ) : payable === 0 && !apAging.isLoading ? (
                <p className="hint" style={{ margin: 0 }}>
                  No outstanding supplier invoices.
                </p>
              ) : (
                <div className="stack-sm">
                  {buckets(apAging.data).map((bucket) => (
                    <div key={bucket.label} className="row" style={{ justifyContent: "space-between" }}>
                      <span>{bucket.label}</span>
                      <strong className="num">{formatCurrency(bucket.value)}</strong>
                    </div>
                  ))}
                  <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid hsl(var(--border))", paddingTop: 10 }}>
                    <span>Total outstanding</span>
                    <strong className="num">{formatCurrency(payable)}</strong>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        ) : null}
      </div>

      {canReadFinance ? (
        <Card>
          <CardHeader
            title="Trial balance"
            description="Every account's posted debits and credits, including opening balances."
            actions={
              <span className="row" style={{ gap: 6 }}>
                <Scale aria-hidden="true" size={14} />
                <span className="hint" style={{ margin: 0 }}>
                  {balanced ? "Balanced" : "Out of balance"}
                </span>
              </span>
            }
          />
          <CardBody>
            {trialBalance.isError ? (
              <InlineError title="Could not load the trial balance" error={trialBalance.error} onRetry={() => trialBalance.refetch()} />
            ) : (trialBalance.data?.accounts.length ?? 0) === 0 && !trialBalance.isLoading ? (
              <EmptyState
                icon={<ReceiptText aria-hidden="true" />}
                title="No accounts yet"
                description="Add accounts to the chart of accounts before posting journal entries."
                actions={
                  has("accounts.manage") ? (
                    <Link href="/finance/accounts" className="btn btn--primary">
                      Set up accounts
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <DataTable
                rows={trialBalance.data?.accounts ?? []}
                columns={columns}
                rowId={(row) => row.accountId}
                loading={trialBalance.isPending}
                minWidth={620}
                footer={
                  <div className="row" style={{ justifyContent: "flex-end", gap: 24, padding: "12px 16px" }}>
                    <span className="hint" style={{ margin: 0 }}>
                      Totals
                    </span>
                    <strong className="num">{formatCurrency(totalDebit)}</strong>
                    <strong className="num">{formatCurrency(totalCredit)}</strong>
                  </div>
                }
                mobile={(row) => (
                  <div className="record">
                    <div className="record__head">
                      <strong>
                        <span className="num cell-muted">{row.code}</span> {row.name}
                      </strong>
                      <span className="num">{formatCurrency(row.debit || row.credit)}</span>
                    </div>
                    <div className="record__meta">
                      <span>{ACCOUNT_TYPE_LABEL[row.type] ?? row.type}</span>
                      <span>{row.debit ? "Debit" : "Credit"}</span>
                    </div>
                  </div>
                )}
              />
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
