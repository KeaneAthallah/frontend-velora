"use client";

// Opt out of instant-navigation validation: these pages render data-dependent client UI.
export const instant = false;


import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MapPin, Phone, Plus, Search, Trash2, Truck, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, Button, EmptyState, Field, Input, Textarea } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
  type SupplierInput,
} from "@/lib/api/purchasing";
import type { Supplier } from "@/lib/api/types";
import { initials } from "@/components/ui/primitives";
import { usePermissions } from "@/lib/auth/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced";

export default function SuppliersPage() {
  const { has } = usePermissions();
  const [search, setSearch] = React.useState("");
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Supplier | null>(null);
  const debounced = useDebouncedValue(search, 250);

  const query = useQuery({
    queryKey: ["suppliers", debounced],
    queryFn: () => listSuppliers(debounced.trim() || undefined),
    enabled: has("suppliers.view"),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  if (!has("suppliers.view")) {
    return <AccessDenied permission="suppliers.view" />;
  }

  const canManage = has("suppliers.manage");
  const rows = query.data ?? [];
  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openSupplier = (supplier: Supplier) => {
    setEditing(supplier);
    setEditorOpen(true);
  };

  const columns: Column<Supplier>[] = [
    {
      id: "supplier",
      header: "Supplier",
      cell: (row) => (
        <div className="row" style={{ gap: 9 }}>
          <span className="avatar" aria-hidden="true">
            {initials(row.name)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{row.name}</div>
            <div className="hint">{row.contact || "No contact person"}</div>
          </div>
        </div>
      ),
    },
    {
      id: "email",
      header: "Email",
      cell: (row) => <span className="cell-muted">{row.email || "—"}</span>,
    },
    {
      id: "phone",
      header: "Phone",
      cell: (row) => <span className="cell-muted">{row.phone || "—"}</span>,
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
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            cell: (row: Supplier) => (
              <Button
                variant="quiet"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openSupplier(row);
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
        title="Suppliers"
        description="The businesses you buy stock from, linked to purchase orders and receiving."
        actions={
          <>
            {has("purchasing.view") ? (
              <Link href="/purchasing" className="btn btn--secondary">
                <Truck aria-hidden="true" />
                Purchase orders
              </Link>
            ) : null}
            {canManage ? (
              <Button variant="primary" onClick={openNew}>
                <Plus aria-hidden="true" />
                New supplier
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="toolbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <label className="toolbar__search input-affix">
            <Search aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, contact, or email"
              aria-label="Search suppliers"
            />
            {search ? (
              <button type="button" className="icon-btn" onClick={() => setSearch("")} aria-label="Clear search">
                <X aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <div className="spacer" />
          <span className="hint" style={{ margin: 0 }}>
            {query.isLoading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "supplier" : "suppliers"}`}
          </span>
        </div>

        {query.isError ? (
          <InlineError title="Suppliers could not be loaded" error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowId={(row) => row.id}
            loading={query.isLoading}
            onRowClick={canManage ? openSupplier : undefined}
            minWidth={640}
            empty={
              <EmptyState
                icon={<Truck aria-hidden="true" />}
                title={debounced ? "No suppliers match that search" : "No suppliers yet"}
                description={
                  debounced
                    ? "Try a partial name, contact, or email address."
                    : "Add a supplier before creating a purchase order."
                }
                actions={
                  debounced ? (
                    <Button variant="secondary" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  ) : canManage ? (
                    <Button variant="primary" onClick={openNew}>
                      Add first supplier
                    </Button>
                  ) : (
                    <span className="hint">Ask a manager to add supplier records.</span>
                  )
                }
              />
            }
            mobile={(row) => (
              <button
                type="button"
                className="record"
                onClick={() => openSupplier(row)}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: 0 }}
                disabled={!canManage}
              >
                <div className="record__top">
                  <div className="row" style={{ minWidth: 0 }}>
                    <span className="avatar" aria-hidden="true">
                      {initials(row.name)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="record__title">{row.name}</div>
                      <div className="record__meta">{row.contact || "No contact person"}</div>
                      <div className="record__meta">{row.email || row.phone || "No contact details"}</div>
                    </div>
                  </div>
                </div>
              </button>
            )}
          />
        )}
        <div className="hint" style={{ padding: "0 16px 12px" }}>
          Showing up to 50 supplier records. Search is applied to this list.
        </div>
      </Card>

      <SupplierEditor
        open={editorOpen}
        supplier={editing}
        canManage={canManage}
        onClose={() => setEditorOpen(false)}
        onSaved={() => setEditorOpen(false)}
      />
    </>
  );
}

function SupplierEditor({
  open,
  supplier,
  canManage,
  onClose,
  onSaved,
}: {
  open: boolean;
  supplier: Supplier | null;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [form, setForm] = React.useState({
    name: "",
    contact: "",
    email: "",
    phone: "",
    address: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      supplier
        ? {
            name: supplier.name,
            contact: supplier.contact,
            email: supplier.email,
            phone: supplier.phone,
            address: supplier.address ?? "",
          }
        : { name: "", contact: "", email: "", phone: "", address: "" }
    );
  }, [open, supplier]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const next: Record<string, string> = {};
      if (!form.name.trim()) next.name = "Enter the supplier's name.";
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        next.email = "Enter a valid email address or leave it blank.";
      }
      if (form.phone.trim().length > 32) next.phone = "Phone numbers can be at most 32 characters.";
      setErrors(next);
      if (Object.keys(next).length) throw new Error("Check the highlighted fields");

      const input: SupplierInput = {
        name: form.name.trim(),
        contact: form.contact.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      };
      if (supplier) return updateSupplier(supplier.id, input);
      return createSupplier(input);
    },
    onSuccess: (saved) => {
      push({
        title: supplier ? "Supplier updated" : "Supplier added",
        description: `${saved.name} is available for purchase orders.`,
        variant: "success",
      });
      invalidate();
      onSaved();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Check the highlighted fields") return;
      setErrors((current) => ({
        ...current,
        form: error instanceof Error ? error.message : "The supplier could not be saved.",
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSupplier(supplier!.id),
    onSuccess: () => {
      push({ title: "Supplier deleted", description: `${supplier?.name} was removed.`, variant: "success" });
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
            : "This supplier could not be deleted. They may be linked to purchase orders.",
      }));
      setDeleteOpen(false);
    },
  });

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={canManage ? (supplier ? "Edit supplier" : "New supplier") : supplier?.name ?? "Supplier"}
        description={
          supplier ? "Update contact details used on purchase orders." : "Add a business you purchase stock from."
        }
        width={500}
        footer={
          canManage ? (
            <>
              {supplier ? (
                <Button variant="danger-quiet" onClick={() => setDeleteOpen(true)} disabled={saveMutation.isPending}>
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
              ) : null}
              <Button variant="ghost" onClick={onClose} disabled={saveMutation.isPending} style={{ marginLeft: supplier ? 0 : "auto" }}>
                Cancel
              </Button>
              <Button type="submit" form="supplier-editor" variant="primary" loading={saveMutation.isPending}>
                {supplier ? "Save changes" : "Create supplier"}
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
          <div className="stack" style={{ gap: 16 }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="avatar" style={{ width: 46, height: 46, fontSize: 16 }} aria-hidden="true">
                {supplier ? initials(supplier.name) : "?"}
              </span>
              <div>
                <h2 style={{ fontSize: 18 }}>{supplier?.name}</h2>
                <p className="hint" style={{ margin: 0 }}>
                  {supplier?.contact || "No contact person"}
                </p>
              </div>
            </div>
            <div className="stack-sm">
              <div className="row row-tight">
                <Phone aria-hidden="true" style={{ width: 14, height: 14 }} />
                <span>{supplier?.phone || "No phone number"}</span>
              </div>
              <div className="row row-tight">
                <Mail aria-hidden="true" style={{ width: 14, height: 14 }} />
                <span>{supplier?.email || "No email address"}</span>
              </div>
              <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                <MapPin aria-hidden="true" style={{ width: 14, height: 14, marginTop: 2 }} />
                <span>{supplier?.address || "No address on file"}</span>
              </div>
            </div>
            <Badge tone="neutral">Read-only</Badge>
          </div>
        ) : (
          <form
            id="supplier-editor"
            className="stack"
            style={{ gap: 15 }}
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
            <Field label="Supplier name" htmlFor="supplier-name" required error={errors.name}>
              <Input
                id="supplier-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Supplier or distributor name"
                autoFocus
              />
            </Field>
            <Field label="Contact person" htmlFor="supplier-contact">
              <Input
                id="supplier-contact"
                value={form.contact}
                onChange={(event) => setForm((current) => ({ ...current, contact: event.target.value }))}
                placeholder="Name of your account contact"
              />
            </Field>
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="Email" htmlFor="supplier-email" error={errors.email}>
                <Input
                  id="supplier-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="orders@supplier.com"
                />
              </Field>
              <Field label="Phone" htmlFor="supplier-phone" error={errors.phone}>
                <Input
                  id="supplier-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+62 812 3456 7890"
                />
              </Field>
            </div>
            <Field label="Address" htmlFor="supplier-address">
              <Textarea
                id="supplier-address"
                rows={2}
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="Street, city, postal code"
              />
            </Field>
          </form>
        )}
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete this supplier?"
        description={
          <>
            <b>{supplier?.name}</b> will be removed from supplier search and purchase order creation. Purchase
            orders that already reference this supplier may prevent deletion.
          </>
        }
        confirmLabel="Delete supplier"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
