import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import { normalizeCustomer } from "./customers";
import type { Customer, LoyaltyProgram, LoyaltyTransaction, Paginated } from "./types";

export function normalizeLoyaltyProgram(program: any): LoyaltyProgram {
  return {
    isActive: program?.is_active !== false,
    pointsPerAmount: Number(program?.points_per_amount ?? 0.0001),
    redeemValue: Number(program?.redeem_value ?? 100),
    minRedeemPoints: Number(program?.min_redeem_points ?? 10),
  };
}

function normalizeLoyaltyTransaction(transaction: any): LoyaltyTransaction {
  return {
    id: String(transaction.id),
    customerId: String(transaction.customer_id ?? ""),
    saleId: transaction.sale_id ? String(transaction.sale_id) : undefined,
    type: transaction.type ?? "adjust",
    points: Number(transaction.points ?? 0),
    balanceAfter: Number(transaction.balance_after ?? 0),
    reason: transaction.reason ?? undefined,
    createdAt: transaction.created_at ?? new Date().toISOString(),
  };
}

export async function getLoyaltyProgram(): Promise<LoyaltyProgram> {
  if (USE_MOCK_API) {
    return { ...mockDb.loyaltyProgram };
  }
  const data = await apiRequest<any>("/loyalty/program");
  return normalizeLoyaltyProgram(data);
}

export async function updateLoyaltyProgram(input: Partial<LoyaltyProgram>): Promise<LoyaltyProgram> {
  if (USE_MOCK_API) {
    mockDb.loyaltyProgram = {
      ...mockDb.loyaltyProgram,
      ...input,
    };
    return { ...mockDb.loyaltyProgram };
  }
  const body: Record<string, unknown> = {};
  if (input.isActive !== undefined) body.is_active = input.isActive;
  if (input.pointsPerAmount !== undefined) body.points_per_amount = input.pointsPerAmount;
  if (input.redeemValue !== undefined) body.redeem_value = input.redeemValue;
  if (input.minRedeemPoints !== undefined) body.min_redeem_points = input.minRedeemPoints;

  const data = await apiRequest<any>("/loyalty/program", { method: "PUT", body });
  return normalizeLoyaltyProgram(data);
}

export async function listLoyaltyTransactions(params?: {
  customerId?: string;
  saleId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<LoyaltyTransaction>> {
  if (USE_MOCK_API) {
    let data = [...mockDb.loyaltyTransactions];
    if (params?.customerId) data = data.filter((entry) => entry.customerId === params.customerId);
    if (params?.saleId) data = data.filter((entry) => entry.saleId === params.saleId);
    if (params?.type) data = data.filter((entry) => entry.type === params.type);
    data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    return {
      data: data.slice(start, start + pageSize),
      page,
      pageSize,
      total: data.length,
      totalPages: Math.max(1, Math.ceil(data.length / pageSize)),
    };
  }

  const query = new URLSearchParams();
  if (params?.customerId) query.set("customer_id", params.customerId);
  if (params?.saleId) query.set("sale_id", params.saleId);
  if (params?.type) query.set("type", params.type);
  query.set("page", String(params?.page ?? 1));

  const data = await apiRequest<any>(`/loyalty/transactions?${query.toString()}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    data: items.map(normalizeLoyaltyTransaction),
    page: Number(data?.current_page ?? params?.page ?? 1),
    pageSize: Number(data?.per_page ?? 50),
    total: Number(data?.total ?? items.length),
    totalPages: Number(data?.last_page ?? 1),
  };
}

export async function adjustLoyaltyPoints(customerId: string, points: number, reason: string): Promise<Customer> {
  if (USE_MOCK_API) {
    const customer = mockDb.customers.find((entry) => entry.id === customerId);
    if (!customer) throw new Error("Customer not found");
    if (!points) throw new Error("Enter a non-zero points adjustment");

    const balance = Math.round((customer.loyaltyPoints + points) * 100) / 100;
    if (balance < 0) throw new Error(`The customer only has ${customer.loyaltyPoints} points`);

    customer.loyaltyPoints = balance;
    customer.loyaltyJoinedAt = customer.loyaltyJoinedAt ?? new Date().toISOString();
    mockDb.loyaltyTransactions.unshift({
      id: mockId("lt"),
      customerId,
      type: "adjust",
      points,
      balanceAfter: balance,
      reason,
      createdAt: new Date().toISOString(),
    });
    return { ...customer };
  }

  const data = await apiRequest<any>(`/customers/${customerId}/loyalty/adjust`, {
    method: "POST",
    body: { points, reason },
  });
  return normalizeCustomer(data);
}
