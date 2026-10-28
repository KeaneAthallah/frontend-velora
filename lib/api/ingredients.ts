import { apiRequest, USE_MOCK_API } from "./client";
import {
  mockDb,
  mockId,
  mockIngredientBalance,
  mockRecipeCost,
  mockRecipeLines,
} from "./mock-db";
import { normalizeProduct } from "./products";
import type {
  Ingredient,
  IngredientMovement,
  Paginated,
  Product,
  RecipeLine,
  RecipeProduct,
} from "./types";

export type IngredientInput = {
  name: string;
  sku?: string;
  unit?: string;
  costPerUnit?: number;
  reorderLevel?: number;
  trackInventory?: boolean;
  active?: boolean;
  openingQuantity?: number;
  outletId?: string;
};

export type IngredientAdjustInput = {
  ingredientId: string;
  outletId?: string;
  quantity: number;
  type?: "adjustment" | "purchase" | "wastage" | "expired";
  unitCost?: number;
  reason: string;
};

export type RecipeItemInput = {
  ingredientId: string;
  quantity: number;
  wastePercent?: number;
  notes?: string;
};

function normalizeIngredient(raw: any): Ingredient {
  return {
    id: String(raw.id),
    name: raw.name ?? "",
    sku: raw.sku ?? undefined,
    unit: raw.unit ?? "g",
    costPerUnit: Number(raw.cost_per_unit ?? raw.costPerUnit ?? 0),
    reorderLevel: Number(raw.reorder_level ?? raw.reorderLevel ?? 0),
    trackInventory: raw.track_inventory ?? raw.trackInventory ?? true,
    active: raw.is_active ?? raw.active ?? true,
    quantity: Number(raw.quantity ?? 0),
    stockValue: Number(raw.stock_value ?? raw.stockValue ?? 0),
    lowStock: Boolean(raw.low_stock ?? raw.lowStock ?? false),
  };
}

function normalizeMovement(raw: any): IngredientMovement {
  const unitCost = raw.unit_cost ?? raw.unitCost;
  const referenceId = raw.reference_id ?? raw.referenceId;

  return {
    id: String(raw.id),
    ingredientId: String(raw.ingredient_id ?? raw.ingredientId ?? ""),
    ingredientName: raw.ingredient?.name ?? raw.ingredient_name ?? raw.ingredientName ?? undefined,
    outletId: String(raw.outlet_id ?? raw.outletId ?? ""),
    type: raw.type ?? "adjustment",
    quantity: Number(raw.quantity ?? 0),
    unitCost: unitCost === undefined || unitCost === null ? undefined : Number(unitCost),
    balanceAfter: Number(raw.balance_after ?? raw.balanceAfter ?? 0),
    referenceType: raw.reference_type ?? raw.referenceType ?? undefined,
    referenceId: referenceId === undefined || referenceId === null ? undefined : String(referenceId),
    reason: raw.reason ?? undefined,
    actorName: raw.actor?.name ?? raw.actor_name ?? raw.actorName ?? undefined,
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
  };
}

function normalizeLine(raw: any): RecipeLine {
  return {
    id: raw.id ? String(raw.id) : undefined,
    productVariantId: raw.product_variant_id
      ? String(raw.product_variant_id)
      : raw.productVariantId
        ? String(raw.productVariantId)
        : undefined,
    ingredientId: String(raw.ingredient_id ?? raw.ingredientId ?? ""),
    ingredientName: raw.ingredient_name ?? raw.ingredientName ?? raw.ingredient?.name ?? "",
    unit: raw.unit ?? raw.ingredient?.unit ?? "",
    unitCost: Number(raw.unit_cost ?? raw.unitCost ?? 0),
    quantity: Number(raw.quantity ?? 0),
    wastePercent: Number(raw.waste_percent ?? raw.wastePercent ?? 0),
    effectiveQuantity: Number(raw.effective_quantity ?? raw.effectiveQuantity ?? raw.quantity ?? 0),
    lineCost: Number(raw.line_cost ?? raw.lineCost ?? 0),
    notes: raw.notes ?? undefined,
  };
}

