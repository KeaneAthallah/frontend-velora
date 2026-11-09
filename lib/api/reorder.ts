import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId, mockIngredientBalance } from "./mock-db";
import type {
  ReorderConsumption,
  ReorderDraft,
  ReorderForecast,
  ReorderIngredient,
  ReorderIngredientForecast,
  ReorderMethod,
  ReorderParcel,
  ReorderPhotoPattern,
  ReorderWasteRisk,
} from "./types";

export type ReorderModelFlags = {
  demand?: boolean;
  shelfLife?: boolean;
  leadTime?: boolean;
};

export type ReorderForecastParams = {
  /** Start of the historical lookback. The API defaults to 14 days ago. */
  from?: string;
  until?: string;
  /** Lead time used when an ingredient has none of its own. */
  defaultLeadDays?: number;
  /** Days of cover to keep on top of the lead time. */
  minCoverageDays?: number;
  forecastAt?: string;
  models?: ReorderModelFlags;
};

const DEFAULT_MODELS: Required<ReorderModelFlags> = {
  demand: true,
  shelfLife: true,
  leadTime: true,
};

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pick(raw: any, camel: string, snake: string) {
  return raw?.[camel] ?? raw?.[snake];
}

function normalizeWasteRisk(raw: any): ReorderWasteRisk | null {
  if (!raw) return null;
  return {
    likelyWasteQuantity: number(pick(raw, "likelyWasteQuantity", "likely_waste_quantity")),
    note: String(raw.note ?? ""),
  };
}

function normalizeParcel(raw: any): ReorderParcel {
  return {
    parcelQuantity: number(pick(raw, "parcelQuantity", "parcel_quantity")),
    parcelCost: number(pick(raw, "parcelCost", "parcel_cost")),
    supplierId: String(pick(raw, "supplierId", "supplier_id") ?? ""),
    supplierName: pick(raw, "supplierName", "supplier_name") ?? undefined,
    supplierLeadTimeDays: optionalNumber(
      pick(raw, "supplierLeadTimeDays", "supplier_lead_time_days")
    ),
  };
}

function normalizePhotoPattern(raw: any): ReorderPhotoPattern | null {
  if (!raw) return null;
  const parcels = raw.suggestedParcels ?? raw.suggested_parcels ?? [];
  return {
    patternId: String(pick(raw, "patternId", "pattern_id") ?? ""),
    name: String(raw.name ?? ""),
    consumptionRate: number(pick(raw, "consumptionRate", "consumption_rate")),
    photoShareEstimate: number(pick(raw, "photoShareEstimate", "photo_share_estimate")),
    suggestedParcels: (Array.isArray(parcels) ? parcels : []).map(normalizeParcel),
  };
}

function normalizeForecast(raw: any): ReorderIngredientForecast {
  return {
    method: (raw?.method ?? "none") as ReorderMethod,
    dailyDemand: number(pick(raw, "dailyDemand", "daily_demand")),
    leadTimeDemand: number(pick(raw, "leadTimeDemand", "lead_time_demand")),
    targetStock: optionalNumber(pick(raw, "targetStock", "target_stock")),
    currentStock: number(pick(raw, "currentStock", "current_stock")),
    reorderQuantity: number(pick(raw, "reorderQuantity", "reorder_quantity")),
    reorderQuantityUnit: String(
      pick(raw, "reorderQuantityUnit", "reorder_quantity_unit") ?? ""
    ),
    reorderReason: String(pick(raw, "reorderReason", "reorder_reason") ?? ""),
    predictedStockAtReorderDate: number(
      pick(raw, "predictedStockAtReorderDate", "predicted_stock_at_reorder_date")
    ),
    daysOfStockRemaining: optionalNumber(
      pick(raw, "daysOfStockRemaining", "days_of_stock_remaining")
    ),
    wasteRisk: normalizeWasteRisk(pick(raw, "wasteRisk", "waste_risk")),
    blindSpot: raw?.blindSpot ?? raw?.blind_spot ?? null,
    shelfLifeNote: raw?.shelfLifeNote ?? raw?.shelf_life_note ?? null,
    leadTimeDays: optionalNumber(pick(raw, "leadTimeDays", "lead_time_days")),
  };
}

function normalizeConsumption(raw: any): ReorderConsumption {
  return {
    theoretical: number(raw?.theoretical),
    soldUnits: number(pick(raw, "soldUnits", "sold_units")),
    recipeDriven: Boolean(pick(raw, "recipeDriven", "recipe_driven")),
  };
}

