"use client";

export const instant = false;

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, Button, EmptyState, Field, Input, Select, Switch, Textarea } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
  type Account,
  type AccountInput,
  type AccountType,
} from "@/lib/api/finance";
import { usePermissions } from "@/lib/auth/auth-context";
import { formatCurrency } from "@/lib/formatting/currency";

const TYPES: { value: AccountType; label: string }[] = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
  { value: "cogs", label: "Cost of goods sold" },
];

const TYPE_LABEL = Object.fromEntries(TYPES.map((type) => [type.value, type.label])) as Record<AccountType, string>;

export default function ChartOfAccountsPage() {
  const { has } = usePermissions();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Account | null>(null);

  const query = useQuery({
    queryKey: ["finance", "accounts"],
    queryFn: () => listAccounts(),
    enabled: has("accounts.view"),
    staleTime: 30_000,
  });

  if (!has("accounts.view")) {
    return <AccessDenied permission="accounts.view" />;
  }

  const canManage = has("accounts.manage");
  const rows = query.data ?? [];
  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const columns: Column<Account>[] = [
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
          <div className="hint">
            {TYPE_LABEL[row.type]}
            {row.parentId ? ` · child of ${rows.find((entry) => entry.id === row.parentId)?.name ?? "another account"}` : ""}
          </div>
        </div>
      ),
    },
    {
      id: "opening",
      header: "Opening balance",
      align: "right",
      sortable: true,
      sortValue: (row) => row.openingBalance,
      cell: (row) => <span className="num">{row.openingBalance ? formatCurrency(row.openingBalance) : "—"}</span>,
    },
    {
      id: "active",
      header: "Status",
      align: "center",
      cell: (row) => <Badge tone={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Inactive"}</Badge>,
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            cell: (row: Account) => (
              <Button
                variant="quiet"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setEditing(row);
                  setEditorOpen(true);
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
    <>
      <PageHeader
        eyebrow="Finance"
        title="Chart of accounts"
        description="The accounts journal entries post to, grouped by type. Opening balances only apply before the first entry."
        actions={
          canManage ? (
            <Button variant="primary" onClick={openNew}>
              <Plus aria-hidden="true" />
              New account
            </Button>
          ) : null
        }
      />

      <Card>
        {query.isError ? (
          <InlineError title="Accounts could not be loaded" error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowId={(row) => row.id}
            loading={query.isLoading}
            minWidth={680}
            onRowClick={
              canManage
                ? (row) => {
                    setEditing(row);
                    setEditorOpen(true);
                  }
                : undefined
            }
            empty={
              <EmptyState
                icon={<Landmark aria-hidden="true" />}
                title="No accounts yet"
                description="Start with cash, bank, receivables, payables, revenue and expenses so journal entries have somewhere to go."
                actions={
                  canManage ? (
                    <Button variant="primary" onClick={openNew}>
                      Add the first account
                    </Button>
                  ) : (
                    <span className="hint">Ask a manager to set up the chart of accounts.</span>
                  )
                }
              />
            }
            mobile={(row) => (
              <button
                type="button"
                className="record"
                onClick={() => {
                  if (!canManage) return;
                  setEditing(row);
                  setEditorOpen(true);
                }}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: 0 }}
              >
                <div className="record__head">
                  <strong>
                    <span className="num cell-muted">{row.code}</span> {row.name}
                  </strong>
                  <span className="num">{row.openingBalance ? formatCurrency(row.openingBalance) : "—"}</span>
                </div>
                <div className="record__meta">
                  <span>{TYPE_LABEL[row.type]}</span>
                  <span>{row.isActive ? "Active" : "Inactive"}</span>
                </div>
              </button>
            )}
          />
        )}
      </Card>

      <AccountEditor
        open={editorOpen}
        account={editing}
        accounts={rows}
        canManage={canManage}
        onClose={() => setEditorOpen(false)}
      />
    </>
  );
}

