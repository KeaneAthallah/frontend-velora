"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Button, EmptyState, Field, Input, Select, Spinner, Switch } from "@/components/ui/primitives";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

import {
  createPromotion,
  deletePromotion,
  listPromotions,
  updatePromotion,
} from "@/lib/api/promotions";
import type { Promotion, PromotionInput, PromotionType } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/formatting/currency";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced";

export const instant = false;

const EMPTY_FORM = {
  name: "",
  code: "",
  description: "",
  type: "percentage" as PromotionType,
  value: "",
  minSpend: "",
  maxDiscount: "",
  usageLimit: "",
  perCustomerLimit: "",
  startsAt: "",
  endsAt: "",
  active: true,
};

function toLocalInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function promotionStatus(promotion: Promotion) {
  const now = Date.now();
  if (!promotion.active) return { label: "Inactive", tone: "neutral" as const };
  if (promotion.startsAt && new Date(promotion.startsAt).getTime() > now) {
    return { label: "Scheduled", tone: "info" as const };
  }
  if (promotion.endsAt && new Date(promotion.endsAt).getTime() < now) {
    return { label: "Expired", tone: "warning" as const };
  }
  if (promotion.usageLimit != null && promotion.usageCount >= promotion.usageLimit) {
    return { label: "Used up", tone: "warning" as const };
  }
  return { label: "Live", tone: "success" as const };
}

