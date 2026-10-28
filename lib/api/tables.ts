import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type {
  DiningTable,
  FloorArea,
  FloorPlan,
  OrderStatus,
  TableShape,
  TableStatus,
} from "./types";

export type ManualTableStatus = Exclude<TableStatus, "occupied">;

export type TableInput = {
  outletId: string;
  name: string;
  floorAreaId?: string | null;
  seats?: number;
  shape?: TableShape;
  positionX?: number;
  positionY?: number;
  status?: ManualTableStatus;
  isActive?: boolean;
  notes?: string;
};

export type TableUpdate = Partial<Omit<TableInput, "outletId">>;

export type AreaInput = {
  outletId: string;
  name: string;
  sortOrder?: number;
};

export type FloorPlanParams = {
  outletId?: string;
  includeInactive?: boolean;
};

const ACTIVE_STATUSES: OrderStatus[] = ["open", "in_kitchen", "ready", "served"];

export function tableStatusLabel(status: TableStatus) {
  switch (status) {
    case "occupied":
      return "Occupied";
    case "reserved":
      return "Reserved";
    case "cleaning":
      return "Cleaning";
    default:
      return "Available";
  }
}

/** Mirrors the server: occupancy comes from active orders, not a stored flag. */
export function mockActiveOrderForTable(tableId: string) {
  return mockDb.orders.find(
    (order) => order.tableId === tableId && ACTIVE_STATUSES.includes(order.orderStatus!)
  );
}

export function mockTablePayload(table: DiningTable): DiningTable {
  const order = mockActiveOrderForTable(table.id);
  return {
    ...table,
    area: table.area ? { ...table.area } : null,
    status: order ? "occupied" : table.manualStatus,
    occupied: Boolean(order),
    activeOrder: order
      ? {
          id: order.id,
          orderNumber: order.orderNumber,
          orderStatus: order.orderStatus!,
          total: order.total,
          itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
          createdAt: order.createdAt,
        }
      : null,
  };
}

export function mockTableName(tableId?: string) {
  if (!tableId) return undefined;
  return mockDb.diningTables.find((table) => table.id === tableId)?.name;
}

function mapArea(area: any): FloorArea {
  return {
    id: String(area.id),
    outletId: String(area.outlet_id),
    name: area.name,
    sortOrder: Number(area.sort_order ?? 0),
  };
}

function mapTable(table: any): DiningTable {
  return {
    id: String(table.id),
    outletId: String(table.outlet_id),
    outletName: table.outlet_name ?? undefined,
    name: table.name,
    seats: Number(table.seats ?? 0),
    shape: table.shape ?? "square",
    positionX: Number(table.position_x ?? 0),
    positionY: Number(table.position_y ?? 0),
    status: table.status ?? "available",
    manualStatus: table.manual_status ?? "available",
    occupied: Boolean(table.occupied),
    isActive: table.is_active !== false,
    notes: table.notes ?? undefined,
    area: table.area ? { id: String(table.area.id), name: table.area.name } : null,
    activeOrder: table.active_order
      ? {
          id: String(table.active_order.id),
          orderNumber: table.active_order.order_number ?? undefined,
          orderStatus: table.active_order.order_status,
          total: Number(table.active_order.total ?? 0),
          itemsCount: Number(table.active_order.items_count ?? 0),
          createdAt: table.active_order.created_at,
        }
      : null,
  };
}

function areaBody(input: Partial<AreaInput>) {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
  };
}

