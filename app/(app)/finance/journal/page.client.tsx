"use client";

export const instant = false;

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Plus, Trash2, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, Button, EmptyState, Field, Input, Segmented, Select, Textarea } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  createJournalEntry,
  listAccounts,
  listJournalEntries,
  postJournalEntry,
  reverseJournalEntry,
  type JournalEntry,
  type JournalLineInput,
  type JournalStatus,
} from "@/lib/api/finance";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatCurrency, formatShortDate } from "@/lib/formatting/currency";

type Filter = "all" | JournalStatus;

const STATUS_LABEL: Record<JournalStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  reversed: "Reversed",
};

function StatusPill({ status }: { status: JournalStatus }) {
  const tone = status === "posted" ? "success" : status === "reversed" ? "warning" : "neutral";
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

export default function JournalPage() {
  const { has } = usePermissions();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [reversing, setReversing] = React.useState<JournalEntry | null>(null);

  const query = useQuery({
    queryKey: ["finance", "journal", filter],
    queryFn: () => listJournalEntries(filter === "all" ? undefined : filter),
    enabled: has("journal.view"),
    staleTime: 30_000,
  });

  const accounts = useQuery({
    queryKey: ["finance", "accounts"],
    queryFn: () => listAccounts(),
    enabled: has("journal.view") || has("accounts.view"),
    staleTime: 60_000,
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => postJournalEntry(id),
    onSuccess: (entry) => {
      push({ title: "Entry posted", description: `${entry.number} is now in the ledger.`, variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (error) => {
      push({
        title: "Could not post the entry",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (id: string) => reverseJournalEntry(id),
    onSuccess: (entry) => {
      push({ title: "Entry reversed", description: `${entry.number} offsets the original entry.`, variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      setReversing(null);
    },
    onError: (error) => {
      push({
        title: "Could not reverse the entry",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
      setReversing(null);
    },
  });

  const canManage = has("journal.manage");
  const accountList = React.useMemo(() => accounts.data ?? [], [accounts.data]);

  if (!has("journal.view")) {
    return <AccessDenied permission="journal.view" />;
  }

  const rows = query.data ?? [];

  const columns: Column<JournalEntry>[] = [
    {
      id: "date",
      header: "Date",
      sortable: true,
      sortValue: (row) => row.entryDate,
      cell: (row) => <span className="num">{formatShortDate(row.entryDate)}</span>,
    },
    {
      id: "number",
      header: "Entry",
      sortable: true,
      sortValue: (row) => row.number,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }} className="num">
            {row.number}
          </div>
          <div className="hint">{row.description || "No description"}</div>
        </div>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      sortValue: (row) => row.totalDebit,
      cell: (row) => <span className="num">{formatCurrency(row.totalDebit)}</span>,
    },
    {
      id: "lines",
      header: "Lines",
      align: "center",
      cell: (row) => <span className="num cell-muted">{row.lines.length}</span>,
    },
    {
      id: "status",
      header: "Status",
      align: "center",
      cell: (row) => <StatusPill status={row.status} />,
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            cell: (row: JournalEntry) => (
              <div className="row" style={{ gap: 4, justifyContent: "flex-end" }} onClick={(event) => event.stopPropagation()}>
                {row.status === "draft" ? (
                  <Button
                    variant="quiet"
                    size="sm"
                    loading={postMutation.isPending && postMutation.variables === row.id}
                    onClick={() => postMutation.mutate(row.id)}
                  >
                    <Check aria-hidden="true" />
                    Post
                  </Button>
                ) : null}
                {row.status === "posted" ? (
                  <Button variant="quiet" size="sm" onClick={() => setReversing(row)}>
                    <Undo2 aria-hidden="true" />
                    Reverse
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Journal"
        description="Double-entry postings. Drafts can still be edited by reversing; posted entries are permanent until you reverse them."
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setEditorOpen(true)} disabled={accountList.length < 2}>
              <Plus aria-hidden="true" />
              New entry
            </Button>
          ) : null
        }
      />

      <Card>
        <div className="toolbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <Segmented
            label="Filter by status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "draft", label: "Draft" },
              { value: "posted", label: "Posted" },
              { value: "reversed", label: "Reversed" },
            ]}
          />
          <div className="spacer" />
          <span className="hint" style={{ margin: 0 }}>
            {query.isLoading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`}
          </span>
        </div>

        {query.isError ? (
          <InlineError title="Journal entries could not be loaded" error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowId={(row) => row.id}
            loading={query.isLoading}
            minWidth={720}
            empty={
              <EmptyState
                icon={<BookOpen aria-hidden="true" />}
                title={filter === "all" ? "No journal entries yet" : `No ${filter} entries`}
                description={
                  accountList.length < 2
                    ? "Create at least two accounts before posting a double-entry journal."
                    : "Record an adjustment, accrual or owner movement."
                }
                actions={
                  canManage && accountList.length >= 2 ? (
                    <Button variant="primary" onClick={() => setEditorOpen(true)}>
                      New entry
                    </Button>
                  ) : undefined
                }
              />
            }
            mobile={(row) => (
              <div className="record">
                <div className="record__head">
                  <strong className="num">{row.number}</strong>
                  <StatusPill status={row.status} />
                </div>
                <div className="record__meta">
                  <span>{formatShortDate(row.entryDate)}</span>
                  <span>{row.description || "No description"}</span>
                  <span className="num">{formatCurrency(row.totalDebit)}</span>
                </div>
              </div>
            )}
          />
        )}
      </Card>

      <JournalEditor open={editorOpen} accounts={accountList} onClose={() => setEditorOpen(false)} />

      <ConfirmDialog
        open={Boolean(reversing)}
        onClose={() => setReversing(null)}
        onConfirm={() => reversing && reverseMutation.mutate(reversing.id)}
        title="Reverse this entry?"
        description={
          <>
            A new posted entry will mirror <b>{reversing?.number}</b>, swapping debits and credits. The original entry stays
            in the ledger, marked reversed.
          </>
        }
        confirmLabel="Reverse entry"
        tone="primary"
        loading={reverseMutation.isPending}
      />
    </>
  );
}

type DraftLine = { key: string; accountId: string; debit: string; credit: string; description: string };

let lineCounter = 0;
const nextLine = (accountId = ""): DraftLine => ({
  key: `line-${(lineCounter += 1)}`,
  accountId,
  debit: "",
  credit: "",
  description: "",
});

function JournalEditor({
  open,
  accounts,
  onClose,
}: {
  open: boolean;
  accounts: { id: string; code: string; name: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [entryDate, setEntryDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<"draft" | "posted">("draft");
  const [lines, setLines] = React.useState<DraftLine[]>([nextLine(), nextLine()]);
  const [error, setError] = React.useState("");
  const wasOpen = React.useRef(false);

  // Reset only on the open transition, so typing is never wiped by a refetch.
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setEntryDate(new Date().toISOString().slice(0, 10));
      setDescription("");
      setStatus("draft");
      setLines([nextLine(accounts[0]?.id ?? ""), nextLine(accounts[1]?.id ?? "")]);
      setError("");
    }
    wasOpen.current = open;
  }, [open, accounts]);

  const debitTotal = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const creditTotal = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const balanced = debitTotal === creditTotal && debitTotal > 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const filled = lines.filter((line) => Number(line.debit) > 0 || Number(line.credit) > 0);
      if (filled.length < 2) throw new Error("A journal entry needs at least two lines with amounts.");
      if (filled.some((line) => !line.accountId)) throw new Error("Choose an account on every line with an amount.");
      if (filled.some((line) => Number(line.debit) > 0 && Number(line.credit) > 0)) {
        throw new Error("A line is either a debit or a credit, not both.");
      }
      if (debitTotal !== creditTotal) throw new Error("Debits and credits must match before saving.");
      if (!entryDate) throw new Error("Choose the entry date.");

      const payload: JournalLineInput[] = filled.map((line) => ({
        accountId: line.accountId,
        debit: Math.round(Number(line.debit) || 0),
        credit: Math.round(Number(line.credit) || 0),
        description: line.description.trim() || undefined,
      }));

      return createJournalEntry({
        entryDate,
        description: description.trim() || undefined,
        status,
        lines: payload,
      });
    },
    onSuccess: (entry) => {
      push({
        title: entry.status === "posted" ? "Entry posted" : "Draft saved",
        description: `${entry.number} · ${formatCurrency(entry.totalDebit)}`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      onClose();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "The entry could not be saved.");
    },
  });

  const update = (key: string, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    setError("");
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New journal entry"
      description="Debits must equal credits. Post now or save as a draft."
      width={720}
      footer={
        <>
          <span className="hint" style={{ marginRight: "auto" }}>
            Debits {formatCurrency(debitTotal)} · Credits {formatCurrency(creditTotal)}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="journal-editor"
            variant="primary"
            loading={saveMutation.isPending}
            disabled={!balanced}
          >
            {status === "posted" ? "Post entry" : "Save draft"}
          </Button>
        </>
      }
    >
      <form
        id="journal-editor"
        className="stack"
        style={{ gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        {error ? (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        ) : null}
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Entry date" htmlFor="journal-date" required>
            <Input id="journal-date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
          </Field>
          <Field label="Save as" htmlFor="journal-status">
            <Select id="journal-status" value={status} onChange={(event) => setStatus(event.target.value as "draft" | "posted")}>
              <option value="draft">Draft</option>
              <option value="posted">Post immediately</option>
            </Select>
          </Field>
        </div>
        <Field label="Description" htmlFor="journal-description">
          <Textarea
            id="journal-description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this entry records"
          />
        </Field>

        <div className="stack-sm">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong style={{ fontSize: 13 }}>Lines</strong>
            <Button variant="quiet" size="sm" onClick={() => setLines((current) => [...current, nextLine()])}>
              <Plus aria-hidden="true" />
              Add line
            </Button>
          </div>

          {lines.map((line, index) => (
            <div key={line.key} className="stack-sm" style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, padding: 10 }}>
              <div className="row" style={{ gap: 8 }}>
                <Select
                  aria-label={`Account for line ${index + 1}`}
                  value={line.accountId}
                  onChange={(event) => update(line.key, { accountId: event.target.value })}
                  style={{ flex: 1 }}
                >
                  <option value="">Choose account…</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} · {account.name}
                    </option>
                  ))}
                </Select>
                {lines.length > 2 ? (
                  <Button
                    variant="danger-quiet"
                    size="sm"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Input
                  aria-label={`Debit for line ${index + 1}`}
                  value={line.debit}
                  onChange={(event) => update(line.key, { debit: event.target.value, credit: "" })}
                  inputMode="numeric"
                  placeholder="Debit"
                />
                <Input
                  aria-label={`Credit for line ${index + 1}`}
                  value={line.credit}
                  onChange={(event) => update(line.key, { credit: event.target.value, debit: "" })}
                  inputMode="numeric"
                  placeholder="Credit"
                />
              </div>
              <Input
                aria-label={`Description for line ${index + 1}`}
                value={line.description}
                onChange={(event) => update(line.key, { description: event.target.value })}
                placeholder="Line note (optional)"
              />
            </div>
          ))}

          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="hint" style={{ margin: 0 }}>
              {balanced ? "Balanced" : "Out of balance"}
            </span>
            <span className="num" style={{ fontWeight: 600 }}>
              {formatCurrency(debitTotal)} / {formatCurrency(creditTotal)}
            </span>
          </div>
        </div>
      </form>
    </Sheet>
  );
}
