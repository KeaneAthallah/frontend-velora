import { apiRequest, USE_MOCK_API } from "./client";
import {
  mockAvailability,
  mockDb,
  mockGroupsForProduct,
  mockId,
} from "./mock-db";
import { normalizeProduct } from "./products";
import type { Daypart, MenuProduct, MenuResponse, ModifierGroup, ModifierOption } from "./types";

export type ModifierOptionInput = {
  name: string;
  priceDelta?: number;
  isDefault?: boolean;
  isActive?: boolean;
  productId?: string;
  productVariantId?: string;
  /** Ingredient the option takes out of the recipe; null clears it. */
  removesIngredientId?: string | null;
};

export type ModifierGroupInput = {
  name: string;
  kind?: "modifier" | "combo";
  selectionType?: "single" | "multiple";
  minSelect?: number;
  maxSelect?: number;
  isRequired?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  options?: ModifierOptionInput[];
};

export type ModifierTarget = { type: "product" | "category"; id: string };

export type DaypartInput = {
  name: string;
  startTime: string;
  endTime: string;
  days?: number[];
  isActive?: boolean;
};

function normalizeOption(option: any): ModifierOption {
  return {
    id: String(option.id),
    groupId: String(option.modifier_group_id ?? option.groupId ?? ""),
    name: option.name ?? "",
    priceDelta: Number(option.price_delta ?? option.priceDelta ?? 0),
    isDefault: Boolean(option.is_default ?? option.isDefault ?? false),
    available: option.available ?? true,
    unavailableReason: option.unavailable_reason ?? option.unavailableReason ?? undefined,
    productId: option.product_id ? String(option.product_id) : undefined,
    productVariantId: option.product_variant_id ? String(option.product_variant_id) : undefined,
    removesIngredientId: option.removes_ingredient_id
      ? String(option.removes_ingredient_id)
      : option.removesIngredientId
        ? String(option.removesIngredientId)
        : undefined,
  };
}

function normalizeGroup(group: any): ModifierGroup {
  return {
    id: String(group.id),
    name: group.name ?? "",
    kind: group.kind === "combo" ? "combo" : "modifier",
    selectionType: group.selection_type === "multiple" ? "multiple" : "single",
    minSelect: Number(group.min_select ?? group.minSelect ?? 0),
    maxSelect: Number(group.max_select ?? group.maxSelect ?? 1),
    isRequired: Boolean(group.is_required ?? group.isRequired ?? false),
    sortOrder: Number(group.sort_order ?? group.sortOrder ?? 0),
    options: (group.options ?? []).map(normalizeOption),
  };
}

function normalizeMenuProduct(product: any): MenuProduct {
  return {
    ...normalizeProduct(product),
    available: product.available ?? true,
    unavailableReason: product.unavailable_reason ?? product.unavailableReason ?? undefined,
    isCombo: Boolean(product.is_combo ?? product.isCombo ?? false),
    daypartIds: (product.daypart_ids ?? product.daypartIds ?? []).map(String),
    modifierGroups: (product.modifier_groups ?? product.modifierGroups ?? []).map(normalizeGroup),
  };
}

function normalizeDaypart(daypart: any): Daypart {
  return {
    id: String(daypart.id),
    name: daypart.name ?? "",
    startTime: String(daypart.start_time ?? daypart.startTime ?? "00:00").slice(0, 5),
    endTime: String(daypart.end_time ?? daypart.endTime ?? "23:59").slice(0, 5),
    days: Array.isArray(daypart.days) ? daypart.days.map(Number) : [],
    isActive: daypart.is_active ?? daypart.isActive ?? true,
    productCount: Number(daypart.products_count ?? daypart.productCount ?? 0),
  };
}

function optionBody(input: ModifierOptionInput) {
  return {
    name: input.name,
    price_delta: input.priceDelta ?? 0,
    is_default: input.isDefault ?? false,
    is_active: input.isActive ?? true,
    product_id: input.productId ? Number(input.productId) : null,
    product_variant_id: input.productVariantId ? Number(input.productVariantId) : null,
    removes_ingredient_id: input.removesIngredientId ? Number(input.removesIngredientId) : null,
  };
}

const HOURS = (time: string) => time.slice(0, 5);

function withinDaypart(productId: string): boolean {
  const ids = mockDb.productDayparts[productId] ?? [];
  if (!ids.length) return true;
  const now = new Date();
  const day = now.getDay();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return ids.some((id) => {
    const daypart = mockDb.dayparts.find((item) => item.id === id && item.isActive);
    if (!daypart) return false;
    if (daypart.days.length && !daypart.days.includes(day)) return false;
    const start = HOURS(daypart.startTime);
    const end = HOURS(daypart.endTime);
    return start <= end ? time >= start && time <= end : time >= start || time <= end;
  });
}

