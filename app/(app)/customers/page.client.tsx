"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  MapPin,
  Phone,
  Search,
  Store,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Button, EmptyState, Input, Spinner } from "@/components/ui/primitives";
import { DataTable, Pagination, TablePagination, type Column } from "@/components/ui/table";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  updateCustomer,
  type CustomerInput,
} from "@/lib/api/customers";
import type { Customer } from "@/lib/api/types";
import { formatDate, formatNumber } from "@/lib/formatting/currency";
import { initials } from "@/components/ui/primitives";
import { usePermissions } from "@/lib/auth/auth-context";
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
        <Badge tone={row.loyaltyPoints > 0 ? "brand" : "neutral"}>
          {formatNumber(row.loyaltyPoints)} points
        </Badge>
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
      <div className="bg-white rounded-lg shadow">
        <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-4">
            <label className="flex-1">
              <div className="input-affix" style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search aria-hidden="true" style={{ position: "absolute", left: 11, width: 15, height: 15, color: "var(--ink-3)", pointerEvents: "none" }} />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, phone, email, or loyalty number"
                  aria-label="Search customers"
                  style={{ paddingLeft: 34 }}
                />
                {search && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}
                  >
                    <X aria-hidden="true" />
                  </button>
                )}
              </div>
            </label>
            <span className="text-gray-500 text-sm" style={{ margin: 0, whiteSpace: "nowrap" }}>
              {query.data ? `${formatNumber(query.data.total)} customers` : "—"}
            </span>
            {activeFilters && (
              <Button variant="quiet" size="sm" onClick={() => setSearch("")}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {query.isError ? (
          <InlineError
            title="Customers could not be loaded"
            error={query.error}
            onRetry={() => query.refetch()}
          />
        ) : query.isLoading && !query.data ? (
          <div className="p-8 text-center text-gray-500">
            <Spinner size={16} />
            <p style={{ margin: "8px 0 0" }}>Loading customers...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Address
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loyalty
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => openCustomer(row)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <span className="avatar" aria-hidden="true">
                          {initials(row.name)}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{row.name}</div>
                          <div className="text-gray-500 text-sm">{row.loyaltyNumber || "No loyalty number"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-500 text-sm">
                        {row.phone && (
                          <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
                            <Phone aria-hidden="true" style={{ width: 12, height: 12 }} />
                            {row.phone}
                          </div>
                        )}
                        {row.email && (
                          <div className="flex items-center gap-2">
                            <Mail aria-hidden="true" style={{ width: 12, height: 12 }} />
                            {row.email}
                          </div>
                        )}
                        {!row.phone && !row.email && <span className="text-gray-400">No contact details</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm max-w-xs truncate">
                      {row.address || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Badge tone={row.loyaltyPoints > 0 ? "brand" : "neutral"} style={{ marginLeft: "auto" }}>
                        {formatNumber(row.loyaltyPoints)} points
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-500 text-sm">
                      {formatDate(row.createdAt)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <Users className="w-10 h-10 text-gray-400 mb-2" />
                        <p className="text-sm font-medium">
                          {activeFilters ? "No customers match that search" : "No customers yet"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {activeFilters ? "Try a different search" : "Add a customer to get started"}
                        </p>
                        {canManage && !activeFilters && (
                          <Button variant="primary" onClick={openNew} className="mt-3">
                            Add first customer
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--canvas)" }}>
            <span className="text-xs text-gray-500">
              Showing up to {PAGE_SIZE} records per page
            </span>              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{query.data?.totalPages ? `Page ${page} of ${query.data.totalPages}` : `Page ${page}`}</span>
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                First
              </button>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">
                Page {page} of {query.data?.totalPages ?? 1}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={query.data?.totalPages !== undefined ? query.data!.totalPages <= page : true}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Next
              </button>
              <button
                onClick={() => setPage(query.data?.totalPages ?? page)}
                disabled={query.data?.totalPages !== undefined ? query.data!.totalPages <= page : true}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="max-w-2xl mx-auto">
          <EmptyState
            icon={<Store className="w-8 h-8 text-gray-400" />}
            title="No customers yet"
            description="Add a customer to attach their details to future sales and track loyalty."
            actions={
              <Button variant="primary" onClick={openNew} className="w-full">
                Add first customer
              </Button>
            }
          />
        </div>
      </div>

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
            ? `${formatNumber(customer.loyaltyPoints)} loyalty points &middot; added ${formatDate(customer.createdAt)}`
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
          <div style={{ padding: 20 }}>
            <div className="flex items-center gap-4" style={{ marginBottom: 16 }}>
              <span
                className="avatar"
                style={{ width: 46, height: 46, fontSize: 16 }}
                aria-hidden="true"
              >
                {customer ? initials(customer.name) : "?"}
              </span>
              <div>
                <h2 style={{ fontSize: 18, margin: 0 }}>{customer?.name}</h2>
                <p className="text-gray-500 text-sm" style={{ margin: 0 }}>
                  {customer?.loyaltyNumber || "No loyalty number"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">{customer?.phone || "No phone number"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">{customer?.email || "No email address"}</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <span className="text-gray-700">{customer?.address || "No address on file"}</span>
              </div>
            </div>
            <div className="mt-6 p-4" style={{ background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm">Loyalty points</span>
                <b className="num">{formatNumber(customer?.loyaltyPoints ?? 0)}</b>
              </div>
            </div>
            <p className="text-gray-500 text-sm mt-4">
              Your role can view customer records but not edit them.
            </p>
          </div>
        ) : (
          <form
            id="customer-editor"
            className="space-y-4"
            style={{ padding: 20 }}
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            {errors.form && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded">
                {errors.form}
              </div>
            )}
            <div>
              <label htmlFor="customer-name" className="block text-sm font-medium text-gray-700 mb-1">
                Full name <span className="text-red-500">*</span>
              </label>
              <Input
                id="customer-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Customer name"
                autoFocus
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="customer-phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <Input
                  id="customer-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+62 812 3456 7890"
                  className={errors.phone ? "border-red-500" : ""}
                />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label htmlFor="customer-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input
                  id="customer-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="name@example.com"
                  className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="customer-address" className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                id="customer-address"
                rows={2}
                value={form.address}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="Street, city, postal code"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="customer-loyalty" className="block text-sm font-medium text-gray-700 mb-1">
                Loyalty number
              </label>
              <Input
                id="customer-loyalty"
                value={form.loyaltyNumber}
                onChange={(event) => setForm((current) => ({ ...current, loyaltyNumber: event.target.value }))}
                placeholder="VLR-0000000"
                disabled={Boolean(customer)}
                className="mono"
              />
              <p className="text-xs text-gray-500 mt-1">Optional. Existing membership or loyalty identifier, if one is used.</p>
            </div>
            {customer && (
              <div className="p-4" style={{ background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Loyalty points</span>
                  <Badge tone={customer.loyaltyPoints > 0 ? "brand" : "neutral"}>
                    {formatNumber(customer.loyaltyPoints)}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Points are earned by the loyalty system; they are not edited here.
                </p>
              </div>
            )}
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