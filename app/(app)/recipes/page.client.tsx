"use client";

// Opt out of instant-navigation validation: this page renders data-dependent client UI.
export const instant = false;

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChefHat,
  ClipboardList,
  Pencil,
  Plus,
  Search,
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
  Select,
  Tabs,
  initials,
} from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { AccessDenied } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  adjustIngredient,
  createIngredient,
  deleteIngredient,
  getRecipeAvailability,
  listIngredientMovements,
  listIngredients,
  listRecipes,
  setRecipe,
  updateIngredient,
  type IngredientAdjustInput,
  type IngredientInput,
  type RecipeItemInput,
} from "@/lib/api/ingredients";
import type {
  Ingredient,
  IngredientMovement,
  ProductAvailability,
  RecipeLine,
  RecipeProduct,
} from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/formatting/currency";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";

const MOVEMENT_LABEL: Record<string, string> = {
  adjustment: "Adjustment",
  purchase: "Purchase",
  consumption: "Sale",
  void: "Void",
  wastage: "Wastage",
  expired: "Expired",
};

function movementTone(type: string): "success" | "warning" | "danger" | "neutral" {
  if (type === "purchase") return "success";
  if (type === "void") return "warning";
  if (type === "wastage" || type === "expired") return "danger";
  return "neutral";
}

function scopeLines(product: RecipeProduct | null, variantId: string): RecipeLine[] {
  if (!product) return [];
  return product.recipeItems.filter((line) =>
    variantId ? line.productVariantId === variantId : !line.productVariantId
  );
}

/** "N sellable now" for a product, or null when nothing limits it. */
function sellableLabel(availability: ProductAvailability): string {
  if (availability.status === "out_of_stock") return "Sold out";
  return `${formatNumber(availability.sellable ?? 0)} sellable now`;
}

function sellableTone(availability: ProductAvailability): "danger" | "warning" | "neutral" {
  if (availability.status === "out_of_stock") return "danger";
  if (availability.status === "low_stock") return "warning";
  return "neutral";
}

function lineCost(line: RecipeItemInput, ingredients: Ingredient[]): number {
  const ingredient = ingredients.find((entry) => entry.id === line.ingredientId);
  if (!ingredient) return 0;
  return line.quantity * (1 + (line.wastePercent ?? 0) / 100) * ingredient.costPerUnit;
}

