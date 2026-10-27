import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type { Customer, Paginated } from "./types";

export type CustomerInput = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  loyaltyNumber?: string;
};

function normalizeCustomer(customer: any): Customer {
  return {
    id: String(customer.id),
    name: customer.name ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? undefined,
    address: customer.address ?? undefined,
    loyaltyNumber: customer.loyalty_number ?? undefined,
    loyaltyPoints: Number(customer.loyalty_points ?? 0),
    notes: customer.notes ?? undefined,
    createdAt: customer.created_at ?? new Date().toISOString(),
  };
}

export async function listCustomers(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<Customer>> {
  if (USE_MOCK_API) {
    let data = [...mockDb.customers];
    if (params?.search) {
      const query = params.search.toLowerCase();
      data = data.filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) ||
          customer.phone.toLowerCase().includes(query) ||
          (customer.email ?? "").toLowerCase().includes(query) ||
          (customer.loyaltyNumber ?? "").toLowerCase().includes(query)
      );
    }
    data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
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
  if (params?.search) query.set("search", params.search);
  query.set("page", String(params?.page ?? 1));
  const data = await apiRequest<any>(`/customers?${query.toString()}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    data: items.map(normalizeCustomer),
    page: Number(data?.current_page ?? params?.page ?? 1),
    pageSize: Number(data?.per_page ?? 50),
    total: Number(data?.total ?? items.length),
    totalPages: Number(data?.last_page ?? 1),
  };
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  if (USE_MOCK_API) {
    const customer: Customer = {
      id: mockId("cu"),
      name: input.name,
      phone: input.phone ?? "",
      email: input.email,
      address: input.address,
      loyaltyNumber: input.loyaltyNumber ?? `VLR-${String(Date.now()).slice(-7)}`,
      loyaltyPoints: 0,
      createdAt: new Date().toISOString(),
    };
    mockDb.customers = [customer, ...mockDb.customers];
    return customer;
  }
  const data = await apiRequest<any>("/customers", {
    method: "POST",
    body: {
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      loyalty_number: input.loyaltyNumber ?? null,
    },
  });
  return normalizeCustomer(data);
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer> {
  if (USE_MOCK_API) {
    const index = mockDb.customers.findIndex((customer) => customer.id === id);
    if (index < 0) throw new Error("Customer not found");
    mockDb.customers[index] = { ...mockDb.customers[index], ...input };
    return { ...mockDb.customers[index] };
  }
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.phone !== undefined) body.phone = input.phone || null;
  if (input.email !== undefined) body.email = input.email || null;
  if (input.address !== undefined) body.address = input.address || null;
  const data = await apiRequest<any>(`/customers/${id}`, { method: "PUT", body });
  return normalizeCustomer(data);
}

export async function deleteCustomer(id: string): Promise<void> {
  if (USE_MOCK_API) {
    mockDb.customers = mockDb.customers.filter((customer) => customer.id !== id);
    return;
  }
  await apiRequest<void>(`/customers/${id}`, { method: "DELETE" });
}
