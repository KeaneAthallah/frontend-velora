"use client";

// Opt out of instant-navigation validation: this page renders data-dependent client UI.
export const instant = false;

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  MapPin,
  Phone,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Textarea,
  initials,
} from "@/components/ui/primitives";
import { DataTable, Pagination, TablePagination, type Column } from "@/components/ui/table";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

import {
  createCustomer,
  deleteCustomer,
  getCustomerProfile,
  listCustomers,
  updateCustomer,
  type CustomerInput,
} from "@/lib/api/customers";
import { adjustLoyaltyPoints } from "@/lib/api/loyalty";
import type { Customer, CustomerProfile, LoyaltyTransaction } from "@/lib/api/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatting/currency";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useDebouncedValue, useSearchParamState, replaceSearchParam } from "@/lib/use-debounced";

const PAGE_SIZE = 50;

export default function CustomersPage() {
  const { has } = usePermissions();
  const [search, setSearch, searchReady] = useSearchParamState("q");
  const [page, setPage] = React.useState(1);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Customer | null>(null);
  const debounced = useDebouncedValue(search, 300);

  React.useEffect(() => {
    if (!searchReady) return;
    replaceSearchParam("q", debounced.trim());
  }, [debounced, searchReady]);

  React.useEffect(() => {
    setPage(1);
  }, [debounced]);

  const query = useQuery({
    queryKey: ["customers", debounced, page],
    queryFn: () => listCustomers({ search: debounced.trim() || undefined, page, pageSize: PAGE_SIZE }),
    enabled: has("customers.view"),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  if (!has("customers.view")) {
    return <AccessDenied permission="customers.view" />;
  }

  const canManage = has("customers.manage");
  const rows = query.data?.data ?? [];
  const activeFilters = Boolean(debounced.trim());

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openCustomer = (customer: Customer) => {
    setEditing(customer);
    setEditorOpen(true);
  };

  const columns: Column<Customer>[] = [
    {
      id: "customer",
      header: "Customer",
      cell: (row) => (
        <div className="row" style={{ gap: 9 }}>
          <span className="avatar" aria-hidden="true">
            {initials(row.name)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{row.name}</div>
            <div className="hint">{row.loyaltyNumber || "No loyalty number"}</div>
          </div>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (row) => (
        <div className="stack-sm" style={{ gap: 2 }}>
          {row.phone ? (
            <span className="row row-tight" style={{ gap: 5 }}>
              <Phone aria-hidden="true" style={{ width: 11, height: 11 }} />
              {row.phone}
            </span>
          ) : null}
          {row.email ? (
            <span className="hint row row-tight" style={{ gap: 5, margin: 0 }}>
              <Mail aria-hidden="true" style={{ width: 11, height: 11 }} />
              {row.email}
            </span>
          ) : !row.phone && !row.email ? (
            <span className="hint">No contact details</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "address",
      header: "Address",
      cell: (row) => (
        <span className="cell-muted" style={{ display: "block", maxWidth: 260 }}>
          {row.address || "—"}
        </span>
      ),
    },
    {
      id: "points",
      header: "Loyalty",
      align: "right",
      cell: (row) => (
        <div className="stack-sm" style={{ gap: 3, alignItems: "flex-end" }}>
          <Badge tone={row.loyaltyPoints > 0 ? "brand" : "neutral"}>
            {formatNumber(row.loyaltyPoints)} points
          </Badge>
          {row.visitsCount ? (
            <span className="hint" style={{ margin: 0 }}>
              {formatNumber(row.visitsCount)} {row.visitsCount === 1 ? "visit" : "visits"}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "added",
      header: "Added",
      align: "right",
      cell: (row) => <span className="cell-muted">{formatDate(row.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Contact records and loyalty balances, linked to sales at checkout."
        actions={
          canManage ? (
            <Button variant="primary" onClick={openNew}>
              <UserPlus aria-hidden="true" /> New customer
            </Button>
          ) : null
        }
      />

      <Card>
        <div className="toolbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <label className="toolbar__search input-affix">
            <Search aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone, email, or loyalty number"
              aria-label="Search customers"
            />
            {search ? (
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <div className="spacer" />
          <span className="hint" style={{ margin: 0, whiteSpace: "nowrap" }}>
            {query.data ? `${formatNumber(query.data.total)} customers` : "—"}
          </span>
          {activeFilters ? (
            <Button variant="quiet" size="sm" onClick={() => setSearch("")}>
              Clear
            </Button>
          ) : null}
        </div>

        {query.isError ? (
          <InlineError
            title="Customers could not be loaded"
            error={query.error}
            onRetry={() => query.refetch()}
          />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowId={(row) => row.id}
            loading={query.isLoading && !query.data}
            onRowClick={openCustomer}
            dense
            minWidth={720}
            empty={
              <EmptyState
                icon={<Users aria-hidden="true" />}
                title={activeFilters ? "No customers match that search" : "No customers yet"}
                description={
                  activeFilters
                    ? "Try a different search term or clear the filter."
                    : "Add a customer to attach their details to checkout and track loyalty."
                }
                actions={
                  activeFilters ? (
                    <Button variant="secondary" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  ) : canManage ? (
                    <Button variant="primary" onClick={openNew}>
                      <UserPlus aria-hidden="true" /> Add first customer
                    </Button>
                  ) : null
                }
              />
            }
            mobile={(row) => (
              <button
                type="button"
                className="record"
                onClick={() => openCustomer(row)}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: 0 }}
              >
                <div className="record__top">
                  <div className="row" style={{ minWidth: 0, gap: 10 }}>
                    <span className="avatar" aria-hidden="true">
                      {initials(row.name)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="record__title">{row.name}</div>
                      <div className="record__meta">
                        {row.loyaltyNumber ? `${row.loyaltyNumber} · ` : ""}
                        {row.phone || row.email || "No contact"}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <Badge tone={row.loyaltyPoints > 0 ? "brand" : "neutral"}>
                      {formatNumber(row.loyaltyPoints)} pts
                    </Badge>
                  </div>
                </div>
              </button>
            )}
            footer={
              query.data && query.data.total > 0 ? (
                <TablePagination>
                  <Pagination
                    page={page}
                    totalPages={query.data.totalPages}
                    total={query.data.total}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                    label="customers"
                  />
                </TablePagination>
              ) : null
            }
          />
        )}
      </Card>

      <CustomerEditor
        open={editorOpen}
        customer={editing}
        canManage={canManage}
        onClose={() => setEditorOpen(false)}
        onSaved={() => setEditorOpen(false)}
      />
    </>
  );
}

function CustomerEditor({
  open,
  customer,
  canManage,
  onClose,
  onSaved,
}: {
  open: boolean;
  customer: Customer | null;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [form, setForm] = React.useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    loyaltyNumber: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const profileQuery = useQuery({
    queryKey: ["customer-profile", customer?.id],
    queryFn: () => getCustomerProfile(customer!.id),
    enabled: open && Boolean(customer),
    staleTime: 15_000,
  });

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      customer
        ? {
            name: customer.name,
            phone: customer.phone,
            email: customer.email ?? "",
            address: customer.address ?? "",
            loyaltyNumber: customer.loyaltyNumber ?? "",
          }
        : { name: "", phone: "", email: "", address: "", loyaltyNumber: "" }
    );
  }, [open, customer]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["pos-customers"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const next: Record<string, string> = {};
      if (!form.name.trim()) next.name = "Enter the customer's name.";
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        next.email = "Enter a valid email address or leave it blank.";
      }
      if (form.phone.trim().length > 32) next.phone = "Phone numbers can be at most 32 characters.";
      setErrors(next);
      if (Object.keys(next).length) throw new Error("Check the highlighted fields");

      const input: CustomerInput = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        loyaltyNumber: form.loyaltyNumber.trim() || undefined,
      };
      if (customer) return updateCustomer(customer.id, input);
      return createCustomer(input);
    },
    onSuccess: (saved) => {
      push({
        title: customer ? "Customer updated" : "Customer added",
        description: `${saved.name} is now available at checkout.`,
        variant: "success",
      });
      invalidate();
      onSaved();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Check the highlighted fields") return;
      setErrors((current) => ({
        ...current,
        form: error instanceof Error ? error.message : "The customer could not be saved.",
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCustomer(customer!.id),
    onSuccess: () => {
      push({ title: "Customer deleted", description: `${customer?.name} was removed.`, variant: "success" });
      invalidate();
      setDeleteOpen(false);
      onSaved();
    },
    onError: (error) => {
      setErrors((current) => ({
        ...current,
        form:
          error instanceof Error
            ? error.message
            : "This customer could not be deleted. They may be linked to recorded sales.",
      }));
      setDeleteOpen(false);
    },
  });

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={canManage ? (customer ? "Edit customer" : "New customer") : customer?.name ?? "Customer"}
        description={
          customer
            ? `${formatNumber(customer.loyaltyPoints)} loyalty points · added ${formatDate(customer.createdAt)}`
            : "Create a contact record for checkout and loyalty."
        }
        width={500}
        footer={
          canManage ? (
            <>
              {customer ? (
                <Button
                  variant="danger-quiet"
                  onClick={() => setDeleteOpen(true)}
                  disabled={saveMutation.isPending}
                >
                  <Trash2 aria-hidden="true" /> Delete
                </Button>
              ) : null}
              <Button variant="ghost" onClick={onClose} disabled={saveMutation.isPending} style={{ marginLeft: customer ? 0 : "auto" }}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="customer-editor"
                variant="primary"
                loading={saveMutation.isPending}
              >
                {customer ? "Save changes" : "Create customer"}
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
          <div className="stack" style={{ padding: 20 }}>
            <div className="row" style={{ gap: 14 }}>
              <span
                className="avatar"
                style={{ width: 46, height: 46, fontSize: 16 }}
                aria-hidden="true"
              >
                {customer ? initials(customer.name) : "?"}
              </span>
              <div>
                <h2 style={{ fontSize: 18, margin: 0, fontWeight: 600 }}>{customer?.name}</h2>
                <p className="hint" style={{ margin: 0 }}>
                  {customer?.loyaltyNumber || "No loyalty number"}
                </p>
              </div>
            </div>
            <div className="stack-sm">
              <div className="row" style={{ gap: 8 }}>
                <Phone className="hint" style={{ width: 14, height: 14 }} aria-hidden="true" />
                <span>{customer?.phone || "No phone number"}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Mail className="hint" style={{ width: 14, height: 14 }} aria-hidden="true" />
                <span>{customer?.email || "No email address"}</span>
              </div>
              <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                <MapPin className="hint" style={{ width: 14, height: 14, marginTop: 2 }} aria-hidden="true" />
                <span>{customer?.address || "No address on file"}</span>
              </div>
            </div>
            {customer ? <CustomerLoyaltyCard customer={customer} profile={profileQuery.data} /> : null}
            <p className="hint" style={{ marginTop: 8 }}>
              Your role can view customer records but not edit them.
            </p>
          </div>
        ) : (
          <form
            id="customer-editor"
            className="stack"
            style={{ padding: 20 }}
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            {errors.form ? (
              <div className="alert alert--danger">{errors.form}</div>
            ) : null}
            <Field label="Full name" htmlFor="customer-name" required error={errors.name}>
              <Input
                id="customer-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Customer name"
                autoFocus
              />
            </Field>
            <div className="row wrap" style={{ gap: 12 }}>
              <div className="grow">
                <Field label="Phone" htmlFor="customer-phone" error={errors.phone}>
                  <Input
                    id="customer-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="+62 812 3456 7890"
                  />
                </Field>
              </div>
              <div className="grow">
                <Field label="Email" htmlFor="customer-email" error={errors.email}>
                  <Input
                    id="customer-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="name@example.com"
                  />
                </Field>
              </div>
            </div>
            <Field label="Address" htmlFor="customer-address">
              <Textarea
                id="customer-address"
                rows={2}
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="Street, city, postal code"
              />
            </Field>
            <Field
              label="Loyalty number"
              htmlFor="customer-loyalty"
              hint="Optional. Existing membership or loyalty identifier, if one is used."
            >
              <Input
                id="customer-loyalty"
                value={form.loyaltyNumber}
                onChange={(event) => setForm((current) => ({ ...current, loyaltyNumber: event.target.value }))}
                placeholder="VLR-0000000"
                disabled={Boolean(customer)}
                className="mono"
              />
            </Field>
            {customer ? <CustomerLoyaltyCard customer={customer} profile={profileQuery.data} /> : null}
          </form>
        )}
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete this customer?"
        description={
          <>
            <b>{customer?.name}</b> will be removed from customer search and checkout. Sales history keeps its own receipt record. Customers linked to sales may not be deletable.
          </>
        }
        confirmLabel="Delete customer"
        loading={deleteMutation.isPending}
      />
    </>
  );
}

const LEDGER_LABEL: Record<LoyaltyTransaction["type"], string> = {
  earn: "Earned",
  redeem: "Redeemed",
  adjust: "Adjustment",
  reverse: "Reversal",
};

function CustomerLoyaltyCard({ customer, profile }: { customer: Customer; profile?: CustomerProfile }) {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const currency = session?.business.currency ?? "IDR";
  const [points, setPoints] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const canAdjust = has("loyalty.manage");

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const value = Number(points);
      if (!points.trim() || !Number.isFinite(value) || value === 0) {
        throw new Error("Enter a non-zero points adjustment");
      }
      return adjustLoyaltyPoints(customer.id, value, reason.trim() || "Manual adjustment");
    },
    onSuccess: (updated) => {
      push({
        title: "Points adjusted",
        description: `${updated.name} now has ${formatNumber(updated.loyaltyPoints)} points.`,
        variant: "success",
      });
      setPoints("");
      setReason("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      void queryClient.invalidateQueries({ queryKey: ["customer-profile", customer.id] });
      void queryClient.invalidateQueries({ queryKey: ["pos-customers"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "The points could not be adjusted.");
    },
  });

  const ledger = profile?.loyaltyTransactions ?? [];

  return (
    <div
      style={{
        padding: 16,
        background: "hsl(var(--surface-2))",
        borderRadius: 8,
        border: "1px solid hsl(var(--border))",
      }}
    >
      <div className="between">
        <span className="hint">Loyalty balance</span>
        <Badge tone={customer.loyaltyPoints > 0 ? "brand" : "neutral"}>
          {formatNumber(customer.loyaltyPoints)} points
        </Badge>
      </div>
      <div className="between" style={{ marginTop: 6 }}>
        <span className="hint">Lifetime spend</span>
        <b className="num">{formatCurrency(customer.totalSpent ?? 0, currency)}</b>
      </div>
      <div className="between" style={{ marginTop: 4 }}>
        <span className="hint">Visits</span>
        <b className="num">{formatNumber(customer.visitsCount ?? 0)}</b>
      </div>
      <div className="between" style={{ marginTop: 4 }}>
        <span className="hint">Promotions used</span>
        <b className="num">{formatNumber(profile?.promotionsUsed ?? 0)}</b>
      </div>

      {ledger.length ? (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed hsl(var(--border))" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Recent points
          </div>
          <div className="stack-sm" style={{ gap: 4 }}>
            {ledger.slice(0, 5).map((entry) => (
              <div key={entry.id} className="between" style={{ fontSize: 12 }}>
                <span className="hint">
                  {LEDGER_LABEL[entry.type] ?? entry.type} · {formatDate(entry.createdAt)}
                </span>
                <b className="num" style={{ color: entry.points < 0 ? "hsl(var(--danger))" : undefined }}>
                  {entry.points > 0 ? "+" : ""}
                  {formatNumber(entry.points)}
                </b>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {canAdjust ? (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed hsl(var(--border))" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Adjust points
          </div>
          {error ? <div className="alert alert--warning" style={{ marginBottom: 8 }}>{error}</div> : null}
          <div className="row" style={{ gap: 6 }}>
            <Input
              value={points}
              onChange={(event) => setPoints(event.target.value.replace(/[^\d.-]/g, ""))}
              placeholder="+50 or -20"
              aria-label="Points adjustment"
              inputMode="decimal"
              style={{ maxWidth: 110 }}
            />
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason"
              aria-label="Reason for the adjustment"
            />
            <Button
              variant="secondary"
              size="sm"
              loading={adjustMutation.isPending}
              disabled={!points.trim()}
              onClick={() => adjustMutation.mutate()}
            >
              Apply
            </Button>
          </div>
          <p className="hint" style={{ margin: "6px 0 0" }}>
            Points are otherwise earned and spent automatically when a sale is completed.
          </p>
        </div>
      ) : (
        <p className="hint" style={{ marginTop: 8, fontSize: 12 }}>
          Points are earned by the loyalty system; they are not edited here.
        </p>
      )}
    </div>
  );
}