function normalizeIngredient(raw: any): ReorderIngredient {
  return {
    id: String(raw.id),
    name: raw.name ?? "",
    sku: raw.sku ?? undefined,
    unit: raw.unit ?? "",
    costPerUnit: number(pick(raw, "costPerUnit", "cost_per_unit")),
    currentStock: number(pick(raw, "currentStock", "current_stock")),
    reorderLevel: number(pick(raw, "reorderLevel", "reorder_level")),
    shelfLifeDays: number(pick(raw, "shelfLifeDays", "shelf_life_days")),
    isTracked: Boolean(pick(raw, "isTracked", "is_tracked")),
    leadTimeDays: number(pick(raw, "leadTimeDays", "lead_time_days")),
    photoPattern: normalizePhotoPattern(pick(raw, "photoPattern", "photo_pattern")),
    forecast: normalizeForecast(raw.forecast),
    consumption: normalizeConsumption(raw.consumption),
  };
}

function forecastQuery(params: ReorderForecastParams) {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.until) query.set("until", params.until);
  if (params.defaultLeadDays !== undefined) {
    query.set("defaultLeadDays", String(params.defaultLeadDays));
  }
  if (params.minCoverageDays !== undefined) {
    query.set("minCoverageDays", String(params.minCoverageDays));
  }
  if (params.forecastAt) query.set("forecastAt", params.forecastAt);
  for (const [key, value] of Object.entries(params.models ?? {})) {
    if (value === undefined) continue;
    query.set(`models[${key}]`, value ? "1" : "0");
  }
  return query.toString();
}

/**
 * Read-only demand forecast. Drafting a purchase order is `draftPurchaseOrder`.
 */
export async function getReorderForecast(
  params: ReorderForecastParams = {}
): Promise<ReorderForecast> {
  if (USE_MOCK_API) return mockReorderForecast(params);

  const query = forecastQuery(params);
  const raw = await apiRequest<any>(`/reorder/forecast${query ? `?${query}` : ""}`);
  const models = { ...DEFAULT_MODELS, ...(raw?.settings?.models ?? {}) };
  const parcels = raw?.suggestedParcelsByProduct ?? raw?.suggested_parcels_by_product ?? {};

  return {
    forecastAt: raw?.forecastAt ?? raw?.forecast_at ?? new Date().toISOString(),
    lookback: {
      from: raw?.lookback?.from ?? "",
      until: raw?.lookback?.until ?? "",
      days: number(raw?.lookback?.days),
    },
    settings: {
      defaultLeadDays: number(pick(raw?.settings, "defaultLeadDays", "default_lead_days"), 7),
      minCoverageDays: number(
        pick(raw?.settings, "minCoverageDays", "min_coverage_days"),
        7
      ),
      models,
    },
    ingredients: (raw?.ingredients ?? []).map(normalizeIngredient),
    purchaseMoneyBudget: {
      amount: number(pick(raw?.purchaseMoneyBudget, "amount", "amount")),
      currency: raw?.purchaseMoneyBudget?.currency ?? "IDR",
      note: raw?.purchaseMoneyBudget?.note ?? "",
    },
    suggestedParcelsByProduct: Object.fromEntries(
      Object.entries(parcels).map(([productId, list]) => [
        String(productId),
        (Array.isArray(list) ? list : []).map(normalizeParcel),
      ])
    ),
  };
}

/**
 * Turn the forecast into a draft purchase order. The lines are ingredients, so
 * the order is received into ingredient stock, not product inventory.
 */
