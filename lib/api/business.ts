import { apiRequest, USE_MOCK_API } from "./client";
import { mockBusiness, mockOutlets, mockPaymentMethods } from "./mock-data";
import type { Business, Outlet, PaymentMethod } from "./types";

export async function listBusinesses(): Promise<Business[]> {
  if (USE_MOCK_API) return [mockBusiness];
  const data = await apiRequest<any>("/businesses");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map((b: any) => ({ id: String(b.id), name: b.name, currency: b.currency ?? "IDR", timezone: b.timezone ?? "UTC" }));
}

export async function getBusiness(): Promise<Business> {
  if (USE_MOCK_API) return mockBusiness;
  const bs = await listBusinesses();
  return bs[0] ?? mockBusiness;
}

export async function listOutlets(): Promise<Outlet[]> {
  if (USE_MOCK_API) return [...mockOutlets];
  const data = await apiRequest<any>("/outlets");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map((o: any) => ({ id: String(o.id), name: o.name, businessId: String(o.business_id ?? ""), address: o.address }));
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  if (USE_MOCK_API) return [...mockPaymentMethods];
  // backend has no payment-methods endpoint; return defaults
  return [...mockPaymentMethods];
}