function normalizeRecipeProduct(raw: any): RecipeProduct {
  const product = normalizeProduct(raw) as RecipeProduct;
  product.recipeItems = (raw.recipe_items ?? raw.recipeItems ?? []).map(normalizeLine);
  product.recipeCost = Number(raw.recipe_cost ?? raw.recipeCost ?? 0);
  const costs = raw.variant_costs ?? raw.variantCosts ?? {};
  product.variantCosts = Object.fromEntries(
    Object.entries(costs).map(([key, value]) => [String(key), Number(value)])
  );
  return product;
}

function ingredientBody(input: Partial<IngredientInput>) {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.sku !== undefined) body.sku = input.sku || null;
  if (input.unit !== undefined) body.unit = input.unit;
  if (input.costPerUnit !== undefined) body.cost_per_unit = input.costPerUnit;
  if (input.reorderLevel !== undefined) body.reorder_level = input.reorderLevel;
  if (input.trackInventory !== undefined) body.track_inventory = input.trackInventory;
  if (input.active !== undefined) body.is_active = input.active;
  return body;
}

function mockIngredient(raw: Ingredient, outletId?: string): Ingredient {
  const quantity = outletId ? mockIngredientBalance(outletId, raw.id) : 0;
  return {
    ...raw,
    quantity,
    stockValue: quantity * raw.costPerUnit,
    lowStock: raw.trackInventory && quantity <= raw.reorderLevel,
  };
}

function mockRecipeProduct(product: Product): RecipeProduct {
  const lines: RecipeLine[] = mockRecipeLines(product.id).map((line) => ({
    id: line.item.id,
    productVariantId: line.item.productVariantId,
    ingredientId: line.item.ingredientId,
    ingredientName: line.ingredient?.name ?? "",
    unit: line.ingredient?.unit ?? "",
    unitCost: line.ingredient?.costPerUnit ?? 0,
    quantity: line.item.quantity,
    wastePercent: line.item.wastePercent ?? 0,
    effectiveQuantity: Number(line.effective.toFixed(4)),
    lineCost: Number(line.lineCost.toFixed(4)),
    notes: undefined,
  }));

  const variantCosts: Record<string, number> = {};
  product.variants?.forEach((variant) => {
    variantCosts[variant.id] = mockRecipeCost(product.id, variant.id);
  });

  return {
    ...product,
    recipeItems: lines,
    recipeCost: mockRecipeCost(product.id),
    variantCosts,
  };
}