export async function getMenu(outletId: string): Promise<MenuResponse> {
  if (USE_MOCK_API) {
    const outlet = mockDb.outlets.find((item) => item.id === outletId);
    const products: MenuProduct[] = mockDb.products
      .filter((product) => product.active)
      .map((product) => {
        const override = mockAvailability(outletId, product.id);
        const validDaypart = withinDaypart(product.id);
        return {
          ...product,
          stockByOutlet: { ...product.stockByOutlet },
          available: override ? override.available : validDaypart,
          unavailableReason: override
            ? override.reason
            : validDaypart
              ? undefined
              : "Outside its serving window",
          daypartIds: [...(mockDb.productDayparts[product.id] ?? [])],
          modifierGroups: mockGroupsForProduct(product.id),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      outlet: { id: outlet?.id ?? outletId, name: outlet?.name ?? "" },
      generatedAt: new Date().toISOString(),
      products,
    };
  }

  const data = await apiRequest<any>(`/menu?outlet_id=${encodeURIComponent(outletId)}`);
  return {
    outlet: { id: String(data.outlet.id), name: data.outlet.name },
    generatedAt: data.generated_at ?? new Date().toISOString(),
    products: (data.products ?? []).map(normalizeMenuProduct),
  };
}

export async function listModifierGroups(params?: {
  kind?: "modifier" | "combo";
  active?: boolean;
}): Promise<ModifierGroup[]> {
  if (USE_MOCK_API) {
    return mockDb.modifierGroups
      .filter((group) => (params?.kind ? group.kind === params.kind : true))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      .map((group) => ({ ...group, options: group.options.map((option) => ({ ...option })) }));
  }
  const query = new URLSearchParams();
  if (params?.kind) query.set("kind", params.kind);
  if (params?.active !== undefined) query.set("active", String(params.active));
  const data = await apiRequest<any>(`/modifier-groups${query.size ? `?${query.toString()}` : ""}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map(normalizeGroup);
}

export async function createModifierGroup(input: ModifierGroupInput): Promise<ModifierGroup> {
  if (USE_MOCK_API) {
    const id = mockId("mg");
    const group: ModifierGroup = {
      id,
      name: input.name,
      kind: input.kind ?? "modifier",
      selectionType: input.selectionType ?? "single",
      minSelect: input.minSelect ?? (input.isRequired ? 1 : 0),
      maxSelect: input.selectionType === "single" ? 1 : (input.maxSelect ?? 0),
      isRequired: input.isRequired ?? false,
      sortOrder: input.sortOrder ?? mockDb.modifierGroups.length,
      options: (input.options ?? []).map((option, index) => ({
        id: mockId("mo"),
        groupId: id,
        name: option.name,
        priceDelta: option.priceDelta ?? 0,
        isDefault: option.isDefault ?? index === 0,
        available: true,
        productId: option.productId,
        productVariantId: option.productVariantId,
      })),
    };
    mockDb.modifierGroups = [...mockDb.modifierGroups, group];
    return { ...group, options: group.options.map((option) => ({ ...option })) };
  }

  const data = await apiRequest<any>("/modifier-groups", {
    method: "POST",
    body: {
      name: input.name,
      kind: input.kind,
      selection_type: input.selectionType,
      min_select: input.minSelect,
      max_select: input.selectionType === "single" ? 1 : (input.maxSelect ?? 0),
      is_required: input.isRequired,
      sort_order: input.sortOrder,
      is_active: input.isActive,
      options: input.options?.map(optionBody),
    },
  });
  return normalizeGroup(data);
}

export async function updateModifierGroup(id: string, input: Partial<ModifierGroupInput>): Promise<ModifierGroup> {
  if (USE_MOCK_API) {
    const index = mockDb.modifierGroups.findIndex((group) => group.id === id);
    if (index < 0) throw new Error("Modifier group not found");
    const current = mockDb.modifierGroups[index];
    mockDb.modifierGroups[index] = {
      ...current,
      name: input.name ?? current.name,
      kind: input.kind ?? current.kind,
      selectionType: input.selectionType ?? current.selectionType,
      minSelect: input.minSelect ?? current.minSelect,
      maxSelect: input.maxSelect ?? current.maxSelect,
      isRequired: input.isRequired ?? current.isRequired,
      sortOrder: input.sortOrder ?? current.sortOrder,
    };
    const group = mockDb.modifierGroups[index];
    return { ...group, options: group.options.map((option) => ({ ...option })) };
  }
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.kind !== undefined) body.kind = input.kind;
  if (input.selectionType !== undefined) body.selection_type = input.selectionType;
  if (input.minSelect !== undefined) body.min_select = input.minSelect;
  if (input.maxSelect !== undefined) body.max_select = input.maxSelect;
  if (input.isRequired !== undefined) body.is_required = input.isRequired;
  if (input.sortOrder !== undefined) body.sort_order = input.sortOrder;
  if (input.isActive !== undefined) body.is_active = input.isActive;
  const data = await apiRequest<any>(`/modifier-groups/${id}`, { method: "PUT", body });
  return normalizeGroup(data);
}

export async function deleteModifierGroup(id: string): Promise<void> {
  if (USE_MOCK_API) {
    mockDb.modifierGroups = mockDb.modifierGroups.filter((group) => group.id !== id);
    mockDb.modifierAssignments = Object.fromEntries(
      Object.entries(mockDb.modifierAssignments).map(([productId, ids]) => [
        productId,
        ids.filter((groupId) => groupId !== id),
      ])
    );
    mockDb.modifierCategoryAssignments = Object.fromEntries(
      Object.entries(mockDb.modifierCategoryAssignments).map(([categoryId, ids]) => [
        categoryId,
        ids.filter((groupId) => groupId !== id),
      ])
    );
    return;
  }
  await apiRequest<void>(`/modifier-groups/${id}`, { method: "DELETE" });
}

export async function attachModifierGroup(id: string, target: ModifierTarget): Promise<void> {
  if (USE_MOCK_API) {
    const map = target.type === "product" ? mockDb.modifierAssignments : mockDb.modifierCategoryAssignments;
    const current = map[target.id] ?? [];
    if (!current.includes(id)) {
      map[target.id] = [...current, id];
    }
    return;
  }
  await apiRequest<void>(`/modifier-groups/${id}/attach`, {
    method: "POST",
    body: { assignable_type: target.type, assignable_id: Number(target.id) },
  });
}

export async function detachModifierGroup(id: string, target: ModifierTarget): Promise<void> {
  if (USE_MOCK_API) {
    const map = target.type === "product" ? mockDb.modifierAssignments : mockDb.modifierCategoryAssignments;
    map[target.id] = (map[target.id] ?? []).filter((groupId) => groupId !== id);
    return;
  }
  await apiRequest<void>(`/modifier-groups/${id}/detach`, {
    method: "POST",
    body: { assignable_type: target.type, assignable_id: Number(target.id) },
  });
}

export async function createModifierOption(groupId: string, input: ModifierOptionInput): Promise<ModifierOption> {
  if (USE_MOCK_API) {
    const group = mockDb.modifierGroups.find((item) => item.id === groupId);
    if (!group) throw new Error("Modifier group not found");
    const option: ModifierOption = {
      id: mockId("mo"),
      groupId,
      name: input.name,
      priceDelta: input.priceDelta ?? 0,
      isDefault: input.isDefault ?? false,
      available: true,
      productId: input.productId,
      productVariantId: input.productVariantId,
      removesIngredientId: input.removesIngredientId ?? undefined,
    };
    if (option.isDefault && group.selectionType === "single") {
      group.options = group.options.map((item) => ({ ...item, isDefault: false }));
    }
    group.options = [...group.options, option];
    return { ...option };
  }
  const data = await apiRequest<any>(`/modifier-groups/${groupId}/options`, {
    method: "POST",
    body: optionBody(input),
  });
  return normalizeOption(data);
}

export async function updateModifierOption(id: string, input: Partial<ModifierOptionInput>): Promise<ModifierOption> {
  if (USE_MOCK_API) {
    for (const group of mockDb.modifierGroups) {
      const index = group.options.findIndex((option) => option.id === id);
      if (index < 0) continue;
      if (input.isDefault && group.selectionType === "single") {
        group.options = group.options.map((option) => ({ ...option, isDefault: false }));
      }
      group.options[index] = {
        ...group.options[index],
        ...input,
        removesIngredientId: input.removesIngredientId ?? undefined,
      };
      return { ...group.options[index] };
    }
    throw new Error("Modifier option not found");
  }
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.priceDelta !== undefined) body.price_delta = input.priceDelta;
  if (input.isDefault !== undefined) body.is_default = input.isDefault;
  if (input.isActive !== undefined) body.is_active = input.isActive;
  if (input.productId !== undefined) body.product_id = input.productId ? Number(input.productId) : null;
  if (input.productVariantId !== undefined) {
    body.product_variant_id = input.productVariantId ? Number(input.productVariantId) : null;
  }
  if (input.removesIngredientId !== undefined) {
    body.removes_ingredient_id = input.removesIngredientId
      ? Number(input.removesIngredientId)
      : null;
  }
  const data = await apiRequest<any>(`/modifier-options/${id}`, { method: "PUT", body });
  return normalizeOption(data);
}

export async function deleteModifierOption(id: string): Promise<void> {
  if (USE_MOCK_API) {
    mockDb.modifierGroups = mockDb.modifierGroups.map((group) => ({
      ...group,
      options: group.options.filter((option) => option.id !== id),
    }));
    return;
  }
  await apiRequest<void>(`/modifier-options/${id}`, { method: "DELETE" });
}

export async function markProductUnavailable(productId: string, reason: string, outletId: string): Promise<void> {
  if (USE_MOCK_API) {
    mockDb.menuAvailability[`${outletId}:${productId}`] = { available: false, reason };
    return;
  }
  await apiRequest<void>(`/menu/items/${productId}/86`, {
    method: "POST",
    body: { outlet_id: Number(outletId), reason },
  });
}

export async function restoreProduct(productId: string, outletId: string): Promise<void> {
  if (USE_MOCK_API) {
    delete mockDb.menuAvailability[`${outletId}:${productId}`];
    return;
  }
  await apiRequest<void>(`/menu/items/${productId}/restore`, {
    method: "POST",
    body: { outlet_id: Number(outletId) },
  });
}

export async function listDayparts(): Promise<Daypart[]> {
  if (USE_MOCK_API) {
    return mockDb.dayparts
      .map((daypart) => ({
        ...daypart,
        days: [...daypart.days],
        productCount: Object.values(mockDb.productDayparts).filter((ids) => ids.includes(daypart.id)).length,
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  const data = await apiRequest<any>("/dayparts");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map(normalizeDaypart);
}

export async function createDaypart(input: DaypartInput): Promise<Daypart> {
  if (USE_MOCK_API) {
    const daypart: Daypart = {
      id: mockId("dp"),
      name: input.name,
      startTime: HOURS(input.startTime),
      endTime: HOURS(input.endTime),
      days: input.days ?? [],
      isActive: input.isActive ?? true,
      productCount: 0,
    };
    mockDb.dayparts = [...mockDb.dayparts, daypart];
    return { ...daypart };
  }
  const data = await apiRequest<any>("/dayparts", {
    method: "POST",
    body: {
      name: input.name,
      start_time: HOURS(input.startTime),
      end_time: HOURS(input.endTime),
      days: input.days ?? [],
      is_active: input.isActive ?? true,
    },
  });
  return normalizeDaypart(data);
}

export async function updateDaypart(id: string, input: Partial<DaypartInput>): Promise<Daypart> {
  if (USE_MOCK_API) {
    const index = mockDb.dayparts.findIndex((daypart) => daypart.id === id);
    if (index < 0) throw new Error("Daypart not found");
    mockDb.dayparts[index] = {
      ...mockDb.dayparts[index],
      ...input,
      startTime: input.startTime ? HOURS(input.startTime) : mockDb.dayparts[index].startTime,
      endTime: input.endTime ? HOURS(input.endTime) : mockDb.dayparts[index].endTime,
    };
    return { ...mockDb.dayparts[index] };
  }
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.startTime !== undefined) body.start_time = HOURS(input.startTime);
  if (input.endTime !== undefined) body.end_time = HOURS(input.endTime);
  if (input.days !== undefined) body.days = input.days;
  if (input.isActive !== undefined) body.is_active = input.isActive;
  const data = await apiRequest<any>(`/dayparts/${id}`, { method: "PUT", body });
  return normalizeDaypart(data);
}

export async function deleteDaypart(id: string): Promise<void> {
  if (USE_MOCK_API) {
    mockDb.dayparts = mockDb.dayparts.filter((daypart) => daypart.id !== id);
    mockDb.productDayparts = Object.fromEntries(
      Object.entries(mockDb.productDayparts).map(([productId, ids]) => [
        productId,
        ids.filter((daypartId) => daypartId !== id),
      ])
    );
    return;
  }
  await apiRequest<void>(`/dayparts/${id}`, { method: "DELETE" });
}

export async function setProductDayparts(productId: string, daypartIds: string[]): Promise<void> {
  if (USE_MOCK_API) {
    mockDb.productDayparts[productId] = [...daypartIds];
    return;
  }
  await apiRequest<void>(`/products/${productId}/dayparts`, {
    method: "PUT",
    body: { daypart_ids: daypartIds.map(Number) },
  });
}
