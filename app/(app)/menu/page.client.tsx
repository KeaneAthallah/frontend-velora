"use client";

// Opt out of instant-navigation validation: this page renders data-dependent client UI.
export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Clock,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Segmented,
  Select,
  Tabs,
  initials,
} from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { AccessDenied } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  attachModifierGroup,
  createDaypart,
  createModifierGroup,
  createModifierOption,
  deleteDaypart,
  deleteModifierGroup,
  deleteModifierOption,
  getMenu,
  listDayparts,
  listModifierGroups,
  markProductUnavailable,
  restoreProduct,
  setProductDayparts,
  updateDaypart,
  updateModifierGroup,
  updateModifierOption,
  type DaypartInput,
  type ModifierOptionInput,
} from "@/lib/api/menu";
import type { Daypart, MenuProduct, ModifierGroup, ModifierOption } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/formatting/currency";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TABS = [
  { id: "availability", label: "Availability" },
  { id: "modifiers", label: "Modifiers & combos" },
  { id: "dayparts", label: "Dayparts" },
];

export default function MenuPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId } = useBusiness();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const currency = session?.business.currency ?? "IDR";
  const canManage = has("menu.manage");
  const canAvailability = has("menu.availability");
  const canDayparts = has("menu.dayparts");

  const [tab, setTab] = React.useState("availability");
  const [search, setSearch] = React.useState("");

  const [groupForm, setGroupForm] = React.useState<{ group?: ModifierGroup } | null>(null);
  const [optionForm, setOptionForm] = React.useState<{ group: ModifierGroup; option?: ModifierOption } | null>(null);
  const [attachGroup, setAttachGroup] = React.useState<ModifierGroup | null>(null);
  const [eightySix, setEightySix] = React.useState<MenuProduct | null>(null);
  const [eightySixReason, setEightySixReason] = React.useState("");
  const [daypartForm, setDaypartForm] = React.useState<{ daypart?: Daypart } | null>(null);
  const [productDaypartTarget, setProductDaypartTarget] = React.useState<MenuProduct | null>(null);

  const menuQuery = useQuery({
    queryKey: ["menu", outletId],
    queryFn: () => getMenu(outletId!),
    enabled: has("menu.view") && Boolean(outletId),
    staleTime: 30_000,
  });

  const groupsQuery = useQuery({
    queryKey: ["menu-groups"],
    queryFn: () => listModifierGroups({ active: true }),
    enabled: has("menu.view"),
    staleTime: 60_000,
  });

  const daypartsQuery = useQuery({
    queryKey: ["dayparts"],
    queryFn: listDayparts,
    enabled: has("menu.view"),
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["menu"] });
    queryClient.invalidateQueries({ queryKey: ["menu-groups"] });
    queryClient.invalidateQueries({ queryKey: ["dayparts"] });
    queryClient.invalidateQueries({ queryKey: ["pos-menu"] });
  };

  const action = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSuccess: () => {
      invalidate();
      push({ title: "Saved", variant: "success" });
    },
    onError: (error) => {
      push({
        title: "Could not save",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    },
  });

  if (!has("menu.view")) {
    return <AccessDenied permission="menu.view" />;
  }

  const products = menuQuery.data?.products ?? [];
  const filtered = products.filter((product) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      product.categoryName.toLowerCase().includes(query)
    );
  });

  const groups = groupsQuery.data ?? [];
  const dayparts = daypartsQuery.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow={menuQuery.data?.outlet.name ?? "Menu engineering"}
        title="Menu"
        description="Control what can be sold right now, build modifiers and combos, and schedule serving windows."
        actions={
          <>
            <Link href="/products" className="btn btn--secondary btn--sm">
              Products
            </Link>
            {canManage ? (
              <Button size="sm" onClick={() => setGroupForm({})}>
                <Plus aria-hidden="true" />
                New group
              </Button>
            ) : null}
          </>
        }
      />

      <div className="row between wrap" style={{ marginBottom: 14, gap: 10 }}>
        <Tabs items={TABS} value={tab} onChange={setTab} />
        <span className="hint" style={{ margin: 0 }}>
          {formatNumber(products.length)} active items · {formatNumber(groups.length)} modifier groups
        </span>
      </div>

      {tab === "availability" ? (
        <section className="stack">
          <label className="input-affix" style={{ maxWidth: 420 }}>
            <Search aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search items by name, SKU, or category"
              aria-label="Search menu items"
            />
            {search ? (
              <button type="button" className="icon-btn" onClick={() => setSearch("")} aria-label="Clear search">
                <X aria-hidden="true" />
              </button>
            ) : null}
          </label>

          {menuQuery.isLoading ? (
            <div className="card">
              <div className="stack" aria-busy="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div className="skeleton skeleton-row" key={index} />
                ))}
              </div>
            </div>
          ) : menuQuery.isError ? (
            <div className="card">
              <EmptyState
                icon={<UtensilsCrossed aria-hidden="true" />}
                title="The menu could not be loaded"
                description={menuQuery.error instanceof Error ? menuQuery.error.message : "Try again."}
                actions={
                  <Button variant="secondary" onClick={() => menuQuery.refetch()}>
                    Try again
                  </Button>
                }
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Search aria-hidden="true" />}
                title="No items match"
                description="Try a different name, SKU, or category."
              />
            </div>
          ) : (
            <div className="card">
              <div className="record-list">
                {filtered.map((product) => (
                  <div className="record" key={product.id} style={{ alignItems: "center" }}>
                    <div className="row" style={{ minWidth: 0, flex: 1 }}>
                      <span className="avatar" aria-hidden="true">
                        {initials(product.name)}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="record__title">{product.name}</div>
                        <div className="record__meta">
                          {product.categoryName || "Uncategorised"} · {product.sku}
                          {product.modifierGroups.length
                            ? ` · ${product.modifierGroups.length} modifier ${product.modifierGroups.length === 1 ? "group" : "groups"}`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {product.available ? (
                        <Badge tone="success" dot>
                          Available
                        </Badge>
                      ) : (
                        <Badge tone="danger" dot>
                          {product.unavailableReason || "Unavailable"}
                        </Badge>
                      )}
                      {product.isCombo ? <Badge tone="brand">Combo</Badge> : null}
                      {canDayparts ? (
                        <Button variant="quiet" size="sm" onClick={() => setProductDaypartTarget(product)}>
                          <Clock aria-hidden="true" />
                          Hours
                        </Button>
                      ) : null}
                      {canAvailability ? (
                        product.available ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEightySix(product);
                              setEightySixReason("");
                            }}
                          >
                            Mark 86
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={action.isPending || !outletId}
                            onClick={() => {
                              if (!outletId) return;
                              action.mutate(() => restoreProduct(product.id, outletId));
                            }}
                          >
                            Restore
                          </Button>
                        )
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {tab === "modifiers" ? (
        <section className="stack">
          {groupsQuery.isLoading ? (
            <div className="card">
              <div className="stack" aria-busy="true">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className="skeleton skeleton-row" key={index} />
                ))}
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<SlidersHorizontal aria-hidden="true" />}
                title="No modifier groups yet"
                description="Create groups for milk, size, add-ons, or combo choices, then apply them to products."
                actions={
                  canManage ? (
                    <Button onClick={() => setGroupForm({})}>
                      <Plus aria-hidden="true" />
                      Create the first group
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              }}
            >
              {groups.map((group) => (
                <article className="card" key={group.id} style={{ display: "flex", flexDirection: "column" }}>
                  <div className="card__head">
                    <div>
                      <div className="row" style={{ gap: 8 }}>
                        <h3 style={{ fontSize: 14 }}>{group.name}</h3>
                        {group.kind === "combo" ? <Badge tone="brand">Combo</Badge> : null}
                        {group.isRequired ? <Badge tone="warning">Required</Badge> : null}
                      </div>
                      <p className="hint" style={{ marginTop: 2 }}>
                        {group.selectionType === "single"
                          ? "Choose one"
                          : group.maxSelect > 0
                            ? `Choose up to ${group.maxSelect}`
                            : "Choose any"}{" "}
                        · {group.options.length} {group.options.length === 1 ? "option" : "options"}
                      </p>
                    </div>
                  </div>

                  <div className="stack-sm" style={{ flex: 1 }}>
                    {group.options.length === 0 ? (
                      <p className="hint" style={{ margin: 0 }}>
                        No options yet.
                      </p>
                    ) : (
                      group.options.map((option) => (
                        <div className="row between" key={option.id} style={{ gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                              {option.name}
                              {option.isDefault ? (
                                <Badge tone="neutral" style={{ marginLeft: 6 }}>
                                  Default
                                </Badge>
                              ) : null}
                            </div>
                            <div className="hint">
                              {option.priceDelta === 0
                                ? "No charge"
                                : `+${formatCurrency(option.priceDelta, currency)}`}
                              {option.productId ? " · linked product" : ""}
                            </div>
                          </div>
                          {canManage ? (
                            <div className="row" style={{ gap: 2 }}>
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={`Edit ${option.name}`}
                                onClick={() => setOptionForm({ group, option })}
                              >
                                <Pencil aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={`Delete ${option.name}`}
                                disabled={action.isPending}
                                onClick={() => action.mutate(() => deleteModifierOption(option.id))}
                              >
                                <Trash2 aria-hidden="true" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>

                  {canManage ? (
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <Button variant="secondary" size="sm" onClick={() => setOptionForm({ group })}>
                        <Plus aria-hidden="true" />
                        Option
                      </Button>
                      <Button variant="quiet" size="sm" onClick={() => setAttachGroup(group)}>
                        Apply to product
                      </Button>
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => setGroupForm({ group })}
                        aria-label={`Edit ${group.name}`}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        variant="quiet"
                        size="sm"
                        disabled={action.isPending}
                        onClick={() => action.mutate(() => deleteModifierGroup(group.id))}
                        aria-label={`Delete ${group.name}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "dayparts" ? (
        <section className="stack">
          <div className="row between wrap" style={{ gap: 10 }}>
            <p className="hint" style={{ margin: 0, maxWidth: 640 }}>
              Dayparts are named time windows. Products with a serving window can only be sold inside it; products with
              no window are always available.
            </p>
            {canDayparts ? (
              <Button size="sm" onClick={() => setDaypartForm({})}>
                <Plus aria-hidden="true" />
                New daypart
              </Button>
            ) : null}
          </div>

          {daypartsQuery.isLoading ? (
            <div className="card">
              <div className="stack" aria-busy="true">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className="skeleton skeleton-row" key={index} />
                ))}
              </div>
            </div>
          ) : dayparts.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<CalendarClock aria-hidden="true" />}
                title="No dayparts yet"
                description="Add breakfast, lunch, and dinner windows, then assign products from the Availability tab."
                actions={
                  canDayparts ? (
                    <Button onClick={() => setDaypartForm({})}>
                      <Plus aria-hidden="true" />
                      Create a daypart
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="card">
              <div className="record-list">
                {dayparts.map((daypart) => (
                  <div className="record" key={daypart.id} style={{ alignItems: "center" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="record__title">
                        {daypart.name}
                        {!daypart.isActive ? (
                          <Badge tone="neutral" style={{ marginLeft: 6 }}>
                            Inactive
                          </Badge>
                        ) : null}
                      </div>
                      <div className="record__meta">
                        {daypart.startTime}–{daypart.endTime} ·{" "}
                        {daypart.days.length ? daypart.days.map((day) => DAY_LABELS[day]).join(", ") : "Every day"} ·{" "}
                        {formatNumber(daypart.productCount)} {daypart.productCount === 1 ? "product" : "products"}
                      </div>
                    </div>
                    {canDayparts ? (
                      <div className="row" style={{ gap: 2 }}>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${daypart.name}`}
                          onClick={() => setDaypartForm({ daypart })}
                        >
                          <Pencil aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Delete ${daypart.name}`}
                          disabled={action.isPending}
                          onClick={() => action.mutate(() => deleteDaypart(daypart.id))}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : null}

      <GroupFormDialog
        state={groupForm}
        pending={action.isPending}
        onClose={() => setGroupForm(null)}
        onSubmit={(input) => {
          const current = groupForm?.group;
          action.mutate(() =>
            current
              ? updateModifierGroup(current.id, {
                  name: input.name,
                  kind: input.kind,
                  selectionType: input.selectionType,
                  isRequired: input.isRequired,
                })
              : createModifierGroup(input)
          );
          setGroupForm(null);
        }}
      />

      <OptionFormDialog
        state={optionForm}
        currency={currency}
        pending={action.isPending}
        onClose={() => setOptionForm(null)}
        onSubmit={(input) => {
          const state = optionForm;
          if (!state) return;
          action.mutate(() =>
            state.option
              ? updateModifierOption(state.option.id, input)
              : createModifierOption(state.group.id, input)
          );
          setOptionForm(null);
        }}
      />

      <AttachDialog
        group={attachGroup}
        products={products}
        pending={action.isPending}
        onClose={() => setAttachGroup(null)}
        onAttach={(productId) => {
          if (!attachGroup) return;
          action.mutate(() => attachModifierGroup(attachGroup.id, { type: "product", id: productId }));
          setAttachGroup(null);
        }}
      />

      <Dialog
        open={Boolean(eightySix)}
        onClose={() => setEightySix(null)}
        title={eightySix ? `Mark ${eightySix.name} unavailable?` : "Mark unavailable"}
        description="It will disappear from the register at this outlet until it is restored."
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEightySix(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={action.isPending}
              disabled={!eightySix || eightySixReason.trim().length === 0}
              onClick={() => {
                if (!eightySix || !outletId || !eightySixReason.trim()) return;
                action.mutate(() => markProductUnavailable(eightySix.id, eightySixReason.trim(), outletId));
                setEightySix(null);
              }}
            >
              Mark unavailable
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="hint" style={{ margin: 0 }}>
            Stock is not changed. The item is hidden from the register for this outlet, and the reason is shown to
            staff.
          </p>
          <Field label="Reason" required>
            <Input
              value={eightySixReason}
              onChange={(event) => setEightySixReason(event.target.value)}
              placeholder="Out of beans, equipment down, …"
              maxLength={255}
              autoFocus
            />
          </Field>
        </div>
      </Dialog>

      <DaypartFormDialog
        state={daypartForm}
        pending={action.isPending}
        onClose={() => setDaypartForm(null)}
        onSubmit={(input) => {
          const current = daypartForm?.daypart;
          action.mutate(() => (current ? updateDaypart(current.id, input) : createDaypart(input)));
          setDaypartForm(null);
        }}
      />

      <ProductDaypartsDialog
        product={productDaypartTarget}
        dayparts={dayparts}
        pending={action.isPending}
        onClose={() => setProductDaypartTarget(null)}
        onSubmit={(product, ids) => {
          action.mutate(() => setProductDayparts(product.id, ids));
          setProductDaypartTarget(null);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Modifier groups                                                              */
/* -------------------------------------------------------------------------- */

function GroupFormDialog({
  state,
  pending,
  onClose,
  onSubmit,
}: {
  state: { group?: ModifierGroup } | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    kind: "modifier" | "combo";
    selectionType: "single" | "multiple";
    isRequired: boolean;
  }) => void;
}) {
  const group = state?.group;
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<"modifier" | "combo">("modifier");
  const [selectionType, setSelectionType] = React.useState<"single" | "multiple">("single");
  const [isRequired, setIsRequired] = React.useState(false);

  React.useEffect(() => {
    if (!state) return;
    setName(group?.name ?? "");
    setKind(group?.kind ?? "modifier");
    setSelectionType(group?.selectionType ?? "single");
    setIsRequired(group?.isRequired ?? false);
  }, [state, group]);

  return (
    <Dialog
      open={Boolean(state)}
      onClose={onClose}
      title={group ? "Edit modifier group" : "New modifier group"}
      description="Attach the group to products after creating it."
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            loading={pending}
            onClick={() =>
              onSubmit({ name: name.trim(), kind, selectionType, isRequired })
            }
          >
            {group ? "Save changes" : "Create group"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Name" required>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Milk, Size, Add-ons, Pastry box"
            autoFocus
          />
        </Field>
        <Field label="Type" hint="Modifiers change an item; a combo offers other products as choices.">
          <Select value={kind} onChange={(event) => setKind(event.target.value as "modifier" | "combo")}>
            <option value="modifier">Modifier</option>
            <option value="combo">Combo</option>
          </Select>
        </Field>
        <Field label="Selection">
          <Segmented
            label="Selection type"
            value={selectionType}
            onChange={setSelectionType}
            options={[
              { value: "single", label: "Choose one" },
              { value: "multiple", label: "Choose several" },
            ]}
          />
        </Field>
        <Checkbox
          label="Required at checkout"
          description="The sale cannot be completed until a choice is made."
          checked={isRequired}
          onChange={(event) => setIsRequired(event.target.checked)}
        />
      </div>
    </Dialog>
  );
}

function OptionFormDialog({
  state,
  currency,
  pending,
  onClose,
  onSubmit,
}: {
  state: { group: ModifierGroup; option?: ModifierOption } | null;
  currency: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: ModifierOptionInput) => void;
}) {
  const option = state?.option;
  const [name, setName] = React.useState("");
  const [priceDelta, setPriceDelta] = React.useState("0");
  const [isDefault, setIsDefault] = React.useState(false);

  React.useEffect(() => {
    if (!state) return;
    setName(option?.name ?? "");
    setPriceDelta(String(option?.priceDelta ?? 0));
    setIsDefault(option?.isDefault ?? false);
  }, [state, option]);

  return (
    <Dialog
      open={Boolean(state)}
      onClose={onClose}
      title={option ? "Edit option" : `Add an option${state ? ` to ${state.group.name}` : ""}`}
      description="Price deltas are added to the product base price."
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            loading={pending}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                priceDelta: Number(priceDelta) || 0,
                isDefault,
              })
            }
          >
            {option ? "Save option" : "Add option"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Name" required>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Oat milk, Large, Extra shot"
            autoFocus
          />
        </Field>
        <Field label="Extra price" hint={`Added to the base price. Shown as +${formatCurrency(Number(priceDelta) || 0, currency)}.`}>
          <Input
            type="number"
            min={0}
            step="500"
            inputMode="numeric"
            value={priceDelta}
            onChange={(event) => setPriceDelta(event.target.value)}
          />
        </Field>
        <Checkbox
          label="Pre-select this option"
          checked={isDefault}
          onChange={(event) => setIsDefault(event.target.checked)}
        />
      </div>
    </Dialog>
  );
}

function AttachDialog({
  group,
  products,
  pending,
  onClose,
  onAttach,
}: {
  group: ModifierGroup | null;
  products: MenuProduct[];
  pending: boolean;
  onClose: () => void;
  onAttach: (productId: string) => void;
}) {
  const [productId, setProductId] = React.useState("");
  React.useEffect(() => setProductId(""), [group]);

  return (
    <Dialog
      open={Boolean(group)}
      onClose={onClose}
      title={group ? `Apply ${group.name}` : "Apply group"}
      description="Applying again is harmless. The register shows the group immediately after saving."
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!productId} loading={pending} onClick={() => onAttach(productId)}>
            Apply group
          </Button>
        </>
      }
    >
      <Field label="Product">
        <Select value={productId} onChange={(event) => setProductId(event.target.value)}>
          <option value="">Choose a product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </Select>
      </Field>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Dayparts                                                                     */
/* -------------------------------------------------------------------------- */

function DaypartFormDialog({
  state,
  pending,
  onClose,
  onSubmit,
}: {
  state: { daypart?: Daypart } | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: DaypartInput) => void;
}) {
  const daypart = state?.daypart;
  const [name, setName] = React.useState("");
  const [startTime, setStartTime] = React.useState("08:00");
  const [endTime, setEndTime] = React.useState("11:00");
  const [days, setDays] = React.useState<number[]>([]);
  const [isActive, setIsActive] = React.useState(true);

  React.useEffect(() => {
    if (!state) return;
    setName(daypart?.name ?? "");
    setStartTime(daypart?.startTime ?? "08:00");
    setEndTime(daypart?.endTime ?? "11:00");
    setDays(daypart?.days ?? []);
    setIsActive(daypart?.isActive ?? true);
  }, [state, daypart]);

  return (
    <Dialog
      open={Boolean(state)}
      onClose={onClose}
      title={daypart ? "Edit daypart" : "New daypart"}
      description="Times use the business timezone."
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !startTime || !endTime}
            loading={pending}
            onClick={() => onSubmit({ name: name.trim(), startTime, endTime, days, isActive })}
          >
            {daypart ? "Save daypart" : "Create daypart"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Name" required>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Breakfast" autoFocus />
        </Field>
        <div className="row" style={{ gap: 10 }}>
          <Field label="Starts" required>
            <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </Field>
          <Field label="Ends" required>
            <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </Field>
        </div>
        <Field label="Days" hint="Leave every day unchecked to apply the window daily.">
          <div className="chips">
            {DAY_LABELS.map((label, index) => (
              <button
                type="button"
                key={label}
                className="chip"
                aria-pressed={days.includes(index)}
                onClick={() =>
                  setDays((current) =>
                    current.includes(index) ? current.filter((day) => day !== index) : [...current, index]
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Checkbox
          label="Active"
          description="Turn off to keep the window but stop enforcing it."
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
      </div>
    </Dialog>
  );
}

function ProductDaypartsDialog({
  product,
  dayparts,
  pending,
  onClose,
  onSubmit,
}: {
  product: MenuProduct | null;
  dayparts: Daypart[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (product: MenuProduct, ids: string[]) => void;
}) {
  const [selected, setSelected] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (product) setSelected(product.daypartIds ?? []);
  }, [product]);

  return (
    <Dialog
      open={Boolean(product)}
      onClose={onClose}
      title={product ? `Serving hours for ${product.name}` : "Serving hours"}
      description="Select the windows this item may be sold in. No selection means all day."
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} onClick={() => product && onSubmit(product, selected)}>
            Save hours
          </Button>
        </>
      }
    >
      {dayparts.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>
          Create a daypart first, then assign products to it.
        </p>
      ) : (
        <div className="stack">
          {dayparts.map((daypart) => (
            <Checkbox
              key={daypart.id}
              label={`${daypart.name} · ${daypart.startTime}–${daypart.endTime}`}
              checked={selected.includes(daypart.id)}
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked
                    ? [...current, daypart.id]
                    : current.filter((id) => id !== daypart.id)
                )
              }
            />
          ))}
        </div>
      )}
    </Dialog>
  );
}
