import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type { CashMovement, CashMovementType, CashRegister, RegisterShift } from "./types";

type Raw = Record<string, any>;

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapRegister(raw: Raw): CashRegister {
  return {
    id: String(raw.id ?? ""),
    outletId: String(raw.outlet_id ?? ""),
    name: raw.name,
    code: raw.code,
    status: raw.status === "inactive" ? "inactive" : "active",
  };
}

function mapShift(raw: Raw): RegisterShift {
  const register = raw.register ?? {};
  const cashier = raw.cashier ?? {};
  return {
    id: String(raw.id ?? ""),
    outletId: String(raw.outlet_id ?? ""),
    registerId: String(raw.cash_register_id ?? ""),
    registerName: register.name ?? raw.register_name ?? undefined,
    cashierId: String(raw.cashier_id ?? ""),
    cashierName: cashier.name ?? raw.cashier_name ?? undefined,
    status: raw.status === "closed" ? "closed" : "open",
    openingCash: num(raw.opening_cash),
    expectedCash: raw.expected_cash == null ? null : num(raw.expected_cash),
    actualCash: raw.actual_cash == null ? null : num(raw.actual_cash),
    difference: raw.difference == null ? null : num(raw.difference),
    openedAt: raw.opened_at ?? "",
    closedAt: raw.closed_at ?? null,
    notes: raw.notes ?? null,
  };
}

function mapMovement(raw: Raw): CashMovement {
  return {
    id: String(raw.id ?? ""),
    shiftId: String(raw.register_shift_id ?? ""),
    type: raw.type === "out" ? "out" : "in",
    amount: num(raw.amount),
    reason: raw.reason ?? null,
    createdAt: raw.created_at ?? "",
  };
}

/* ───────────────────────────── registers ────────────────────────── */

export async function listCashRegisters(): Promise<CashRegister[]> {
  if (USE_MOCK_API) return mockDb.cashRegisters.map((register) => ({ ...register }));
  const data = await apiRequest<Raw[]>("/cash-registers");
  return Array.isArray(data) ? data.map(mapRegister) : [];
}

export async function createCashRegister(input: { name: string; code: string }): Promise<CashRegister> {
  if (USE_MOCK_API) {
    const register: CashRegister = {
      id: mockId("reg"),
      outletId: mockDb.outlets[0]?.id ?? mockDb.business.id,
      name: input.name,
      code: input.code.toUpperCase(),
      status: "active",
    };
    mockDb.cashRegisters = [register, ...mockDb.cashRegisters];
    return register;
  }
  return mapRegister(await apiRequest<Raw>("/cash-registers", { method: "POST", body: input }));
}

export async function updateCashRegister(id: string, input: { name?: string; status?: "active" | "inactive" }): Promise<CashRegister> {
  if (USE_MOCK_API) {
    const register = mockDb.cashRegisters.find((item) => item.id === id)!;
    Object.assign(register, input);
    return { ...register };
  }
  return mapRegister(await apiRequest<Raw>(`/cash-registers/${id}`, { method: "PUT", body: input }));
}

export async function deleteCashRegister(id: string): Promise<void> {
  if (USE_MOCK_API) {
    mockDb.cashRegisters = mockDb.cashRegisters.filter((item) => item.id !== id);
    return;
  }
  await apiRequest<void>(`/cash-registers/${id}`, { method: "DELETE" });
}

/* ─────────────────────────────── shifts ─────────────────────────── */

export async function listShifts(): Promise<RegisterShift[]> {
  if (USE_MOCK_API) {
    return [...mockDb.registerShifts]
      .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
      .map((shift) => ({ ...shift }));
  }
  const data = await apiRequest<{ data?: Raw[] }>("/shifts");
  const items = Array.isArray(data?.data) ? data.data : [];
  return items.map(mapShift);
}

export async function openShift(input: { registerId: string; openingCash: number }): Promise<RegisterShift> {
  if (USE_MOCK_API) {
    const register = mockDb.cashRegisters.find((item) => item.id === input.registerId);
    if (!register) throw new Error("Register not found");
    if (mockDb.registerShifts.some((shift) => shift.registerId === input.registerId && shift.status === "open")) {
      throw new Error("Register already has open shift");
    }
    const shift: RegisterShift = {
      id: mockId("shift"),
      outletId: register.outletId,
      registerId: register.id,
      registerName: register.name,
      cashierId: "u-current",
      cashierName: "You",
      status: "open",
      openingCash: input.openingCash,
      expectedCash: input.openingCash,
      actualCash: null,
      difference: null,
      openedAt: new Date().toISOString(),
      closedAt: null,
      notes: null,
    };
    mockDb.registerShifts = [shift, ...mockDb.registerShifts];
    return { ...shift };
  }
  return mapShift(
    await apiRequest<Raw>("/shifts/open", {
      method: "POST",
      body: { cash_register_id: input.registerId, opening_cash: input.openingCash },
    })
  );
}

export async function closeShift(id: string, input: { actualCash: number; notes?: string }): Promise<RegisterShift> {
  if (USE_MOCK_API) {
    const shift = mockDb.registerShifts.find((item) => item.id === id)!;
    const movements = mockDb.cashMovements.filter((movement) => movement.shiftId === id);
    const expected =
      shift.openingCash +
      movements.reduce((total, movement) => total + (movement.type === "in" ? movement.amount : -movement.amount), 0);
    shift.expectedCash = expected;
    shift.actualCash = input.actualCash;
    shift.difference = input.actualCash - expected;
    shift.status = "closed";
    shift.closedAt = new Date().toISOString();
    shift.notes = input.notes ?? null;
    return { ...shift };
  }
  return mapShift(
    await apiRequest<Raw>(`/shifts/${id}/close`, {
      method: "POST",
      body: { actual_cash: input.actualCash, notes: input.notes },
    })
  );
}

export async function recordCashMovement(
  id: string,
  input: { type: CashMovementType; amount: number; reason?: string }
): Promise<CashMovement> {
  if (USE_MOCK_API) {
    const movement: CashMovement = {
      id: mockId("cm"),
      shiftId: id,
      type: input.type,
      amount: input.amount,
      reason: input.reason ?? null,
      createdAt: new Date().toISOString(),
    };
    mockDb.cashMovements = [movement, ...mockDb.cashMovements];
    return movement;
  }
  return mapMovement(
    await apiRequest<Raw>(`/shifts/${id}/cash-movement`, {
      method: "POST",
      body: { type: input.type, amount: input.amount, reason: input.reason },
    })
  );
}

export async function listCashMovements(shiftId: string): Promise<CashMovement[]> {
  if (USE_MOCK_API) {
    return (mockDb.cashMovements ?? [])
      .filter((movement) => movement.shiftId === shiftId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((movement) => ({ ...movement }));
  }
  const data = await apiRequest<{ data?: Raw[] }>(`/shifts/${shiftId}/cash-movements`);
  const items = Array.isArray(data?.data) ? data.data : [];
  return items.map(mapMovement);
}
