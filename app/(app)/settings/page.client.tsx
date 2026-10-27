"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  InfoIcon,
  Pencil,
  Plus,
  QrCode,
  ReceiptText,
  Store,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/card";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Switch,
  Tabs,
  Textarea,
  Info
} from "@/components/ui/primitives";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError, SectionSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  createOutlet,
  getBusinessDetails,
  listPaymentMethods,
  updateBusiness,
  updateOutlet,
} from "@/lib/api/business";
import {
  createTaxRate,
  deleteTaxRate,
  listTaxRates,
  updateTaxRate,
} from "@/lib/api/tax";
import type { Outlet, PaymentMethod, TaxRate } from "@/lib/api/types";
import { formatNumber } from "@/lib/formatting/currency";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";
import {
  replaceSearchParam,
  useSearchParamState,
} from "@/lib/use-debounced";

type SectionId = "business" | "outlets" | "tax" | "payments";

const CURRENCIES = [
  ["IDR", "Indonesian rupiah"],
  ["USD", "US dollar"],
  ["EUR", "Euro"],
  ["SGD", "Singapore dollar"],
  ["MYR", "Malaysian ringgit"],
  ["GBP", "Pound sterling"],
  ["AUD", "Australian dollar"],
  ["JPY", "Japanese yen"],
  ["CNY", "Chinese yuan"],
  ["THB", "Thai baht"],
  ["PHP", "Philippine peso"],
  ["VND", "Vietnamese dong"],
  ["INR", "Indian rupee"],
] as const;

const TIMEZONES = [
  ["Asia/Jakarta", "Jakarta (WIB)"],
  ["Asia/Makassar", "Makassar (WITA)"],
  ["Asia/Jayapura", "Jayapura (WIT)"],
  ["Asia/Singapore", "Singapore"],
  ["Asia/Kuala_Lumpur", "Kuala Lumpur"],
  ["Asia/Bangkok", "Bangkok"],
  ["Asia/Manila", "Manila"],
  ["Asia/Tokyo", "Tokyo"],
  ["Asia/Shanghai", "Shanghai"],
  ["Asia/Ho_Chi_Minh", "Ho Chi Minh City"],
  ["Asia/Kolkata", "Kolkata"],
  ["UTC", "UTC"],
] as const;

