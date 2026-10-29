import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type { Business, Outlet } from "./types";

function mapBusiness(business: any): Business {
  return {
    id: String(business.id),
    name: business.name,
    currency: business.currency ?? "IDR",
    timezone: business.timezone ?? "UTC",
    address: business.settings?.address ?? business.address ?? undefined,
  };
}

export async function listBusinesses(): Promise<Business[]> {
  if (USE_MOCK_API) return [{ ...mockDb.business }];
  const data = await apiRequest<any>("/businesses");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map(mapBusiness);
}

export async function createBusiness(input: {
  name: string;
  currency?: string;
  timezone?: string;
}): Promise<Business> {
  if (USE_MOCK_API) {
    return {
      id: mockId("b"),
      name: input.name,
      currency: input.currency ?? "IDR",
      timezone: input.timezone ?? "Asia/Jakarta",
    };
  }
  const data = await apiRequest<any>("/businesses", {
    method: "POST",
    body: {
      name: input.name,
      currency: input.currency || null,
      timezone: input.timezone || null,
    },
  });
  return mapBusiness(data);
}

export async function getBusiness(): Promise<Business> {
  if (USE_MOCK_API) return { ...mockDb.business };
  const businesses = await listBusinesses();
  if (!businesses[0]) throw new Error("No business is attached to this account");
  return businesses[0];
}

export async function getBusinessDetails(id: string): Promise<Business> {
  if (USE_MOCK_API) {
    if (mockDb.business.id !== id) throw new Error("Business not found");
    return { ...mockDb.business };
  }
  const data = await apiRequest<any>(`/businesses/${id}`);
  return mapBusiness(data);
}

export async function updateBusiness(
  id: string,
  input: { name?: string; address?: string; currency?: string; timezone?: string }
): Promise<Business> {
  if (USE_MOCK_API) {
    if (mockDb.business.id !== id) throw new Error("Business not found");
    mockDb.business = { ...mockDb.business, ...input };
    return { ...mockDb.business };
  }
  const current = await apiRequest<any>(`/businesses/${id}`);
  const settings =
    input.address !== undefined
      ? { ...(current?.settings ?? {}), address: input.address }
      : undefined;
  const data = await apiRequest<any>(`/businesses/${id}`, {
    method: "PUT",
    body: {
      name: input.name,
      currency: input.currency,
      timezone: input.timezone,
      settings,
    },
  });
  return mapBusiness(data);
}

function mapOutlet(outlet: any): Outlet {
  return {
    id: String(outlet.id),
    businessId: String(outlet.business_id ?? ""),
    name: outlet.name,
    code: outlet.code ?? undefined,
    address: outlet.address ?? undefined,
    phone: outlet.phone ?? undefined,
  };
}

export async function listOutlets(): Promise<Outlet[]> {
  if (USE_MOCK_API) return mockDb.outlets.map((outlet) => ({ ...outlet }));
  const data = await apiRequest<any>("/outlets?per_page=50");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map(mapOutlet);
}

export async function createOutlet(input: {
  name: string;
  code: string;
  address?: string;
  phone?: string;
}): Promise<Outlet> {
  if (USE_MOCK_API) {
    const outlet: Outlet = {
      id: mockId("o"),
      businessId: mockDb.business.id,
      name: input.name,
      code: input.code,
      address: input.address,
      phone: input.phone,
    };
    mockDb.outlets = [...mockDb.outlets, outlet];
    mockDb.products = mockDb.products.map((product) => ({
      ...product,
      stockByOutlet: { ...product.stockByOutlet, [outlet.id]: 0 },
    }));
    return outlet;
  }
  const data = await apiRequest<any>("/outlets", {
    method: "POST",
    body: {
      name: input.name,
      code: input.code,
      address: input.address || null,
      phone: input.phone || null,
    },
  });
  return mapOutlet(data);
}

export async function updateOutlet(
  id: string,
  input: { name?: string; code?: string; address?: string; phone?: string }
): Promise<Outlet> {
  if (USE_MOCK_API) {
    const index = mockDb.outlets.findIndex((outlet) => outlet.id === id);
    if (index < 0) throw new Error("Outlet not found");
    mockDb.outlets[index] = { ...mockDb.outlets[index], ...input };
    return { ...mockDb.outlets[index] };
  }
  const data = await apiRequest<any>(`/outlets/${id}`, {
    method: "PUT",
    body: {
      name: input.name,
      code: input.code,
      address: input.address || null,
      phone: input.phone || null,
    },
  });
  return mapOutlet(data);
}