export async function draftPurchaseOrder(
  params: { supplierId?: string; budget?: number } = {}
): Promise<ReorderDraft> {
  if (USE_MOCK_API) return mockReorderDraft();

  const raw = await apiRequest<any>("/reorder/suggest", {
    method: "POST",
    body: {
      supplierId: params.supplierId ? Number(params.supplierId) : undefined,
      budget: params.budget,
    },
  });

  const order = raw?.purchaseOrder ?? {};
  const lines = Array.isArray(order.items) ? order.items : [];

  return {
    purchaseOrder: {
      id: String(order.id ?? ""),
      number: order.number ?? "",
      status: order.status ?? "draft",
      total: number(order.total),
      itemCount: lines.length,
      items: lines.map((line: any) => ({
        id: String(line.id ?? ""),
        ingredientId: line.ingredientId != null ? String(line.ingredientId) : "",
        name: line.ingredientName ?? line.productName ?? "",
        quantity: number(line.quantity),
        unit: line.unit ?? null,
        total: number(line.estimatedTotal),
      })),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Mock                                                                       */
/* -------------------------------------------------------------------------- */

function mockReorderDraft(): ReorderDraft {
  return {
    purchaseOrder: {
      id: mockId("po"),
      number: "PO-DEMO01",
      status: "draft",
      total: 90000,
      itemCount: 1,
      items: [
        {
          id: mockId("poi"),
          ingredientId: mockDb.ingredients[0]?.id ?? "ing-1",
          name: mockDb.ingredients[0]?.name ?? "Espresso Beans",
          quantity: 1000,
          unit: "g",
          total: 90000,
        },
      ],
    },
  };
}

function mockReorderForecast(params: ReorderForecastParams = {}): ReorderForecast {
  const until = params.until ? new Date(params.until) : new Date();
  const from = params.from
    ? new Date(params.from)
    : new Date(until.getTime() - 14 * 24 * 60 * 60 * 1000);
  const lookbackDays = Math.max(1, Math.round((until.getTime() - from.getTime()) / 86_400_000));
  const defaultLeadDays = params.defaultLeadDays ?? 7;
  const minCoverageDays = params.minCoverageDays ?? defaultLeadDays;
  const models = { ...DEFAULT_MODELS, ...(params.models ?? {}) };
  const outletIds = mockDb.outlets.map((outlet) => outlet.id);

  // Completed mock sales inside the window, per product.
  const soldByProduct = new Map<string, number>();
  for (const transaction of mockDb.transactions) {
    if (transaction.status !== "completed") continue;
    const soldAt = new Date(transaction.createdAt).getTime();
    if (soldAt < from.getTime() || soldAt > until.getTime()) continue;
    for (const item of transaction.items) {
      if (!item.productId) continue;
      soldByProduct.set(
        item.productId,
        (soldByProduct.get(item.productId) ?? 0) + item.quantity
      );
    }
  }

  const ingredients = mockDb.ingredients
    .filter((ingredient) => ingredient.trackInventory)
    .map((ingredient) => {
      const recipeLines = mockDb.recipeItems.filter(
        (line) => line.ingredientId === ingredient.id
      );
      const currentStock = outletIds.reduce(
        (sum, outletId) => sum + mockIngredientBalance(outletId, ingredient.id),
        0
      );

      let theoretical = 0;
      let soldUnits = 0;
      for (const line of recipeLines) {
        const sold = soldByProduct.get(line.productId) ?? 0;
        if (sold <= 0) continue;
        soldUnits += sold;
        theoretical += sold * line.quantity * (1 + (line.wastePercent ?? 0) / 100);
      }

      const dailyDemand = theoretical / lookbackDays;
      const leadTimeDays = defaultLeadDays;
      const leadTimeDemand = dailyDemand * leadTimeDays;
      const targetStock = leadTimeDemand + dailyDemand * minCoverageDays;
      const reorderQuantity = Math.max(0, targetStock - currentStock);
      const method: ReorderMethod = dailyDemand > 0 ? "recipe-demand" : "none";
      const reason =
        currentStock <= 0
          ? "Out of stock — reorder immediately."
          : currentStock < ingredient.reorderLevel
            ? "Stock is below the reorder level; replenish soon."
            : currentStock < targetStock
              ? "Forecasted demand before the next delivery will dip below comfort level."
              : "Projected to stay above comfort level until the next delivery.";

      const forecast: ReorderIngredientForecast = {
        method,
        dailyDemand,
        leadTimeDemand,
        targetStock: method === "none" ? null : targetStock,
        currentStock,
        reorderQuantity,
        reorderQuantityUnit: ingredient.unit,
        reorderReason: method === "none" ? "Not enough data to forecast." : reason,
        predictedStockAtReorderDate: Math.max(0, currentStock - leadTimeDemand),
        daysOfStockRemaining: dailyDemand > 0 ? currentStock / dailyDemand : null,
        wasteRisk: null,
        blindSpot:
          method === "none"
            ? "No sales-driven demand yet: this ingredient is not in a recipe with sales, and has no photo/use pattern."
            : null,
        shelfLifeNote: null,
        leadTimeDays: method === "none" ? null : leadTimeDays,
      };

      const consumption: ReorderConsumption = {
        theoretical,
        soldUnits,
        recipeDriven: theoretical > 0,
      };

      return {
        id: ingredient.id,
        name: ingredient.name,
        sku: ingredient.sku,
        unit: ingredient.unit,
        costPerUnit: ingredient.costPerUnit,
        currentStock,
        reorderLevel: ingredient.reorderLevel,
        shelfLifeDays: 0,
        isTracked: ingredient.trackInventory,
        leadTimeDays,
        photoPattern: null,
        forecast,
        consumption,
      } satisfies ReorderIngredient;
    });

  const budget = ingredients.reduce(
    (sum, ingredient) => sum + ingredient.forecast.reorderQuantity * ingredient.costPerUnit,
    0
  );

  return {
    forecastAt: new Date().toISOString(),
    lookback: {
      from: from.toISOString(),
      until: until.toISOString(),
      days: lookbackDays,
    },
    settings: { defaultLeadDays, minCoverageDays, models },
    ingredients,
    purchaseMoneyBudget: {
      amount: Math.round(budget * 100) / 100,
      currency: mockDb.business.currency,
      note: "Estimated cost of suggested reorder quantities at current ingredient cost.",
    },
    suggestedParcelsByProduct: {},
  };
}