export default function SettingsPage() {
  const { has } = usePermissions();
  const [initialSection, , sectionReady] = useSearchParamState("section");
  const [section, setSection] = React.useState<SectionId>("business");

  React.useEffect(() => {
    if (!sectionReady) return;
    if (
      initialSection === "business" ||
      initialSection === "outlets" ||
      initialSection === "tax" ||
      initialSection === "payments"
    ) {
      setSection(initialSection);
    }
  }, [initialSection, sectionReady]);

  const canViewBusiness = has("businesses.view");
  const canManageBusiness = has("businesses.manage");
  const canViewOutlets = has("outlets.view");
  const canManageOutlets = has("outlets.manage");
  const canManageTax = has("settings.manage");

  const tabs = React.useMemo(
    () => [
      ...(canViewBusiness ? [{ id: "business", label: "Business" }] : []),
      ...(canViewOutlets ? [{ id: "outlets", label: "Outlets" }] : []),
      ...(canManageTax ? [{ id: "tax", label: "Tax" }] : []),
      { id: "payments", label: "Payments" },
    ] as { id: SectionId; label: string }[],
    [canViewBusiness, canViewOutlets, canManageTax]
  );

  if (!canViewBusiness && !canViewOutlets && !canManageTax) {
    return <AccessDenied permission="businesses.view" />;
  }

  const allowed = tabs.some((tab) => tab.id === section);
  const active = allowed ? section : tabs[0].id;

  const changeSection = (next: string) => {
    const value = next as SectionId;
    setSection(value);
    replaceSearchParam("section", value);
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Business identity, outlets, tax, and the payment rails used at checkout."
      />

      <Tabs
        items={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        value={active}
        onChange={changeSection}
        className="tabs--page"
      />

      <div role="tabpanel" aria-label={tabs.find((tab) => tab.id === active)?.label}>
        {active === "business" && canViewBusiness ? (
          <BusinessSection canManage={canManageBusiness} />
        ) : null}
        {active === "outlets" && canViewOutlets ? (
          <OutletsSection canManage={canManageOutlets} />
        ) : null}
        {active === "tax" && canManageTax ? <TaxSection /> : null}
        {active === "payments" ? <PaymentsSection /> : null}
      </div>
    </>
  );
}

function BusinessSection({ canManage }: { canManage: boolean }) {
  const { session, refresh } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const businessId = session?.business.id;
  const query = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => getBusinessDetails(businessId!),
    enabled: Boolean(businessId),
    staleTime: 60_000,
  });

  const business = query.data ?? session?.business;
  const [form, setForm] = React.useState({
    name: "",
    address: "",
    currency: "IDR",
    timezone: "UTC",
  });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!business) return;
    setForm({
      name: business.name,
      address: business.address ?? "",
      currency: business.currency || "IDR",
      timezone: business.timezone || "UTC",
    });
    setError(null);
  }, [business]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business is selected.");
      const name = form.name.trim();
      if (!name) throw new Error("Enter the business name.");
      if (!/^[A-Za-z]{3}$/.test(form.currency)) throw new Error("Use a three-letter currency code.");
      if (!form.timezone.trim()) throw new Error("Choose a timezone.");
      return updateBusiness(businessId, {
        name,
        address: form.address.trim(),
        currency: form.currency.toUpperCase(),
        timezone: form.timezone.trim(),
      });
    },
    onSuccess: (saved) => {
      push({
        title: "Business profile saved",
        description: `${saved.name} · ${saved.currency} · ${saved.timezone}.`,
        variant: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["business", businessId] });
      void refresh();
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : "The business profile could not be saved.");
    },
  });

  const currencyKnown = CURRENCIES.some(([code]) => code === form.currency);
  const timezoneKnown = TIMEZONES.some(([zone]) => zone === form.timezone);
  const dirty =
    business &&
    (form.name !== business.name ||
      form.address !== (business.address ?? "") ||
      form.currency !== business.currency ||
      form.timezone !== business.timezone);

  return (
    <div className="stack gap-6">
      <Card>
        <CardHeader className="card__head">
          <div>
            <h2>Business profile</h2>
            <p>Identity and formatting used throughout this business workspace.</p>
          </div>
          <Building2 aria-hidden="true" className="card-section-head__icon" />
        </CardHeader>
        <CardBody>
          <form
            id="business-settings"
            className="stack gap-4 py-4"
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
            {!canManage ? (
              <div className="alert alert--info">
                <Info aria-hidden="true" />
                <div>
                  <b>Read-only profile.</b>
                  <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                    Your role can view business settings but not change them.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid grid-2 gap-3">
              <Field
                label="Business name"
                htmlFor="business-name"
                required>
                <Input
                  id="business-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  disabled={!canManage}
                  autoComplete="organization"
                />
              </Field>
              <Field
                label="Currency"
                htmlFor="business-currency"
                hint="Display only. Existing amounts are not converted when this changes."
              >
                <Select
                  id="business-currency"
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, currency: event.target.value }))
                  }
                  disabled={!canManage}
                >
                  {!currencyKnown ? (
                    <option value={form.currency}>{form.currency}</option>
                  ) : null}
                  {CURRENCIES.map(([code, label]) => (
                    <option key={code} value={code}>
                      {code} · {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Timezone"
              htmlFor="business-timezone"
              hint="Stored on the business profile. Changing it does not rewrite existing timestamps."
            >
              <Select
                id="business-timezone"
                value={form.timezone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, timezone: event.target.value }))
                }
                disabled={!canManage}
              >
                {!timezoneKnown ? (
                  <option value={form.timezone}>{form.timezone}</option>
                ) : null}
                {TIMEZONES.map(([zone, label]) => (
                  <option key={zone} value={zone}>
                    {zone} · {label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Address"
              htmlFor="business-address"
              hint="Stored in the business profile settings."
            >
              <Textarea
                id="business-address"
                rows={3}
                value={form.address}
                onChange={(event) =>
                  setForm((current) => ({ ...current, address: event.target.value }))
                }
                placeholder="Street, city, province, postal code"
                disabled={!canManage}
              />
            </Field>

            {canManage ? (
              <div className="form-actions justify-between">
                <span className="hint" style={{ margin: 0 }}>
                  {dirty ? "Unsaved changes" : "Profile is up to date"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (!business) return;
                    setForm({
                      name: business.name,
                      address: business.address ?? "",
                      currency: business.currency,
                      timezone: business.timezone,
                    });
                    setError(null);
                  }}
                  disabled={!dirty || mutation.isPending}
                >
                  Reset
                </Button>
                <Button type="submit" variant="primary" loading={mutation.isPending} disabled={!dirty}>
                  Save profile
                </Button>
              </div>
            ) : null}
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="card__head">
          <div>
            <h2>Team & access</h2>
            <p>Membership, roles, and access status are managed from the team screen.</p>
          </div>
          <Users aria-hidden="true" className="card-section-head__icon" />
        </CardHeader>
        <CardBody>
          <div style={{ padding: 16 }}>
            <div className="row between wrap" style={{ gap: 12 }}>
              <p className="hint" style={{ margin: 0, maxWidth: "56ch" }}>
                Roles apply business-wide. Use the team screen to add an email address, change a role, or suspend
                access.
              </p>
              <Link href="/employees" className="btn btn--secondary">
                Open team & access
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function OutletsSection({ canManage }: { canManage: boolean }) {
  const { outlets, outletId, refreshOutlets, loading } = useBusiness();
  const [editing, setEditing] = React.useState<Outlet | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openOutlet = (outlet: Outlet) => {
    setEditing(outlet);
    setEditorOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="card__head">
          <div>
            <h2>Outlets</h2>
            <p>Where this business sells and holds stock. The selected outlet drives the register and inventory.</p>
          </div>
          {canManage ? (
            <Button variant="secondary" size="sm" onClick={openNew}>
              <Plus aria-hidden="true" /> New outlet
            </Button>
          ) : (
            <Store aria-hidden="true" className="card-section-head__icon" />
          )}
        </CardHeader>

        <CardBody>
          <div style={{ padding: 16 }}>
            {loading && outlets.length === 0 ? (
              <SectionSkeleton />
            ) : outlets.length === 0 ? (
              <EmptyState
                icon={<Store aria-hidden="true" />}
                title="No outlets available"
                description="Your membership may be limited to a single outlet, or outlets could not be loaded."
                actions={
                  canManage ? (
                    <Button variant="primary" onClick={openNew}>
                      Create an outlet
                    </Button>
                  ) : null
                }
              />
            ) : (
              <div className="setting-list">
                {outlets.map((outlet) => (
                  <div className="setting-row" key={outlet.id}>
                    <span className="setting-row__icon" aria-hidden="true">
                      <Store /></span>
                    <div className="setting-row__body">
                      <div className="row row-tight wrap">
                        <b>{outlet.name}</b>
                        {outlet.id === outletId ? <Badge tone="info">Selected</Badge> : null}
                        {outlet.code ? <span className="hint mono">{outlet.code}</span> : null}
                      </div>
                      <div className="hint" style={{ marginTop: 3 }}>
                        {outlet.address || "No address on file"}
                        {outlet.phone ? ` · ${outlet.phone}` : ""}
                      </div>
                    </div>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => openOutlet(outlet)}
                    >
                      {canManage ? (
                        <span><Pencil aria-hidden="true" /> Edit</span>
                      ) : (
                        "View"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="alert alert--info" style={{ marginTop: 14 }}>
              <Info aria-hidden="true" />
              <div>
                <b>New outlets begin with no stock.</b>
                <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                  Existing products have no inventory balance at a new outlet until you receive or transfer stock.
                  Outlet removal is not available here because outlets anchor historical sales and stock records.
                </p>
              </div>
            </div>

            <p className="hint" style={{ margin: "10px 0 0" }}>
              The outlet endpoint returns up to 50 records.
            </p>
          </div>
        </CardBody>
      </Card>

      <OutletEditor
        open={editorOpen}
        outlet={editing}
        canManage={canManage}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          refreshOutlets();
        }}
      />
    </>
  );
}

function OutletEditor({
  open,
  outlet,
  canManage,
  onClose,
  onSaved,
}: {
  open: boolean;
  outlet: Outlet | null;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [form, setForm] = React.useState({ name: "", code: "", address: "", phone: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm({
      name: outlet?.name ?? "",
      code: outlet?.code ?? "",
      address: outlet?.address ?? "",
      phone: outlet?.phone ?? "",
    });
    setError(null);
  }, [open, outlet]);

  const mutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const code = form.code.trim();
      if (!name) throw new Error("Enter the outlet name.");
      if (!code) throw new Error("Enter a short outlet code.");
      if (form.phone.trim().length > 32) throw new Error("Phone numbers can be at most 32 characters.");
      if (outlet) {
        return updateOutlet(outlet.id, {
          name,
          code,
          address: form.address.trim(),
          phone: form.phone.trim(),
        });
      }
      return createOutlet({
        name,
        code,
        address: form.address.trim(),
        phone: form.phone.trim(),
      });
    },
    onSuccess: (saved) => {
      push({
        title: outlet ? "Outlet updated" : "Outlet created",
        description: `${saved.name}${saved.code ? ` · ${saved.code}` : ""} is part of this business.`,
        variant: "success",
      });
      onSaved();
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : "The outlet could not be saved.");
    },
  });

  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={outlet ? "Edit outlet" : "New outlet"}
      description={
        outlet
          ? "Update where this outlet sells and how it appears in the outlet switcher."
          : "Create a selling location for this business. Existing products start with no stock here."
      }
      width={500}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Close
          </Button>
          {canManage ? (
            <Button
              variant="primary"
              loading={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {outlet ? "Save outlet" : "Create outlet"}
            </Button>
          ) : null}
        </>
      }
    >
      <form
        className="stack gap-3"
        style={{ gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (canManage) mutation.mutate();
        }}
      >
        {error ? (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        ) : null}
        {!canManage ? (
          <div className="alert alert--info">
            Your role can view outlets but not create or edit them.
          </div>
        ) : null}
        <div className="grid grid-2 gap-3">
          <Field label="Outlet name" htmlFor="outlet-name" required>
            <Input
              id="outlet-name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Main outlet"
              disabled={!canManage}
              autoFocus
            />
          </Field>
          <Field
            label="Outlet code"
            htmlFor="outlet-code"
            required
            hint="Short label used in records."
          >
            <Input
              id="outlet-code"
              value={form.code}
              onChange={(event) =>
                setForm((current) => ({ ...current, code: event.target.value }))
              }
              placeholder="MAIN"
              disabled={!canManage}
            />
          </Field>
        </div>
        <Field label="Phone" htmlFor="outlet-phone">
          <Input
            id="outlet-phone"
            type="tel"
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
            placeholder="+62 21 1234 5678"
            disabled={!canManage}
          />
        </Field>
        <Field label="Address" htmlFor="outlet-address">
          <Textarea
            id="outlet-address"
            rows={3}
            value={form.address}
            onChange={(event) =>
              setForm((current) => ({ ...current, address: event.target.value }))
            }
            placeholder="Street, city, province, postal code"
            disabled={!canManage}
          />
        </Field>
      </form>
    </Sheet>
  );
}

function TaxSection() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["tax-rates"],
    queryFn: listTaxRates,
    staleTime: 60_000,
  });
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TaxRate | null>(null);
  const rates = query.data ?? [];
  const hasActiveDefault = rates.some((rate) => rate.isDefault && rate.isActive);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="card__head">
          <div>
            <h2>Tax rates</h2>
            <p>Tax is applied at checkout from the active default rate. Historical sales keep the rate they used.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={openNew}>
            <Plus aria-hidden="true" /> Add tax rate
          </Button>
        </CardHeader>

        <CardBody>
          <div style={{ padding: 16 }}>
            {query.isError ? (
              <InlineError
                title="Tax rates could not be loaded"
                error={query.error}
                onRetry={() => query.refetch()}
              />
            ) : query.isLoading ? (
              <SectionSkeleton />
            ) : rates.length === 0 ? (
              <EmptyState
                icon={<ReceiptText aria-hidden="true" />}
                title="No tax rates"
                description="Checkout records no tax until you add an active default rate."
                actions={
                  <Button variant="primary" onClick={openNew}>
                    Add first tax rate
                  </Button>
                }
              />
            ) : (
              <div className="setting-list">
                {rates.map((rate) => (
                  <div className="setting-row" key={rate.id}>
                    <span
                      className="setting-row__icon setting-row__icon--number"
                      aria-hidden="true"
                    >
                      {formatNumber(rate.rate, "en-GB")}%
                    </span>
                    <div className="setting-row__body">
                      <div className="row row-tight wrap">
                        <b>{rate.name}</b>
                        {rate.isDefault ? <Badge tone="info">Default</Badge> : null}
                        {!rate.isActive ? <Badge tone="neutral">Inactive</Badge> : null}
                      </div>
                      <div className="hint" style={{ marginTop: 3 }}>
                        {rate.type === "inclusive"
                          ? "Included in listed prices; shown as the tax portion."
                          : "Added to the subtotal at checkout."
                        }
                      </div>
                    </div>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => {
                        setEditing(rate);
                        setEditorOpen(true);
                      }}
                    >
                      <Pencil aria-hidden="true" /> Edit
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!hasActiveDefault && !query.isLoading && !query.isError ? (
              <div className="alert alert--warning" style={{ marginTop: 14 }}>
                <div>
                  <b>No active default tax rate.</b>
                  <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                    The register will record zero tax until a rate is both active and marked default.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="alert alert--info" style={{ marginTop: 14 }}>
              <Info aria-hidden="true" />
              <div>
                <b>Inclusive vs exclusive.</b>
                <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                  Inclusive tax is already inside listed prices. Exclusive tax is added to the subtotal. The server
                  recalculates tax at checkout, and each sale stores the rate it used.
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <TaxEditor
        open={editorOpen}
        rate={editing}
        isFirstRate={rates.length === 0}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["tax-rates"] });
        }}
      />
    </>
  );
}

function TaxEditor({
  open,
  rate,
  isFirstRate,
  onClose,
  onSaved,
}: {
  open: boolean;
  rate: TaxRate | null;
  isFirstRate: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [form, setForm] = React.useState({
    name: "",
    rate: "",
    type: "exclusive" as "inclusive" | "exclusive",
    isDefault: false,
    isActive: true,
  });
  const [error, setError] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm({
      name: rate?.name ?? "",
      rate: rate ? String(rate.rate) : "",
      type: rate?.type ?? "exclusive",
      isDefault: rate?.isDefault ?? isFirstRate,
      isActive: rate?.isActive ?? true,
    });
    setError(null);
    setDeleteOpen(false);
  }, [open, rate, isFirstRate]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const value = Number(form.rate);
      if (!name) throw new Error("Enter a name for the tax rate.");
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new Error("Enter a tax percentage between 0 and 100.");
      }
      const input = {
        name,
        rate: value,
        type: form.type,
        isDefault: form.isDefault,
        isActive: form.isActive,
      };
      if (rate) return updateTaxRate(rate.id, input);
      return createTaxRate(input);
    },
    onSuccess: (saved) => {
      push({
        title: rate ? "Tax rate updated" : "Tax rate added",
        description: `${saved.name} · ${formatNumber(saved.rate, "en-GB")}%${saved.isDefault ? " · default" : ""}.`,
        variant: "success",
      });
      onSaved();
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : "The tax rate could not be saved.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!rate) throw new Error("No tax rate selected.");
      await deleteTaxRate(rate.id);
    },
    onSuccess: () => {
      push({
        title: "Tax rate deleted",
        description: `${rate?.name} was removed. Historical sales are unchanged.`,
        variant: "success",
      });
      setDeleteOpen(false);
      onSaved();
    },
    onError: (error) => {
      setDeleteOpen(false);
      setError(error instanceof Error ? error.message : "The tax rate could not be deleted.");
    },
  });

  return (
    <>
      <Sheet
        open={open}
        onClose={() => {
          if (!saveMutation.isPending) onClose();
        }}
        title={rate ? "Edit tax rate" : "Add tax rate"}
        description="Checkout uses the active default rate. New sales store the rate they used."
        width={500}
        footer={
          <>
            {rate ? (
              <Button
                variant="danger-quiet"
                onClick={() => setDeleteOpen(true)}
                disabled={saveMutation.isPending}
              >
                <Trash2 aria-hidden="true" /> Delete
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={saveMutation.isPending}
              style={{ marginLeft: rate ? 0 : "auto" }}
            >
              Close
            </Button>
            <Button
              variant="primary"
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {rate ? "Save rate" : "Create rate"}
            </Button>
          </>
        }
      >
        <form
          className="stack gap-3"
          style={{ gap: 15 }}
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
          <div className="grid grid-2 gap-3">
            <Field label="Name" htmlFor="tax-name" required>
              <Input
                id="tax-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="PPN"
                autoFocus
              />
            </Field>
            <Field
              label="Rate"
              htmlFor="tax-rate"
              required
              hint="Percentage, not a decimal. 11 means 11%."
            >
              <Input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                inputMode="decimal"
                value={form.rate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, rate: event.target.value }))
                }
                placeholder="11"
              />
            </Field>
          </div>

          <Field
            label="Tax type"
            htmlFor="tax-type"
            hint={
              form.type === "inclusive"
                ? "Listed product prices already contain this tax."
                : "This tax is added on top of listed product prices."
            }
          >
            <Select
              id="tax-type"
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as "inclusive" | "exclusive",
                }))
              }
            >
              <option value="exclusive">Exclusive — added to subtotal</option>
              <option value="inclusive">Inclusive — inside listed prices</option>
            </Select>
          </Field>

          <div className="stack-sm">
            <Switch
              checked={form.isActive}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                  isDefault: event.target.checked ? current.isDefault : false,
                }))
              }
              label="Active"
              description="Inactive rates are kept for history but are not used at checkout."
            />
            <Switch
              checked={form.isDefault}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isDefault: event.target.checked,
                  isActive: event.target.checked ? true : current.isActive,
                }))
              }
              label="Default rate"
              description="The register applies this rate to new sales. Setting it clears the previous default."
            />
          </div>

          {form.isDefault && !form.isActive ? (
            <div className="alert alert--warning">
              A default rate must also be active to be used at checkout.
            </div>
          ) : null}
        </form>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete this tax rate?"
        description={
          <>
            <b>{rate?.name}</b> will no longer be available for new sales. Sales that already used it keep their
            recorded rate and tax amount. If this was the default, checkout may record no tax until another active
            default is set.
          </>
        }
        confirmLabel="Delete tax rate"
        loading={deleteMutation.isPending}
      />
    </>
  );
}