export async function listIngredients(params?: {
  outletId?: string;
  q?: string;
  active?: boolean;
}): Promise<Ingredient[]> {
  if (USE_MOCK_API) {
    const query = (params?.q ?? "").trim().toLowerCase();
    return mockDb.ingredients
      .filter((ingredient) => (params?.active === undefined ? true : ingredient.active === params.active))
      .filter((ingredient) => {
        if (!query) return true;
        return (
          ingredient.name.toLowerCase().includes(query) ||
          (ingredient.sku ?? "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((ingredient) => mockIngredient(ingredient, params?.outletId));
  }

  const search = new URLSearchParams();
  if (params?.outletId) search.set("outlet_id", params.outletId);
  if (params?.q) search.set("q", params.q);
  if (params?.active !== undefined) search.set("active", params.active ? "1" : "0");
  const data = await apiRequest<any>(`/ingredients${search.size ? `?${search.toString()}` : ""}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map(normalizeIngredient);
}

export async function createIngredient(input: IngredientInput): Promise<Ingredient> {
  if (USE_MOCK_API) {
    const ingredient: Ingredient = {
      id: mockId("ing"),
      name: input.name,
      sku: input.sku,
      unit: input.unit ?? "g",
      costPerUnit: input.costPerUnit ?? 0,
      reorderLevel: input.reorderLevel ?? 0,
      trackInventory: input.trackInventory ?? true,
      active: input.active ?? true,
      quantity: 0,
      stockValue: 0,
      lowStock: false,
    };
    mockDb.ingredients = [...mockDb.ingredients, ingredient];

    const opening = input.openingQuantity ?? 0;
    if (input.outletId && opening !== 0) {
      mockDb.ingredientBalances[`${input.outletId}:${ingredient.id}`] = opening;
      mockDb.ingredientMovements.unshift({
        id: mockId("im"),
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        outletId: input.outletId,
        type: "adjustment",
        quantity: opening,
        unitCost: ingredient.costPerUnit,
        balanceAfter: opening,
        reason: "Opening stock",
        createdAt: new Date().toISOString(),
      });
    }

    return mockIngredient(ingredient, input.outletId);
  }

  const data = await apiRequest<any>("/ingredients", {
    method: "POST",
    body: {
      ...ingredientBody(input),
      opening_quantity: input.openingQuantity ?? 0,
      outlet_id: input.outletId ? Number(input.outletId) : undefined,
    },
  });
  return normalizeIngredient(data);
}

export async function updateIngredient(
  id: string,
  input: Partial<IngredientInput>
): Promise<Ingredient> {
  if (USE_MOCK_API) {
    const index = mockDb.ingredients.findIndex((ingredient) => ingredient.id === id);
    if (index < 0) throw new Error("Ingredient not found");
    mockDb.ingredients[index] = {
      ...mockDb.ingredients[index],
      ...("name" in input ? { name: input.name ?? "" } : {}),
      ...("sku" in input ? { sku: input.sku || undefined } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.costPerUnit !== undefined ? { costPerUnit: input.costPerUnit } : {}),
      ...(input.reorderLevel !== undefined ? { reorderLevel: input.reorderLevel } : {}),
      ...(input.trackInventory !== undefined ? { trackInventory: input.trackInventory } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    };
    return mockIngredient(mockDb.ingredients[index], input.outletId);
  }

  const data = await apiRequest<any>(`/ingredients/${id}`, {
    method: "PUT",
    body: ingredientBody(input),
  });
  return normalizeIngredient(data);
}

export async function deleteIngredient(id: string): Promise<void> {
  if (USE_MOCK_API) {
    const used =
      mockDb.recipeItems.some((item) => item.ingredientId === id) ||
      mockDb.ingredientMovements.some((movement) => movement.ingredientId === id);
    if (used) throw new Error("Ingredient is used by recipes or stock history; deactivate it instead");
    mockDb.ingredients = mockDb.ingredients.filter((ingredient) => ingredient.id !== id);
    Object.keys(mockDb.ingredientBalances)
      .filter((key) => key.endsWith(`:${id}`))
      .forEach((key) => delete mockDb.ingredientBalances[key]);
    return;
  }
  await apiRequest<void>(`/ingredients/${id}`, { method: "DELETE" });
}

export async function adjustIngredient(input: IngredientAdjustInput): Promise<Ingredient> {
  if (USE_MOCK_API) {
    const ingredient = mockDb.ingredients.find((item) => item.id === input.ingredientId);
    if (!ingredient) throw new Error("Ingredient not found");
    if (!input.outletId) throw new Error("Outlet required");
    if (input.quantity === 0) throw new Error("Quantity cannot be zero");

    const key = `${input.outletId}:${ingredient.id}`;
    const next = Number(((mockDb.ingredientBalances[key] ?? 0) + input.quantity).toFixed(4));
    if (next < 0) throw new Error("Quantity cannot go below zero");

    mockDb.ingredientBalances[key] = next;
    if (input.unitCost !== undefined) ingredient.costPerUnit = input.unitCost;

    mockDb.ingredientMovements.unshift({
      id: mockId("im"),
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      outletId: input.outletId,
      type: input.type ?? "adjustment",
      quantity: input.quantity,
      unitCost: input.unitCost ?? ingredient.costPerUnit,
      balanceAfter: next,
      reason: input.reason,
      createdAt: new Date().toISOString(),
    });

    return mockIngredient(ingredient, input.outletId);
  }

  const data = await apiRequest<any>("/ingredients/adjust", {
    method: "POST",
    body: {
      ingredient_id: Number(input.ingredientId),
      outlet_id: input.outletId ? Number(input.outletId) : undefined,
      quantity: input.quantity,
      type: input.type ?? "adjustment",
      unit_cost: input.unitCost,
      reason: input.reason,
    },
  });
  return normalizeIngredient(data);
}

export async function listIngredientMovements(params?: {
  outletId?: string;
  ingredientId?: string;
  type?: string;
}): Promise<Paginated<IngredientMovement>> {
  if (USE_MOCK_API) {
    const items = mockDb.ingredientMovements
      .filter((movement) => (params?.outletId ? movement.outletId === params.outletId : true))
      .filter((movement) =>
        params?.ingredientId ? movement.ingredientId === params.ingredientId : true
      )
      .filter((movement) => (params?.type ? movement.type === params.type : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      data: items.map((movement) => ({ ...movement })),
      page: 1,
      pageSize: items.length,
      total: items.length,
      totalPages: 1,
    };
  }

  const search = new URLSearchParams();
  if (params?.outletId) search.set("outlet_id", params.outletId);
  if (params?.ingredientId) search.set("ingredient_id", params.ingredientId);
  if (params?.type) search.set("type", params.type);
  const data = await apiRequest<any>(
    `/ingredient-movements${search.size ? `?${search.toString()}` : ""}`
  );
  return {
    data: (data.data ?? []).map(normalizeMovement),
    page: data.current_page ?? 1,
    pageSize: data.per_page ?? 100,
    total: data.total ?? 0,
    totalPages: data.last_page ?? 1,
  };
}

export async function listRecipes(params?: {
  q?: string;
  categoryId?: string;
  withRecipe?: boolean;
}): Promise<RecipeProduct[]> {
  if (USE_MOCK_API) {
    const query = (params?.q ?? "").trim().toLowerCase();
    return mockDb.products
      .filter((product) => product.active)
      .filter((product) => (params?.categoryId ? product.categoryId === params.categoryId : true))
      .filter((product) => {
        if (!query) return true;
        return (
          product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query)
        );
      })
      .map(mockRecipeProduct)
      .filter((product) => (params?.withRecipe ? product.recipeItems.length > 0 : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.categoryId) search.set("category_id", params.categoryId);
  if (params?.withRecipe) search.set("with_recipe", "1");
  const data = await apiRequest<any>(`/recipes${search.size ? `?${search.toString()}` : ""}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map(normalizeRecipeProduct);
}

export async function getRecipe(productId: string): Promise<RecipeProduct> {
  if (USE_MOCK_API) {
    const product = mockDb.products.find((item) => item.id === productId);
    if (!product) throw new Error("Product not found");
    return mockRecipeProduct(product);
  }
  const data = await apiRequest<any>(`/products/${productId}/recipe`);
  return normalizeRecipeProduct(data);
}

export async function setRecipe(
  productId: string,
  items: RecipeItemInput[],
  variantId?: string
): Promise<RecipeProduct> {
  if (USE_MOCK_API) {
    const product = mockDb.products.find((item) => item.id === productId);
    if (!product) throw new Error("Product not found");

    const ingredientIds = new Set(items.map((item) => item.ingredientId));
    if (ingredientIds.size !== items.length) {
      throw new Error("Each ingredient can appear once per recipe scope");
    }

    for (const item of items) {
      if (!mockDb.ingredients.some((ingredient) => ingredient.id === item.ingredientId)) {
        throw new Error("One or more ingredients were not found");
      }
    }

    mockDb.recipeItems = mockDb.recipeItems.filter((item) => {
      if (item.productId !== productId) return true;
      return variantId ? item.productVariantId !== variantId : Boolean(item.productVariantId);
    });

    if (items.length) {
      mockDb.recipeItems = [
        ...mockDb.recipeItems,
        ...items.map((item) => ({
          id: mockId("ri"),
          productId,
          productVariantId: variantId,
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          wastePercent: item.wastePercent ?? 0,
        })),
      ];
    }

    return mockRecipeProduct(product);
  }

  const data = await apiRequest<any>(`/products/${productId}/recipe`, {
    method: "PUT",
    body: {
      product_variant_id: variantId ? Number(variantId) : undefined,
      items: items.map((item) => ({
        ingredient_id: Number(item.ingredientId),
        quantity: item.quantity,
        waste_percent: item.wastePercent ?? 0,
        notes: item.notes,
      })),
    },
  });
  return normalizeRecipeProduct(data);
}
