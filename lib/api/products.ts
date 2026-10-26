import { apiRequest, USE_MOCK_API } from "./client";
import { mockCategories, mockProducts } from "./mock-data";
import type { Category, Paginated, Product } from "./types";

let products = [...mockProducts];

function normalizeProduct(p: any): Product {
  return {
    id: String(p.id),
    name: p.name,
    sku: p.sku,
    categoryId: p.category_id ? String(p.category_id) : "",
    categoryName: p.category?.name ?? "",
    price: Number(p.selling_price ?? p.price ?? 0),
    cost: Number(p.cost_price ?? p.cost ?? 0),
    taxRate: 0.1,
    stockByOutlet: {},
    active: p.is_active ?? true,
    barcode: p.barcodes?.[0]?.code,
    variants: (p.variants ?? []).map((v: any) => ({ id: String(v.id), name: v.name, price: Number(v.selling_price ?? 0), sku: v.sku })),
  };
}

export async function listProducts(params?: { search?: string; categoryId?: string; page?: number; pageSize?: number }): Promise<Paginated<Product>> {
  if (USE_MOCK_API) {
    let data = [...products];
    if (params?.search) {
      const q = params.search.toLowerCase();
      data = data.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (params?.categoryId) data = data.filter((p) => p.categoryId === params.categoryId);
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    return { data: data.slice(start, start + pageSize), page, pageSize, total: data.length, totalPages: Math.ceil(data.length / pageSize) };
  }
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.categoryId) qs.set("category_id", params.categoryId);
  qs.set("per_page", String(params?.pageSize ?? 50));
  const data = await apiRequest<any>(`/products?${qs.toString()}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  const meta = (data && !Array.isArray(data)) ? data : {};
  return {
    data: items.map(normalizeProduct),
    page: Number(meta.current_page ?? params?.page ?? 1),
    pageSize: Number(meta.per_page ?? params?.pageSize ?? 50),
    total: Number(meta.total ?? items.length),
    totalPages: Number(meta.last_page ?? 1),
  };
}

export async function getProduct(id: string): Promise<Product> {
  if (USE_MOCK_API) {
    const p = products.find((x) => x.id === id);
    if (!p) throw new Error("Not found");
    return p;
  }
  const data = await apiRequest<any>(`/products/${id}`);
  return normalizeProduct(data);
}

export async function createProduct(input: Partial<Product>): Promise<Product> {
  if (USE_MOCK_API) {
    const p: Product = {
      id: `p${Date.now()}`,
      name: input.name ?? "New Product",
      sku: input.sku ?? `SKU-${Date.now()}`,
      categoryId: input.categoryId ?? "",
      categoryName: input.categoryName ?? "",
      price: input.price ?? 0,
      cost: input.cost ?? 0,
      taxRate: 0.1,
      stockByOutlet: {},
      active: input.active ?? true,
      barcode: input.barcode,
    };
    products = [p, ...products];
    return p;
  }
  const body: any = {
    name: input.name,
    sku: input.sku,
    category_id: input.categoryId ? Number(input.categoryId) : null,
    cost_price: input.cost,
    selling_price: input.price,
    is_active: input.active ?? true,
  };
  const data = await apiRequest<any>("/products", { method: "POST", body });
  return normalizeProduct(data);
}

export async function updateProduct(id: string, input: Partial<Product>): Promise<Product> {
  if (USE_MOCK_API) {
    const idx = products.findIndex((x) => x.id === id);
    if (idx < 0) throw new Error("Not found");
    products[idx] = { ...products[idx], ...input };
    return products[idx];
  }
  const body: any = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.sku !== undefined) body.sku = input.sku;
  if (input.categoryId !== undefined) body.category_id = input.categoryId ? Number(input.categoryId) : null;
  if (input.cost !== undefined) body.cost_price = input.cost;
  if (input.price !== undefined) body.selling_price = input.price;
  if (input.active !== undefined) body.is_active = input.active;
  const data = await apiRequest<any>(`/products/${id}`, { method: "PUT", body });
  return normalizeProduct(data);
}

export async function listCategories(): Promise<Category[]> {
  if (USE_MOCK_API) return [...mockCategories];
  const data = await apiRequest<any>("/categories");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map((c: any) => ({ id: String(c.id), name: c.name, productCount: 0 }));
}
