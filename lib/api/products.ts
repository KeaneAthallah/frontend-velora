import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type { Category, Paginated, Product } from "./types";

export type ProductInput = {
  name: string;
  sku: string;
  categoryId?: string;
  price: number;
  cost: number;
  unit?: string;
  trackInventory?: boolean;
  active?: boolean;
};

function normalizeProduct(product: any): Product {
  return {
    id: String(product.id),
    name: product.name,
    sku: product.sku,
    categoryId: product.category_id ? String(product.category_id) : "",
    categoryName: product.category?.name ?? "",
    price: Number(product.selling_price ?? product.price ?? 0),
    cost: Number(product.cost_price ?? product.cost ?? 0),
    taxRate: Number(product.tax_rate ?? 0),
    stockByOutlet: {},
    active: product.is_active ?? true,
    trackInventory: product.track_inventory ?? true,
    unit: product.unit ?? "pcs",
    barcode: product.barcodes?.[0]?.code,
    variants: (product.variants ?? []).map((variant: any) => ({
      id: String(variant.id),
      name: variant.name,
      price: Number(variant.selling_price ?? 0),
      sku: variant.sku,
    })),
  };
}

export async function listProducts(params?: {
  search?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
  activeOnly?: boolean;
  active?: boolean;
}): Promise<Paginated<Product>> {
  if (USE_MOCK_API) {
    let data = mockDb.products.map((product) => ({ ...product, stockByOutlet: { ...product.stockByOutlet } }));
    if (params?.activeOnly) data = data.filter((product) => product.active);
    if (params?.active !== undefined) data = data.filter((product) => product.active === params.active);
    if (params?.search) {
      const query = params.search.toLowerCase();
      data = data.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) ||
          (product.barcode ?? "").includes(query)
      );
    }
    if (params?.categoryId) data = data.filter((product) => product.categoryId === params.categoryId);
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
  if (params?.categoryId) query.set("category_id", params.categoryId);
  if (params?.activeOnly) query.set("is_active", "true");
  else if (params?.active !== undefined) query.set("is_active", String(params.active));
  query.set("page", String(params?.page ?? 1));
  query.set("per_page", String(params?.pageSize ?? 50));
  const data = await apiRequest<any>(`/products?${query.toString()}`);
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    data: items.map(normalizeProduct),
    page: Number(data?.current_page ?? params?.page ?? 1),
    pageSize: Number(data?.per_page ?? params?.pageSize ?? 50),
    total: Number(data?.total ?? items.length),
    totalPages: Number(data?.last_page ?? 1),
  };
}

export async function getProduct(id: string): Promise<Product> {
  if (USE_MOCK_API) {
    const product = mockDb.products.find((item) => item.id === id);
    if (!product) throw new Error("Product not found");
    return { ...product, stockByOutlet: { ...product.stockByOutlet } };
  }
  const data = await apiRequest<any>(`/products/${id}`);
  return normalizeProduct(data);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  if (USE_MOCK_API) {
    const category = mockDb.categories.find((item) => item.id === input.categoryId);
    const product: Product = {
      id: mockId("p"),
      name: input.name,
      sku: input.sku,
      categoryId: input.categoryId ?? "",
      categoryName: category?.name ?? "",
      price: input.price,
      cost: input.cost,
      taxRate: 0,
      stockByOutlet: Object.fromEntries(mockDb.outlets.map((outlet) => [outlet.id, 0])),
      active: input.active ?? true,
      trackInventory: input.trackInventory ?? true,
      unit: input.unit ?? "pcs",
    };
    mockDb.products = [product, ...mockDb.products];
    return product;
  }
  const body = {
    name: input.name,
    sku: input.sku,
    category_id: input.categoryId ? Number(input.categoryId) : null,
    cost_price: input.cost,
    selling_price: input.price,
    unit: input.unit ?? "pcs",
    track_inventory: input.trackInventory ?? true,
    is_active: input.active ?? true,
  };
  const data = await apiRequest<any>("/products", { method: "POST", body });
  return normalizeProduct(data);
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  if (USE_MOCK_API) {
    const index = mockDb.products.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Product not found");
    const category = input.categoryId ? mockDb.categories.find((item) => item.id === input.categoryId) : undefined;
    mockDb.products[index] = {
      ...mockDb.products[index],
      ...input,
      categoryName: category?.name ?? mockDb.products[index].categoryName,
    };
    return { ...mockDb.products[index], stockByOutlet: { ...mockDb.products[index].stockByOutlet } };
  }
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.sku !== undefined) body.sku = input.sku;
  if (input.categoryId !== undefined) body.category_id = input.categoryId ? Number(input.categoryId) : null;
  if (input.cost !== undefined) body.cost_price = input.cost;
  if (input.price !== undefined) body.selling_price = input.price;
  if (input.unit !== undefined) body.unit = input.unit;
  if (input.trackInventory !== undefined) body.track_inventory = input.trackInventory;
  if (input.active !== undefined) body.is_active = input.active;
  const data = await apiRequest<any>(`/products/${id}`, { method: "PUT", body });
  return normalizeProduct(data);
}

export async function setProductActive(id: string, active: boolean): Promise<Product> {
  return updateProduct(id, { active });
}

export async function listCategories(): Promise<Category[]> {
  if (USE_MOCK_API) {
    return mockDb.categories.map((category) => ({
      ...category,
      productCount: mockDb.products.filter((product) => product.categoryId === category.id).length,
    }));
  }
  const data = await apiRequest<any>("/categories");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map((category: any) => ({
    id: String(category.id),
    name: category.name,
    productCount: Number(category.products_count ?? 0),
  }));
}

export async function createCategory(name: string): Promise<Category> {
  if (USE_MOCK_API) {
    const category: Category = { id: mockId("c"), name, productCount: 0 };
    mockDb.categories = [...mockDb.categories, category];
    return category;
  }
  const data = await apiRequest<any>("/categories", {
    method: "POST",
    body: { name, is_active: true },
  });
  return { id: String(data.id), name: data.name, productCount: 0 };
}
