import { apiRequest, USE_MOCK_API } from "./client";
import { mockPurchaseOrders, mockSuppliers } from "./mock-data";
import type { Paginated, PurchaseOrder, Supplier } from "./types";

export async function listSuppliers(): Promise<Supplier[]> {
  if (USE_MOCK_API) return [...mockSuppliers];
  const data = await apiRequest<any>("/suppliers");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map((s: any) => ({ id: String(s.id), name: s.name, contact: s.contact_person ?? "", email: s.email ?? "", phone: s.phone ?? "" }));
}

export async function listPurchaseOrders(params?: { page?: number; pageSize?: number }): Promise<Paginated<PurchaseOrder>> {
  if (USE_MOCK_API) {
    const pos = [...mockPurchaseOrders];
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    return { data: pos.slice(start, start + pageSize), page, pageSize, total: pos.length, totalPages: Math.ceil(pos.length / pageSize) };
  }
  const data = await apiRequest<any>("/purchase-orders?per_page=50");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    data: items.map((po: any) => ({
      id: String(po.id),
      number: po.po_number ?? `PO-${po.id}`,
      supplierId: String(po.supplier_id),
      supplierName: po.supplier?.name ?? "",
      outletId: String(po.outlet_id ?? ""),
      status: po.status ?? "draft",
      items: (po.items ?? []).map((it: any) => ({ productId: String(it.product_id), productName: it.product?.name ?? "", quantity: Number(it.quantity), cost: Number(it.unit_cost ?? 0) })),
      total: Number(po.total_amount ?? 0),
      createdAt: po.created_at ?? new Date().toISOString(),
    })),
    page: Number(data?.current_page ?? 1),
    pageSize: Number(data?.per_page ?? 50),
    total: Number(data?.total ?? items.length),
    totalPages: Number(data?.last_page ?? 1),
  };
}