function tableBody(input: TableUpdate) {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...("floorAreaId" in input ? { floor_area_id: input.floorAreaId ? Number(input.floorAreaId) : null } : {}),
    ...(input.seats !== undefined ? { seats: input.seats } : {}),
    ...(input.shape !== undefined ? { shape: input.shape } : {}),
    ...(input.positionX !== undefined ? { position_x: input.positionX } : {}),
    ...(input.positionY !== undefined ? { position_y: input.positionY } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
}

export async function listFloorPlan(params?: FloorPlanParams): Promise<FloorPlan> {
  if (USE_MOCK_API) {
    const areas = mockDb.floorAreas
      .filter((area) => !params?.outletId || area.outletId === params.outletId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const tables = mockDb.diningTables
      .filter((table) => !params?.outletId || table.outletId === params.outletId)
      .filter((table) => params?.includeInactive || table.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(mockTablePayload);

    return { areas, tables };
  }

  const query = new URLSearchParams();
  if (params?.outletId) query.set("outlet_id", params.outletId);
  if (params?.includeInactive) query.set("include_inactive", "1");

  const data = await apiRequest<any>(`/tables?${query.toString()}`);

  return {
    areas: (data?.areas ?? []).map(mapArea),
    tables: (data?.tables ?? []).map(mapTable),
  };
}

export async function createTable(input: TableInput): Promise<DiningTable> {
  if (USE_MOCK_API) {
    assertMockNameFree(input.name, input.outletId);
    const area = input.floorAreaId
      ? mockDb.floorAreas.find(
          (entry) => entry.id === input.floorAreaId && entry.outletId === input.outletId
        )
      : null;
    if (input.floorAreaId && !area) throw new Error("This area is not available in this outlet");

    const table: DiningTable = {
      id: mockId("tbl"),
      outletId: input.outletId,
      name: input.name.trim(),
      seats: input.seats ?? 2,
      shape: input.shape ?? "square",
      positionX: input.positionX ?? 0,
      positionY: input.positionY ?? 0,
      status: input.status ?? "available",
      manualStatus: input.status ?? "available",
      occupied: false,
      isActive: input.isActive ?? true,
      notes: input.notes,
      area: area ? { id: area.id, name: area.name } : null,
    };
    mockDb.diningTables.push(table);
    return mockTablePayload(table);
  }

  const data = await apiRequest<any>("/tables", {
    method: "POST",
    body: { ...tableBody(input), outlet_id: Number(input.outletId) },
  });
  return mapTable(data);
}

export async function updateTable(id: string, input: TableUpdate): Promise<DiningTable> {
  if (USE_MOCK_API) {
    const table = mockDb.diningTables.find((entry) => entry.id === id);
    if (!table) throw new Error("Table not found");
    if (input.name !== undefined) assertMockNameFree(input.name, table.outletId, table.id);

    if (input.floorAreaId !== undefined) {
      const area = input.floorAreaId
        ? mockDb.floorAreas.find(
            (entry) => entry.id === input.floorAreaId && entry.outletId === table.outletId
          )
        : null;
      if (input.floorAreaId && !area) throw new Error("This area is not available in this outlet");
      table.area = area ? { id: area.id, name: area.name } : null;
    }

    if (input.isActive === false && mockActiveOrderForTable(table.id)) {
      throw new Error("A table with an open order cannot be deactivated");
    }

    table.name = input.name?.trim() ?? table.name;
    table.seats = input.seats ?? table.seats;
    table.shape = input.shape ?? table.shape;
    table.positionX = input.positionX ?? table.positionX;
    table.positionY = input.positionY ?? table.positionY;
    table.manualStatus = input.status ?? table.manualStatus;
    table.isActive = input.isActive ?? table.isActive;
    if (input.notes !== undefined) table.notes = input.notes || undefined;

    return mockTablePayload(table);
  }

  const data = await apiRequest<any>(`/tables/${id}`, { method: "PUT", body: tableBody(input) });
  return mapTable(data);
}

export async function deleteTable(id: string): Promise<void> {
  if (USE_MOCK_API) {
    const hasHistory =
      mockDb.orders.some((order) => order.tableId === id) ||
      mockDb.transactions.some((sale) => sale.tableId === id);
    if (hasHistory) throw new Error("This table has sales history. Deactivate it instead.");
    mockDb.diningTables = mockDb.diningTables.filter((table) => table.id !== id);
    return;
  }

  await apiRequest(`/tables/${id}`, { method: "DELETE" });
}

export async function setTableStatus(id: string, status: ManualTableStatus): Promise<DiningTable> {
  if (USE_MOCK_API) {
    const table = mockDb.diningTables.find((entry) => entry.id === id);
    if (!table) throw new Error("Table not found");
    if (mockActiveOrderForTable(id) && status !== table.manualStatus) {
      throw new Error("This table has an open order. Check it out or cancel it first.");
    }
    table.manualStatus = status;
    return mockTablePayload(table);
  }

  const data = await apiRequest<any>(`/tables/${id}/status`, { method: "POST", body: { status } });
  return mapTable(data);
}

export async function createArea(input: AreaInput): Promise<FloorArea> {
  if (USE_MOCK_API) {
    assertMockAreaNameFree(input.name, input.outletId);
    const area: FloorArea = {
      id: mockId("area"),
      outletId: input.outletId,
      name: input.name.trim(),
      sortOrder: input.sortOrder ?? 0,
    };
    mockDb.floorAreas.push(area);
    return area;
  }

  const data = await apiRequest<any>("/floor-areas", {
    method: "POST",
    body: { ...areaBody(input), outlet_id: Number(input.outletId) },
  });
  return mapArea(data);
}

export async function updateArea(
  id: string,
  input: Partial<Omit<AreaInput, "outletId">>
): Promise<FloorArea> {
  if (USE_MOCK_API) {
    const area = mockDb.floorAreas.find((entry) => entry.id === id);
    if (!area) throw new Error("Area not found");
    if (input.name !== undefined) assertMockAreaNameFree(input.name, area.outletId, area.id);

    area.name = input.name?.trim() ?? area.name;
    area.sortOrder = input.sortOrder ?? area.sortOrder;
    mockDb.diningTables.forEach((table) => {
      if (table.area?.id === area.id) table.area = { id: area.id, name: area.name };
    });
    return area;
  }

  const data = await apiRequest<any>(`/floor-areas/${id}`, {
    method: "PUT",
    body: areaBody(input),
  });
  return mapArea(data);
}

export async function deleteArea(id: string): Promise<void> {
  if (USE_MOCK_API) {
    if (mockDb.diningTables.some((table) => table.area?.id === id)) {
      throw new Error("Move or delete the tables in this area first.");
    }
    mockDb.floorAreas = mockDb.floorAreas.filter((area) => area.id !== id);
    return;
  }

  await apiRequest(`/floor-areas/${id}`, { method: "DELETE" });
}

function assertMockNameFree(name: string, outletId: string, ignoreId?: string) {
  const normalized = name.trim().toLowerCase();
  const clash = mockDb.diningTables.some(
    (table) =>
      table.outletId === outletId &&
      table.id !== ignoreId &&
      table.name.trim().toLowerCase() === normalized
  );
  if (clash) throw new Error(`Table ${name.trim()} already exists in this outlet`);
}

function assertMockAreaNameFree(name: string, outletId: string, ignoreId?: string) {
  const normalized = name.trim().toLowerCase();
  const clash = mockDb.floorAreas.some(
    (area) =>
      area.outletId === outletId &&
      area.id !== ignoreId &&
      area.name.trim().toLowerCase() === normalized
  );
  if (clash) throw new Error(`Area ${name.trim()} already exists in this outlet`);
}