export default function RecipesPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId } = useBusiness();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const currency = session?.business.currency ?? "IDR";
  const canManageRecipes = has("recipes.manage");
  const canEditInventory = has("ingredients.view") || has("ingredients.manage");
  const canManageIngredients = has("ingredients.manage");

  const [tab, setTab] = React.useState("recipes");
  const [search, setSearch] = React.useState("");

  const [recipeTarget, setRecipeTarget] = React.useState<RecipeProduct | null>(null);
  const [ingredientForm, setIngredientForm] = React.useState<{ ingredient?: Ingredient } | null>(null);
  const [adjustTarget, setAdjustTarget] = React.useState<Ingredient | null>(null);
  const [movementTarget, setMovementTarget] = React.useState<Ingredient | null>(null);

  const recipesQuery = useQuery({
    queryKey: ["recipes", search],
    queryFn: () => listRecipes({ q: search || undefined }),
    enabled: has("recipes.view"),
    staleTime: 60_000,
  });

  const ingredientsQuery = useQuery({
    queryKey: ["ingredients", outletId, search],
    queryFn: () => listIngredients({ outletId: outletId ?? undefined, q: search || undefined }),
    enabled: canEditInventory,
    staleTime: 60_000,
  });

  // Same endpoint the register gates its tiles with: how many units the outlet
  // can still make from the ingredients on hand, and which one runs out first.
  const availabilityQuery = useQuery({
    queryKey: ["recipe-availability", outletId],
    queryFn: () => getRecipeAvailability(outletId ?? undefined),
    enabled: has("recipes.view") && Boolean(outletId),
    staleTime: 30_000,
  });

  const availabilityByProduct = React.useMemo(
    () => new Map((availabilityQuery.data ?? []).map((row) => [row.productId, row])),
    [availabilityQuery.data]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["recipes"] });
    queryClient.invalidateQueries({ queryKey: ["ingredients"] });
    queryClient.invalidateQueries({ queryKey: ["ingredient-movements"] });
    queryClient.invalidateQueries({ queryKey: ["recipe-availability"] });
    queryClient.invalidateQueries({ queryKey: ["pos-availability"] });
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

  if (!has("recipes.view") && !canEditInventory) {
    return <AccessDenied permission="recipes.view" />;
  }

  const tabs = [
    ...(has("recipes.view") ? [{ id: "recipes", label: "Recipes" }] : []),
    ...(canEditInventory ? [{ id: "ingredients", label: "Ingredients" }] : []),
  ];

  const products = recipesQuery.data ?? [];
  const ingredients = ingredientsQuery.data ?? [];
  const activeTab = tabs.some((entry) => entry.id === tab) ? tab : (tabs[0]?.id ?? "recipes");

  return (
    <>
      <PageHeader
        eyebrow={outletId ? "Ingredient costing" : "Recipes"}
        title="Recipes"
        description="Cost every menu item from its ingredients, and keep ingredient stock accurate as you sell."
        actions={
          <>
            <Link href="/products" className="btn btn--secondary btn--sm">
              Products
            </Link>
            {activeTab === "ingredients" && canManageIngredients ? (
              <Button size="sm" onClick={() => setIngredientForm({})}>
                <Plus aria-hidden="true" />
                New ingredient
              </Button>
            ) : null}
          </>
        }
      />

      <div className="row between wrap" style={{ marginBottom: 14, gap: 10 }}>
        <Tabs items={tabs} value={activeTab} onChange={setTab} />
        <span className="hint" style={{ margin: 0 }}>
          {formatNumber(products.length)} products · {formatNumber(ingredients.length)} ingredients
        </span>
      </div>

      <label className="input-affix" style={{ maxWidth: 420, marginBottom: 14 }}>
        <Search aria-hidden="true" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={activeTab === "recipes" ? "Search products by name or SKU" : "Search ingredients"}
          aria-label={activeTab === "recipes" ? "Search products" : "Search ingredients"}
        />
        {search ? (
          <button type="button" className="icon-btn" onClick={() => setSearch("")} aria-label="Clear search">
            <X aria-hidden="true" />
          </button>
        ) : null}
      </label>

      {activeTab === "recipes" ? (
        <section className="stack">
          {recipesQuery.isLoading ? (
            <div className="card">
              <div className="stack" aria-busy="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div className="skeleton skeleton-row" key={index} />
                ))}
              </div>
            </div>
          ) : recipesQuery.isError ? (
            <div className="card">
              <EmptyState
                icon={<ChefHat aria-hidden="true" />}
                title="Recipes could not be loaded"
                description={recipesQuery.error instanceof Error ? recipesQuery.error.message : "Try again."}
                actions={
                  <Button variant="secondary" onClick={() => recipesQuery.refetch()}>
                    Try again
                  </Button>
                }
              />
            </div>
          ) : products.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Search aria-hidden="true" />}
                title="No products match"
                description="Try a different name or SKU."
              />
            </div>
          ) : (
            <div className="card">
              <div className="record-list">
                {products.map((product) => {
                  const margin = product.price > 0 ? ((product.price - product.recipeCost) / product.price) * 100 : 0;
                  const availability = availabilityByProduct.get(product.id);
                  const capped = availability ? !availability.unlimited : false;
                  return (
                    <div className="record" key={product.id} style={{ alignItems: "center" }}>
                      <div className="row" style={{ minWidth: 0, flex: 1 }}>
                        <span className="avatar" aria-hidden="true">
                          {initials(product.name)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="record__title">{product.name}</div>
                          <div className="record__meta">
                            {product.categoryName || "Uncategorised"} · {product.sku} ·{" "}
                            {product.recipeItems.length}{" "}
                            {product.recipeItems.length === 1 ? "ingredient line" : "ingredient lines"}
                            {capped && availability?.limiting
                              ? ` · limited by ${availability.limiting.ingredientName}`
                              : ""}
                          </div>
                        </div>
                      </div>
                      <div className="row" style={{ gap: 14, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                            {product.recipeItems.length ? formatCurrency(product.recipeCost, currency) : "No recipe"}
                          </div>
                          <div className="hint">
                            {formatCurrency(product.price, currency)} price
                            {product.recipeItems.length ? ` · ${margin.toFixed(0)}% margin` : ""}
                          </div>
                        </div>
                        {product.recipeItems.length === 0 ? (
                          <Badge tone="warning">Uncosted</Badge>
                        ) : margin < 20 ? (
                          <Badge tone="danger">Low margin</Badge>
                        ) : null}
                        {capped && availability ? (
                          <Badge tone={sellableTone(availability)}>{sellableLabel(availability)}</Badge>
                        ) : null}
                        <Button variant="secondary" size="sm" onClick={() => setRecipeTarget(product)}>
                          {canManageRecipes ? "Edit recipe" : "View recipe"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "ingredients" ? (
        <section className="stack">
          {ingredientsQuery.isLoading ? (
            <div className="card">
              <div className="stack" aria-busy="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div className="skeleton skeleton-row" key={index} />
                ))}
              </div>
            </div>
          ) : ingredients.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<ClipboardList aria-hidden="true" />}
                title="No ingredients yet"
                description="Add beans, milk, cups, and anything else you consume, then attach them to products from the Recipes tab."
                actions={
                  canManageIngredients ? (
                    <Button onClick={() => setIngredientForm({})}>
                      <Plus aria-hidden="true" />
                      Add the first ingredient
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="card">
              <div className="record-list">
                {ingredients.map((ingredient) => (
                  <div className="record" key={ingredient.id} style={{ alignItems: "center" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="record__title">
                        {ingredient.name}
                        {!ingredient.active ? (
                          <Badge tone="neutral" style={{ marginLeft: 6 }}>
                            Inactive
                          </Badge>
                        ) : null}
                        {ingredient.lowStock ? (
                          <Badge tone="danger" style={{ marginLeft: 6 }}>
                            Low
                          </Badge>
                        ) : null}
                      </div>
                      <div className="record__meta">
                        {ingredient.unit} · {formatCurrency(ingredient.costPerUnit, currency)} per {ingredient.unit}
                        {ingredient.sku ? ` · ${ingredient.sku}` : ""}
                        {ingredient.trackInventory ? "" : " · untracked"}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 14, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                          {ingredient.trackInventory
                            ? `${formatNumber(ingredient.quantity, "en-GB")} ${ingredient.unit}`
                            : "Not tracked"}
                        </div>
                        <div className="hint">
                          reorder at {formatNumber(ingredient.reorderLevel, "en-GB")} ·{" "}
                          {formatCurrency(ingredient.stockValue, currency)}
                        </div>
                      </div>
                      {canManageIngredients ? (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => setAdjustTarget(ingredient)}>
                            Adjust
                          </Button>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Edit ${ingredient.name}`}
                            onClick={() => setIngredientForm({ ingredient })}
                          >
                            <Pencil aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Delete ${ingredient.name}`}
                            disabled={action.isPending}
                            onClick={() => action.mutate(() => deleteIngredient(ingredient.id))}
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Movements for ${ingredient.name}`}
                        onClick={() => setMovementTarget(ingredient)}
                      >
                        <ClipboardList aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : null}

      <RecipeDialog
        product={recipeTarget}
        availability={
          recipeTarget ? (availabilityByProduct.get(recipeTarget.id) ?? null) : null
        }
        ingredients={ingredients}
        currency={currency}
        canManage={canManageRecipes}
        pending={action.isPending}
        onClose={() => setRecipeTarget(null)}
        onSave={(product, items, variantId) => {
          action.mutate(async () => {
            const saved = await setRecipe(product.id, items, variantId);
            setRecipeTarget(saved);
          });
        }}
      />

      <IngredientDialog
        state={ingredientForm}
        currency={currency}
        outletId={outletId}
        pending={action.isPending}
        onClose={() => setIngredientForm(null)}
        onSubmit={(input) => {
          const current = ingredientForm?.ingredient;
          action.mutate(() =>
            current ? updateIngredient(current.id, input) : createIngredient(input)
          );
          setIngredientForm(null);
        }}
      />

      <AdjustDialog
        ingredient={adjustTarget}
        currency={currency}
        outletId={outletId}
        pending={action.isPending}
        onClose={() => setAdjustTarget(null)}
        onSubmit={(input) => {
          action.mutate(() => adjustIngredient(input));
          setAdjustTarget(null);
        }}
      />

      <MovementsDialog
        ingredient={movementTarget}
        outletId={outletId}
        onClose={() => setMovementTarget(null)}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Recipe editor                                                                */
/* -------------------------------------------------------------------------- */

function RecipeDialog({
  product,
  availability,
  ingredients,
  currency,
  canManage,
  pending,
  onClose,
  onSave,
}: {
  product: RecipeProduct | null;
  availability: ProductAvailability | null;
  ingredients: Ingredient[];
  currency: string;
  canManage: boolean;
  pending: boolean;
  onClose: () => void;
  onSave: (product: RecipeProduct, items: RecipeItemInput[], variantId?: string) => void;
}) {
  const [variantId, setVariantId] = React.useState("");
  const [lines, setLines] = React.useState<RecipeItemInput[]>([]);
  const [addIngredientId, setAddIngredientId] = React.useState("");
  const lastProductId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!product) {
      lastProductId.current = null;
      return;
    }
    // Only reset the editor when a different product is opened, so saving a
    // variant recipe does not kick the user back to the base scope.
    if (lastProductId.current === product.id) return;
    lastProductId.current = product.id;
    setVariantId("");
    setAddIngredientId("");
    setLines(
      scopeLines(product, "").map((line) => ({
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        wastePercent: line.wastePercent,
      }))
    );
  }, [product]);

  const loadScope = (nextVariantId: string) => {
    setVariantId(nextVariantId);
    setAddIngredientId("");
    setLines(
      scopeLines(product, nextVariantId).map((line) => ({
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        wastePercent: line.wastePercent,
      }))
    );
  };

  const variants = product?.variants ?? [];
  const variant = variants.find((entry) => entry.id === variantId);
  const scopeLabel = variantId ? `Variant · ${variant?.name ?? "Variant"}` : "Base recipe";
  const total = lines.reduce((sum, line) => sum + lineCost(line, ingredients), 0);
  const price = variant?.price ?? product?.price ?? 0;
  const margin = price > 0 ? ((price - total) / price) * 100 : 0;

  const available = ingredients.filter(
    (ingredient) =>
      ingredient.active && !lines.some((line) => line.ingredientId === ingredient.id)
  );

  const updateLine = (ingredientId: string, patch: Partial<RecipeItemInput>) => {
    setLines((current) =>
      current.map((line) => (line.ingredientId === ingredientId ? { ...line, ...patch } : line))
    );
  };

  const addLine = () => {
    if (!addIngredientId) return;
    setLines((current) =>
      current.some((line) => line.ingredientId === addIngredientId)
        ? current
        : [...current, { ingredientId: addIngredientId, quantity: 1, wastePercent: 0 }]
    );
    setAddIngredientId("");
  };

  return (
    <Dialog
      open={Boolean(product)}
      onClose={onClose}
      title={product ? `Recipe · ${product.name}` : "Recipe"}
      description="Quantities are for one unit sold. Waste is added on top of the quantity."
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {canManage ? (
            <Button
              variant="primary"
              loading={pending}
              disabled={lines.some((line) => !Number(line.quantity))}
              onClick={() => product && onSave(product, lines, variantId || undefined)}
            >
              Save {scopeLabel.toLowerCase()}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="stack">
        {variants.length ? (
          <Field label="Scope" hint="Variant recipes start from the base recipe; add a line here to override it.">
            <Select value={variantId} onChange={(event) => loadScope(event.target.value)}>
              <option value="">Base recipe (all variants)</option>
              {variants.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="row between" style={{ gap: 8 }}>
          <span className="hint" style={{ margin: 0 }}>
            {scopeLabel}
          </span>
          <span className="hint" style={{ margin: 0 }}>
            {formatCurrency(total, currency)} · {margin.toFixed(0)}% margin
          </span>
        </div>

        {availability ? (
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <Badge tone={sellableTone(availability)}>{sellableLabel(availability)}</Badge>
            {availability.limiting ? (
              <span className="hint" style={{ margin: 0 }}>
                {availability.limiting.ingredientName} runs out first ·{" "}
                {formatNumber(availability.limiting.available, "en-GB")}{" "}
                {availability.limiting.unit} left, {formatNumber(availability.limiting.requiredPerUnit, "en-GB")}{" "}
                {availability.limiting.unit} per unit
              </span>
            ) : (
              <span className="hint" style={{ margin: 0 }}>
                Nothing tracked limits this item, so it stays sellable.
              </span>
            )}
          </div>
        ) : null}

        {lines.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            No ingredients yet. Add the first one below.
          </p>
        ) : (
          <div className="stack-sm">
            {lines.map((line) => {
              const ingredient = ingredients.find((entry) => entry.id === line.ingredientId);
              return (
                <div className="row" key={line.ingredientId} style={{ gap: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{ingredient?.name ?? "Ingredient"}</div>
                    <div className="hint">
                      {ingredient?.unit ?? ""} ·{" "}
                      {formatCurrency(lineCost(line, ingredients), currency)}
                    </div>
                  </div>
                  <Field label="Qty">
                    <Input
                      type="number"
                      min={0.0001}
                      step="0.0001"
                      inputMode="decimal"
                      value={line.quantity}
                      disabled={!canManage}
                      onChange={(event) =>
                        updateLine(line.ingredientId, { quantity: Number(event.target.value) || 0 })
                      }
                      style={{ width: 92 }}
                    />
                  </Field>
                  <Field label="Waste %">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      inputMode="decimal"
                      value={line.wastePercent ?? 0}
                      disabled={!canManage}
                      onChange={(event) =>
                        updateLine(line.ingredientId, { wastePercent: Number(event.target.value) || 0 })
                      }
                      style={{ width: 82 }}
                    />
                  </Field>
                  {canManage ? (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove ${ingredient?.name ?? "line"}`}
                      onClick={() =>
                        setLines((current) =>
                          current.filter((entry) => entry.ingredientId !== line.ingredientId)
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {canManage ? (
          <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Field label="Add ingredient">
                <Select
                  value={addIngredientId}
                  onChange={(event) => setAddIngredientId(event.target.value)}
                >
                  <option value="">Choose an ingredient</option>
                  {available.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name} ({ingredient.unit})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button variant="secondary" disabled={!addIngredientId} onClick={addLine}>
              <Plus aria-hidden="true" />
              Add
            </Button>
          </div>
        ) : null}

        {!ingredients.length ? (
          <p className="hint" style={{ margin: 0 }}>
            <UtensilsCrossed aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: -2 }} /> Add
            ingredients from the Ingredients tab first.
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Ingredient form                                                              */
/* -------------------------------------------------------------------------- */

function IngredientDialog({
  state,
  currency,
  outletId,
  pending,
  onClose,
  onSubmit,
}: {
  state: { ingredient?: Ingredient } | null;
  currency: string;
  outletId: string | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: IngredientInput) => void;
}) {
  const ingredient = state?.ingredient;
  const [name, setName] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [unit, setUnit] = React.useState("g");
  const [costPerUnit, setCostPerUnit] = React.useState("0");
  const [reorderLevel, setReorderLevel] = React.useState("0");
  const [trackInventory, setTrackInventory] = React.useState(true);
  const [openingQuantity, setOpeningQuantity] = React.useState("0");

  React.useEffect(() => {
    if (!state) return;
    setName(ingredient?.name ?? "");
    setSku(ingredient?.sku ?? "");
    setUnit(ingredient?.unit ?? "g");
    setCostPerUnit(String(ingredient?.costPerUnit ?? 0));
    setReorderLevel(String(ingredient?.reorderLevel ?? 0));
    setTrackInventory(ingredient?.trackInventory ?? true);
    setOpeningQuantity("0");
  }, [state, ingredient]);

  return (
    <Dialog
      open={Boolean(state)}
      onClose={onClose}
      title={ingredient ? "Edit ingredient" : "New ingredient"}
      description="Costs are per unit and feed every recipe that uses this ingredient."
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!name.trim()}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                sku: sku.trim() || undefined,
                unit: unit.trim() || "g",
                costPerUnit: Number(costPerUnit) || 0,
                reorderLevel: Number(reorderLevel) || 0,
                trackInventory,
                ...(ingredient ? {} : { openingQuantity: Number(openingQuantity) || 0, outletId: outletId ?? undefined }),
              })
            }
          >
            {ingredient ? "Save ingredient" : "Create ingredient"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Name" required>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Espresso beans, Fresh milk, Cup 12oz"
            autoFocus
          />
        </Field>
        <div className="row" style={{ gap: 10 }}>
          <Field label="SKU">
            <Input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="BEAN-ESP" />
          </Field>
          <Field label="Unit" hint="g, ml, pcs">
            <Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="g" />
          </Field>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Field label={`Cost per unit (${currency})`}>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={costPerUnit}
              onChange={(event) => setCostPerUnit(event.target.value)}
            />
          </Field>
          <Field label="Reorder level">
            <Input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={reorderLevel}
              onChange={(event) => setReorderLevel(event.target.value)}
            />
          </Field>
        </div>
        {!ingredient ? (
          <Field
            label="Opening stock"
            hint={
              outletId
                ? `Added to ${(outletId && "this outlet") || "the active outlet"} as an adjustment.`
                : "Select an outlet to record opening stock."
            }
          >
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={openingQuantity}
              disabled={!outletId}
              onChange={(event) => setOpeningQuantity(event.target.value)}
            />
          </Field>
        ) : null}
        <Checkbox
          label="Track stock"
          description="Untracked ingredients still cost recipes but are never deducted on sales."
          checked={trackInventory}
          onChange={(event) => setTrackInventory(event.target.checked)}
        />
      </div>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Stock adjustment                                                             */
/* -------------------------------------------------------------------------- */

function AdjustDialog({
  ingredient,
  currency,
  outletId,
  pending,
  onClose,
  onSubmit,
}: {
  ingredient: Ingredient | null;
  currency: string;
  outletId: string | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: IngredientAdjustInput) => void;
}) {
  const [mode, setMode] = React.useState<"add" | "remove">("add");
  const [quantity, setQuantity] = React.useState("0");
  const [type, setType] = React.useState<IngredientAdjustInput["type"]>("purchase");
  const [unitCost, setUnitCost] = React.useState("");
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!ingredient) return;
    setMode("add");
    setQuantity("");
    setType("purchase");
    setUnitCost(String(ingredient.costPerUnit));
    setReason("");
  }, [ingredient]);

  const amount = Number(quantity) || 0;
  const signed = mode === "remove" ? -Math.abs(amount) : Math.abs(amount);
  const projected = (ingredient?.quantity ?? 0) + signed;

  return (
    <Dialog
      open={Boolean(ingredient)}
      onClose={onClose}
      title={ingredient ? `Adjust ${ingredient.name}` : "Adjust stock"}
      description="Use purchases for deliveries, wastage for spoilage, and adjustment for stocktakes."
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!ingredient || !outletId || signed === 0 || !reason.trim()}
            onClick={() => {
              if (!ingredient || !outletId) return;
              onSubmit({
                ingredientId: ingredient.id,
                outletId,
                quantity: signed,
                type,
                unitCost: unitCost === "" ? undefined : Number(unitCost),
                reason: reason.trim(),
              });
            }}
          >
            Save adjustment
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="row" style={{ gap: 8 }}>
          <Button
            variant={mode === "add" ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setMode("add");
              setType("purchase");
            }}
          >
            Add stock
          </Button>
          <Button
            variant={mode === "remove" ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setMode("remove");
              setType("wastage");
            }}
          >
            Remove stock
          </Button>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <Field label={`Quantity (${ingredient?.unit ?? ""})`} required>
            <Input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(event) => setType(event.target.value as IngredientAdjustInput["type"])}>
              <option value="purchase">Purchase</option>
              <option value="adjustment">Adjustment</option>
              <option value="wastage">Wastage</option>
              <option value="expired">Expired</option>
            </Select>
          </Field>
        </div>

        <Field label={`Unit cost (${currency})`} hint="Updates the ingredient cost used by recipes.">
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={unitCost}
            onChange={(event) => setUnitCost(event.target.value)}
          />
        </Field>

        <Field label="Reason" required>
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Delivery, stocktake correction, spoiled milk"
          />
        </Field>

        <p className="hint" style={{ margin: 0 }}>
          {formatNumber(ingredient?.quantity ?? 0, "en-GB")} →{" "}
          <b style={{ color: projected < 0 ? "var(--danger)" : undefined }}>
            {formatNumber(projected, "en-GB")} {ingredient?.unit ?? ""}
          </b>
          {projected < 0 ? " · cannot go below zero" : ""}
        </p>
      </div>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Movement history                                                             */
/* -------------------------------------------------------------------------- */

function MovementsDialog({
  ingredient,
  outletId,
  onClose,
}: {
  ingredient: Ingredient | null;
  outletId: string | null;
  onClose: () => void;
}) {
  const movementsQuery = useQuery({
    queryKey: ["ingredient-movements", ingredient?.id, outletId],
    queryFn: () =>
      listIngredientMovements({
        ingredientId: ingredient?.id,
        outletId: outletId ?? undefined,
      }),
    enabled: Boolean(ingredient),
    staleTime: 15_000,
  });

  const movements = movementsQuery.data?.data ?? [];

  return (
    <Dialog
      open={Boolean(ingredient)}
      onClose={onClose}
      title={ingredient ? `${ingredient.name} movements` : "Movements"}
      description="Every stock change, newest first."
      width={520}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {movementsQuery.isLoading ? (
        <div className="stack" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="skeleton skeleton-row" key={index} />
          ))}
        </div>
      ) : movements.length === 0 ? (
        <EmptyState
          compact
          icon={<ClipboardList aria-hidden="true" />}
          title="No movements yet"
          description="Purchases, sales, and adjustments will appear here."
        />
      ) : (
        <div className="stack-sm" style={{ maxHeight: 420, overflowY: "auto" }}>
          {movements.map((movement: IngredientMovement) => (
            <div
              className="row between"
              key={movement.id}
              style={{ gap: 10, alignItems: "flex-start", paddingBottom: 8 }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}>
                  <Badge tone={movementTone(movement.type)}>{MOVEMENT_LABEL[movement.type] ?? movement.type}</Badge>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {movement.quantity > 0 ? "+" : ""}
                    {formatNumber(movement.quantity, "en-GB")} {ingredient?.unit ?? ""}
                  </span>
                </div>
                <div className="hint">
                  {movement.reason || "—"}
                  {movement.actorName ? ` · ${movement.actorName}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="hint" style={{ margin: 0 }}>
                  {format(new Date(movement.createdAt), "d MMM, HH:mm")}
                </div>
                <div className="hint" style={{ margin: 0 }}>
                  balance {formatNumber(movement.balanceAfter, "en-GB")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