export default function PromotionsPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const currency = session?.business.currency ?? "IDR";
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 250);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Promotion | null>(null);

  const query = useQuery({
    queryKey: ["promotions", debounced],
    queryFn: () => listPromotions({ search: debounced.trim() || undefined }),
    enabled: has("promotions.view"),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  if (!has("promotions.view")) {
    return <AccessDenied permission="promotions.view" />;
  }

  const canManage = has("promotions.manage");
  const promotions = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Promotions"
        description="Codes cashiers can apply at the register, and automatic offers the server picks for a qualifying cart."
        actions={
          canManage ? (
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <Plus aria-hidden="true" /> New promotion
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader className="card__head">
          <div>
            <h2>Active offers</h2>
            <p>
              One promotion applies per sale. Leave the code blank to apply the best qualifying offer automatically;
              the POS shows the discount before the cashier charges.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <div style={{ padding: 16 }}>
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                <Search
                  aria-hidden="true"
                  style={{ position: "absolute", left: 11, width: 15, height: 15, color: "var(--ink-3)", pointerEvents: "none" }}
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or code"
                  aria-label="Search promotions"
                  style={{ paddingLeft: 34 }}
                />
                {search ? (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    style={{ position: "absolute", right: 8 }}
                  >
                    <X aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

            {query.isError ? (
              <InlineError
                title="Promotions could not be loaded"
                error={query.error}
                onRetry={() => query.refetch()}
              />
            ) : query.isLoading && !query.data ? (
              <div style={{ padding: 24, textAlign: "center" }}>
                <Spinner size={16} />
              </div>
            ) : promotions.length === 0 ? (
              <EmptyState
                icon={<Tag aria-hidden="true" />}
                title={debounced ? "No promotions match that search" : "No promotions yet"}
                description={
                  debounced
                    ? "Try a different name or code."
                    : "Create a code for a campaign, or an automatic offer for quiet hours."
                }
                actions={
                  canManage ? (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setEditing(null);
                        setEditorOpen(true);
                      }}
                    >
                      Create a promotion
                    </Button>
                  ) : null
                }
              />
            ) : (
              <div className="setting-list">
                {promotions.map((promotion) => {
                  const status = promotionStatus(promotion);
                  const discountLabel =
                    promotion.type === "percentage"
                      ? `${formatNumber(promotion.value, "en-GB")}%`
                      : formatCurrency(promotion.value, currency);
                  return (
                    <div className="setting-row" key={promotion.id}>
                      <span className="setting-row__icon" aria-hidden="true">
                        <Tag />
                      </span>
                      <div className="setting-row__body">
                        <div className="row row-tight wrap">
                          <b>{promotion.name}</b>
                          <Badge tone={status.tone}>{status.label}</Badge>
                          {promotion.code ? (
                            <Badge tone="brand" className="mono">
                              {promotion.code}
                            </Badge>
                          ) : (
                            <Badge tone="info">Automatic</Badge>
                          )}
                        </div>
                        <div className="hint" style={{ marginTop: 4 }}>
                          {discountLabel} off
                          {promotion.minSpend ? ` · from ${formatCurrency(promotion.minSpend, currency)}` : ""}
                          {promotion.maxDiscount ? ` · capped at ${formatCurrency(promotion.maxDiscount, currency)}` : ""}
                          {` · used ${formatNumber(promotion.usageCount)}${
                            promotion.usageLimit ? `/${formatNumber(promotion.usageLimit)}` : ""
                          }`}
                        </div>
                      </div>
                      {canManage ? (
                        <Button
                          variant="quiet"
                          size="sm"
                          onClick={() => {
                            setEditing(promotion);
                            setEditorOpen(true);
                          }}
                        >
                          <Pencil aria-hidden="true" /> Edit
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <PromotionEditor open={editorOpen} promotion={editing} onClose={() => setEditorOpen(false)} />
    </>
  );
}

function PromotionEditor({
  open,
  promotion,
  onClose,
}: {
  open: boolean;
  promotion: Promotion | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const { session } = useAuth();
  const currency = session?.business.currency ?? "IDR";
  const [form, setForm] = React.useState({ ...EMPTY_FORM });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm(
      promotion
        ? {
            name: promotion.name,
            code: promotion.code ?? "",
            description: promotion.description ?? "",
            type: promotion.type,
            value: String(promotion.value),
            minSpend: promotion.minSpend != null ? String(promotion.minSpend) : "",
            maxDiscount: promotion.maxDiscount != null ? String(promotion.maxDiscount) : "",
            usageLimit: promotion.usageLimit != null ? String(promotion.usageLimit) : "",
            perCustomerLimit: promotion.perCustomerLimit != null ? String(promotion.perCustomerLimit) : "",
            startsAt: toLocalInput(promotion.startsAt),
            endsAt: toLocalInput(promotion.endsAt),
            active: promotion.active,
          }
        : { ...EMPTY_FORM }
    );
    setErrors({});
    setDeleteOpen(false);
  }, [open, promotion]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const next: Record<string, string> = {};
      const name = form.name.trim();
      const value = Number(form.value);

      if (!name) next.name = "Give the promotion a name.";
      if (!form.value.trim() || !Number.isFinite(value) || value < 0) {
        next.value = "Enter a discount amount.";
      } else if (form.type === "percentage" && value > 100) {
        next.value = "A percentage cannot be more than 100.";
      }
      if (form.startsAt && form.endsAt && new Date(form.endsAt) < new Date(form.startsAt)) {
        next.endsAt = "The end must be after the start.";
      }
      setErrors(next);
      if (Object.keys(next).length) throw new Error("Check the highlighted fields");

      const input: PromotionInput = {
        name,
        code: form.code.trim() ? form.code.trim().toUpperCase() : null,
        description: form.description.trim() || undefined,
        type: form.type,
        value,
        minSpend: form.minSpend.trim() ? Number(form.minSpend) : null,
        maxDiscount: form.maxDiscount.trim() ? Number(form.maxDiscount) : null,
        usageLimit: form.usageLimit.trim() ? Number(form.usageLimit) : null,
        perCustomerLimit: form.perCustomerLimit.trim() ? Number(form.perCustomerLimit) : null,
        startsAt: toIso(form.startsAt),
        endsAt: toIso(form.endsAt),
        active: form.active,
      };

      if (promotion) return updatePromotion(promotion.id, input);
      return createPromotion(input);
    },
    onSuccess: (saved) => {
      push({
        title: promotion ? "Promotion updated" : "Promotion created",
        description: saved.code ? `${saved.name} · ${saved.code}` : `${saved.name} applies automatically.`,
        variant: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["promotions"] });
      onClose();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Check the highlighted fields") return;
      setErrors((current) => ({
        ...current,
        form: error instanceof Error ? error.message : "The promotion could not be saved.",
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePromotion(promotion!.id),
    onSuccess: () => {
      push({ title: "Promotion deleted", description: promotion?.name, variant: "success" });
      void queryClient.invalidateQueries({ queryKey: ["promotions"] });
      setDeleteOpen(false);
      onClose();
    },
    onError: (error) => {
      setDeleteOpen(false);
      setErrors((current) => ({
        ...current,
        form: error instanceof Error ? error.message : "The promotion could not be deleted.",
      }));
    },
  });

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={promotion ? "Edit promotion" : "New promotion"}
        description="Cashiers apply the code at the register; automatic offers are chosen by the server."
        width={520}
        footer={
          <>
            {promotion ? (
              <Button variant="danger-quiet" onClick={() => setDeleteOpen(true)} disabled={saveMutation.isPending}>
                <Trash2 aria-hidden="true" /> Delete
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onClose} disabled={saveMutation.isPending} style={{ marginLeft: promotion ? 0 : "auto" }}>
              Cancel
            </Button>
            <Button type="submit" form="promotion-editor" variant="primary" loading={saveMutation.isPending}>
              {promotion ? "Save changes" : "Create promotion"}
            </Button>
          </>
        }
      >
        <form
          id="promotion-editor"
          className="stack"
          style={{ padding: 20, gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          {errors.form ? <div className="alert alert--warning">{errors.form}</div> : null}

          <Field label="Name" htmlFor="promotion-name" required error={errors.name}>
            <Input
              id="promotion-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Coffee o'clock"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Code" htmlFor="promotion-code" hint="Blank applies automatically.">
              <Input
                id="promotion-code"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                placeholder="HEMAT10"
                className="mono"
                autoComplete="off"
              />
            </Field>
            <Field label="Type" htmlFor="promotion-type">
              <Select
                id="promotion-type"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, type: event.target.value as PromotionType }))
                }
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={form.type === "percentage" ? "Percent off" : "Amount off"}
              htmlFor="promotion-value"
              required
              error={errors.value}
            >
              <Input
                id="promotion-value"
                inputMode="decimal"
                value={form.value}
                onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                placeholder={form.type === "percentage" ? "10" : "5000"}
              />
            </Field>
            <Field label="Minimum spend" htmlFor="promotion-min" hint="Optional">
              <Input
                id="promotion-min"
                inputMode="decimal"
                value={form.minSpend}
                onChange={(event) => setForm((current) => ({ ...current, minSpend: event.target.value }))}
                placeholder="0"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Maximum discount" htmlFor="promotion-max" hint={`Optional, in ${currency}`}>
              <Input
                id="promotion-max"
                inputMode="decimal"
                value={form.maxDiscount}
                onChange={(event) => setForm((current) => ({ ...current, maxDiscount: event.target.value }))}
                placeholder="25000"
              />
            </Field>
            <Field label="Usage limit" htmlFor="promotion-usage" hint="Total redemptions">
              <Input
                id="promotion-usage"
                inputMode="numeric"
                value={form.usageLimit}
                onChange={(event) => setForm((current) => ({ ...current, usageLimit: event.target.value }))}
                placeholder="Unlimited"
              />
            </Field>
          </div>

          <Field label="Per-customer limit" htmlFor="promotion-per-customer" hint="Needs a customer on the sale.">
            <Input
              id="promotion-per-customer"
              inputMode="numeric"
              value={form.perCustomerLimit}
              onChange={(event) => setForm((current) => ({ ...current, perCustomerLimit: event.target.value }))}
              placeholder="Unlimited"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts" htmlFor="promotion-start" hint="Optional">
              <Input
                id="promotion-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
              />
            </Field>
            <Field label="Ends" htmlFor="promotion-end" hint="Optional" error={errors.endsAt}>
              <Input
                id="promotion-end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
              />
            </Field>
          </div>

          <Field label="Description" htmlFor="promotion-description" hint="Shown to staff, not customers.">
            <textarea
              id="promotion-description"
              rows={2}
              value={form.description}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="10% off the whole order before 11am"
            />
          </Field>

          <label className="row between" style={{ gap: 12 }}>
            <span>
              <b style={{ fontSize: 13 }}>Active</b>
              <p className="hint" style={{ margin: "2px 0 0" }}>
                Inactive promotions are ignored at the register.
              </p>
            </span>
            <Switch
              checked={form.active}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              aria-label="Promotion is active"
            />
          </label>
        </form>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete this promotion?"
        description={
          <>
            <b>{promotion?.name}</b> can no longer be applied. Promotions that have already been redeemed cannot be
            deleted; deactivate them instead.
          </>
        }
        confirmLabel="Delete promotion"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