function AccountEditor({
  open,
  account,
  accounts,
  canManage,
  onClose,
}: {
  open: boolean;
  account: Account | null;
  accounts: Account[];
  canManage: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [form, setForm] = React.useState({
    code: "",
    name: "",
    type: "expense" as AccountType,
    parentId: "",
    openingBalance: "0",
    isActive: true,
    description: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      account
        ? {
            code: account.code,
            name: account.name,
            type: account.type,
            parentId: account.parentId ?? "",
            openingBalance: String(account.openingBalance),
            isActive: account.isActive,
            description: account.description ?? "",
          }
        : { code: "", name: "", type: "expense", parentId: "", openingBalance: "0", isActive: true, description: "" }
    );
  }, [open, account]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["finance"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const next: Record<string, string> = {};
      if (!form.code.trim()) next.code = "Enter an account code.";
      if (!form.name.trim()) next.name = "Enter an account name.";
      const opening = Number(form.openingBalance);
      if (form.openingBalance.trim() && (!Number.isFinite(opening) || opening < 0)) {
        next.openingBalance = "Opening balance must be zero or more.";
      }
      if (
        accounts.some(
          (entry) => entry.code === form.code.trim() && entry.id !== account?.id
        )
      ) {
        next.code = "Another account already uses that code.";
      }
      setErrors(next);
      if (Object.keys(next).length) throw new Error("Check the highlighted fields");

      const input: AccountInput = {
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
        parentId: form.parentId || undefined,
        openingBalance: Math.round(opening || 0),
        isActive: form.isActive,
        description: form.description.trim() || undefined,
      };
      if (account) return updateAccount(account.id, input);
      return createAccount(input);
    },
    onSuccess: (saved) => {
      push({
        title: account ? "Account updated" : "Account added",
        description: `${saved.code} ${saved.name} is ready for journal entries.`,
        variant: "success",
      });
      invalidate();
      onClose();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Check the highlighted fields") return;
      setErrors((current) => ({
        ...current,
        form: error instanceof Error ? error.message : "The account could not be saved.",
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount(account!.id),
    onSuccess: () => {
      push({ title: "Account deleted", description: `${account?.code} ${account?.name} was removed.`, variant: "success" });
      invalidate();
      setDeleteOpen(false);
      onClose();
    },
    onError: (error) => {
      setErrors((current) => ({
        ...current,
        form:
          error instanceof Error
            ? error.message
            : "This account could not be deleted. It may already have journal lines or child accounts.",
      }));
      setDeleteOpen(false);
    },
  });

  const parents = accounts.filter((entry) => entry.id !== account?.id);

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={account ? (canManage ? "Edit account" : account.name) : "New account"}
        description={
          account ? "Changes apply to future journal entries." : "Add an account journal entries can post to."
        }
        width={520}
        footer={
          canManage ? (
            <>
              {account ? (
                <Button variant="danger-quiet" onClick={() => setDeleteOpen(true)} disabled={saveMutation.isPending}>
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
              ) : null}
              <Button variant="ghost" onClick={onClose} disabled={saveMutation.isPending} style={{ marginLeft: account ? 0 : "auto" }}>
                Cancel
              </Button>
              <Button type="submit" form="account-editor" variant="primary" loading={saveMutation.isPending}>
                {account ? "Save changes" : "Create account"}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onClose} style={{ marginLeft: "auto" }}>
              Close
            </Button>
          )
        }
      >
        {!canManage ? (
          <div className="stack" style={{ gap: 14 }}>
            <div>
              <div className="hint num">{account?.code}</div>
              <h2 style={{ fontSize: 18 }}>{account?.name}</h2>
              <p className="hint" style={{ margin: 0 }}>
                {account ? TYPE_LABEL[account.type] : ""}
              </p>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Opening balance</span>
              <strong className="num">{formatCurrency(account?.openingBalance ?? 0)}</strong>
            </div>
            <Badge tone="neutral">Read-only</Badge>
          </div>
        ) : (
          <form
            id="account-editor"
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
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="Code" htmlFor="account-code" required error={errors.code}>
                <Input
                  id="account-code"
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="6100"
                  inputMode="numeric"
                  autoFocus
                />
              </Field>
              <Field label="Type" htmlFor="account-type" required>
                <Select
                  id="account-type"
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as AccountType }))}
                >
                  {TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Name" htmlFor="account-name" required error={errors.name}>
              <Input
                id="account-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Utilities"
              />
            </Field>
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="Parent account" htmlFor="account-parent" hint="Optional grouping account.">
                <Select
                  id="account-parent"
                  value={form.parentId}
                  onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}
                >
                  <option value="">No parent</option>
                  {parents.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.code} · {entry.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Opening balance"
                htmlFor="account-opening"
                error={errors.openingBalance}
                hint="Debit-nature accounts add to debits; liabilities, equity and revenue add to credits."
              >
                <Input
                  id="account-opening"
                  value={form.openingBalance}
                  onChange={(event) => setForm((current) => ({ ...current, openingBalance: event.target.value }))}
                  inputMode="numeric"
                />
              </Field>
            </div>
            <Field label="Description" htmlFor="account-description">
              <Textarea
                id="account-description"
                rows={2}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="What this account is used for"
              />
            </Field>
            <Switch
              label="Active"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
          </form>
        )}
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete this account?"
        description={
          <>
            <b>
              {account?.code} {account?.name}
            </b>{" "}
            will be removed. Accounts with journal lines or child accounts cannot be deleted.
          </>
        }
        confirmLabel="Delete account"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