function PaymentsSection() {
  const query = useQuery({
    queryKey: ["payment-methods"],
    queryFn: listPaymentMethods,
    staleTime: 5 * 60_000,
  });

  const icons: Record<string, React.ReactNode> = {
    cash: <Banknote aria-hidden="true" />,
    qris: <QrCode aria-hidden="true" />,
    debit_card: <CreditCard aria-hidden="true" />,
    credit_card: <CreditCard aria-hidden="true" />,
  };

  const descriptions: Record<string, string> = {
    cash: "Cash tendered and change are recorded during checkout.",
    qris: "Recorded as a QRIS payment. Velora does not confirm settlement with a payment provider.",
    debit_card: "Recorded as a debit-card payment. Card capture happens outside Velora.",
    credit_card: "Recorded as a credit-card payment. Card capture happens outside Velora.",
  };

  const methods = query.data ?? [];

  return (
    <Card>
      <CardHeader className="card__head">
        <div>
          <h2>Payment methods</h2>
          <p>
            These are the rails the register can record on a sale. They are part of the checkout flow, not
            configurable payment entities.
          </p>
        </div>
        <Wallet aria-hidden="true" className="card-section-head__icon" />
      </CardHeader>

      <CardBody>
        <div style={{ padding: 16 }}>
          {query.isError ? (
            <InlineError
              title="Payment methods could not be loaded"
              error={query.error}
              onRetry={() => query.refetch()}
            />
          ) : query.isLoading ? (
            <SectionSkeleton />
          ) : methods.length === 0 ? (
            <EmptyState
              icon={<Wallet aria-hidden="true" />}
              title="No payment methods returned"
              description="The checkout payment rails could not be read. Reload this page or check the API response."
            />
          ) : (
            <div className="rail-grid">
              {methods.map((method: PaymentMethod) => (
                <div className="rail-card" key={method.id}>
                  <span className="rail-card__icon">
                    {icons[method.type] ?? <Wallet aria-hidden="true" />}
                  </span>
                  <div>
                    <div className="row row-tight">
                      <b>{method.name}</b>
                      <Badge tone={method.active ? "success" : "neutral"} dot>
                        {method.active ? "Available" : "Unavailable"}
                      </Badge>
                    </div>
                    <p className="hint" style={{ margin: "4px 0 0" }}>
                      {descriptions[method.type] ?? "Recorded as a payment method on each sale."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="alert alert--info" style={{ marginTop: 14 }}>
            <Info aria-hidden="true" />
            <div>
              <b>No settlement integration.</b>
              <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                Velora records the chosen method and amount. It does not capture cards, generate QR codes, or confirm
                bank settlement. Taxes applied to a sale come from the active default tax rate.
              </p>
            </div>
          </div>

          {methods.length > 0 && methods.every((method) => method.active) ? (
            <div className="row row-tight" style={{ marginTop: 12 }}>
              <CheckCircle2
                aria-hidden="true"
                style={{ width: 14, height: 14, color: "hsl(var(--success))" }}
              />
              <span className="hint" style={{ margin: 0 }}>
                All four rails are available at checkout.
              </span>
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}