"use client";

// Opt out of instant-navigation validation: these pages render data-dependent client UI.
export const instant = false;


import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import {
  Badge,
  Button,
  ChipButton,
  EmptyState,
  Field,
  Input,
  PageSizeSelect,
  Select,
  Switch,
} from "@/components/ui/primitives";
import { DataTable, Pagination, TablePagination, type Column } from "@/components/ui/table";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  createCategory,
  createProduct,
  listCategories,
  listProducts,
  updateProduct,
  type ProductInput,
} from "@/lib/api/products";
import { stockByOutlet } from "@/lib/api/inventory";
import type { Category, Product } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/formatting/currency";
import { useBusiness } from "@/lib/business/context";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useDebouncedValue, useSearchParamState, replaceSearchParam } from "@/lib/use-debounced";

type StatusFilter = "all" | "active" | "inactive";

export default function ProductsPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outletId, outlet } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch, searchReady] = useSearchParamState("q");
  const [categoryId, setCategoryId] = React.useState("all");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);
  const debounced = useDebouncedValue(search, 300);
  const currency = session?.business.currency ?? "IDR";

  React.useEffect(() => {
    if (!searchReady) return;
    replaceSearchParam("q", debounced.trim());
  }, [debounced, searchReady]);

  React.useEffect(() => {
    setPage(1);
  }, [debounced, categoryId, status, pageSize]);

  const productsQuery = useQuery({
    queryKey: ["products", debounced, categoryId, status, page, pageSize],
    queryFn: () =>
      listProducts({
        search: debounced.trim() || undefined,
        categoryId: categoryId === "all" ? undefined : categoryId,
        active: status === "all" ? undefined : status === "active",
        page,
        pageSize,
      }),
    enabled: has("products.view"),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
    enabled: has("products.view"),
    staleTime: 5 * 60_000,
  });

  const stockQuery = useQuery({
    queryKey: ["products-stock", outletId],
    queryFn: () => stockByOutlet(outletId!),
    enabled: has("products.view") && has("inventory.view") && Boolean(outletId),
    staleTime: 30_000,
  });

  const stockMap = React.useMemo(
    () => new Map((stockQuery.data ?? []).map((row) => [row.productId, row.stock])),
    [stockQuery.data]
  );

  if (!has("products.view")) {
    return <AccessDenied permission="products.view" />;
  }

  const rows = productsQuery.data?.data ?? [];
  const activeFilters = Boolean(debounced.trim()) || categoryId !== "all" || status !== "all";
  const canManage = has("products.manage");

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (product: Product) => {
    if (!canManage) return;
    setEditing(product);
    setEditorOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryId("all");
    setStatus("all");
  };

  const columns: Column<Product>[] = [
    {
      id: "product",
      header: "Product",
      cell: (row) => (
        <div className="row" style={{ gap: 9 }}>
          <span className="avatar" aria-hidden="true">
            {row.name.slice(0, 1).toUpperCase()}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{row.name}</div>
            <div className="hint mono" style={{ fontSize: 10.5 }}>
              {row.sku}
              {row.barcode ? ` · ${row.barcode}` : ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      cell: (row) => <span className="cell-muted">{row.categoryName || "Uncategorised"}</span>,
    },
    {
      id: "price",
      header: "Price",
      align: "right",
      cell: (row) => <span className="num" style={{ fontWeight: 600 }}>{formatCurrency(row.price, currency)}</span>,
    },
    {
      id: "cost",
      header: "Cost",
      align: "right",
      cell: (row) => <span className="cell-muted num">{formatCurrency(row.cost, currency)}</span>,
    },
    {
      id: "margin",
      header: "Margin",
      align: "right",
      cell: (row) => {
        if (row.price <= 0) return <span className="hint">—</span>;
        const margin = ((row.price - row.cost) / row.price) * 100;
        return (
          <span className="num" style={{ color: margin < 0 ? "hsl(var(--danger))" : "hsl(var(--ink-2))" }}>
            {margin.toFixed(1)}%
          </span>
        );
      },
    },
    ...(has("inventory.view")
      ? [
          {
            id: "stock",
            header: "Stock",
            align: "right" as const,
            cell: (row: Product) => {
              if (row.trackInventory === false) return <span className="hint">Untracked</span>;
              const stock = stockMap.get(row.id) ?? 0;
              return (
                <Badge tone={stock <= 0 ? "danger" : stock <= 10 ? "warning" : "neutral"} dot>
                  {formatNumber(stock)} {row.unit ?? "pcs"}
                </Badge>
              );
            },
          },
        ]
      : []),
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge tone={row.active ? "success" : "neutral"} dot>
          {row.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            cell: (row: Product) => (
              <Button
                variant="quiet"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openEdit(row);
                }}
              >
                <Pencil aria-hidden="true" />
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Products"
        description="The catalog that powers the register, purchasing, and stock control."
        actions={
          <>
            {has("inventory.view") ? (
              <Link href="/inventory" className="btn btn--secondary">
                <Boxes aria-hidden="true" />
                Stock
              </Link>
            ) : null}
            {canManage ? (
              <Button variant="primary" onClick={openNew}>
                <PackagePlus aria-hidden="true" />
                New product
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="toolbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <label className="toolbar__search input-affix">
            <Search aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, SKU, or barcode"
              aria-label="Search products"
            />
            {search ? (
              <button type="button" className="icon-btn" onClick={() => setSearch("")} aria-label="Clear search">
                <X aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <label className="row row-tight hint" style={{ gap: 6 }}>
            <SlidersHorizontal aria-hidden="true" style={{ width: 13, height: 13 }} />
            Category
            <Select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              aria-label="Filter by category"
              style={{ width: 160 }}
            >
              <option value="all">All categories</option>
              {(categoriesQuery.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>
          <div className="chips" role="group" aria-label="Filter by status">
            <ChipButton active={status === "all"} onClick={() => setStatus("all")}>
              All
            </ChipButton>
            <ChipButton active={status === "active"} onClick={() => setStatus("active")}>
              Active
            </ChipButton>
            <ChipButton active={status === "inactive"} onClick={() => setStatus("inactive")}>
              Inactive
            </ChipButton>
          </div>
          <div className="spacer" />
          <span className="hint" style={{ margin: 0, whiteSpace: "nowrap" }}>
            {productsQuery.data ? `${formatNumber(productsQuery.data.total)} products` : "—"}
          </span>
          {activeFilters ? (
            <Button variant="quiet" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
        </div>

        {productsQuery.isError ? (
          <InlineError title="Products could not be loaded" error={productsQuery.error} onRetry={() => productsQuery.refetch()} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowId={(row) => row.id}
            loading={productsQuery.isLoading && !productsQuery.data}
            onRowClick={canManage ? openEdit : undefined}
            dense
            minWidth={820}
            empty={
              <EmptyState
                icon={<Package aria-hidden="true" />}
                title={activeFilters ? "No products match these filters" : "No products yet"}
                description={
                  activeFilters
                    ? "Try another category or clear the search."
                    : "Add the first product to make it available at the register."
                }
                actions={
                  activeFilters ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : canManage ? (
                    <Button variant="primary" onClick={openNew}>
                      Add first product
                    </Button>
                  ) : (
                    <span className="hint">Ask a manager to build the product catalog.</span>
                  )
                }
              />
            }
            mobile={(row) => {
              const stock = stockMap.get(row.id) ?? 0;
              return (
                <button
                  type="button"
                  className="record"
                  onClick={() => openEdit(row)}
                  style={{ width: "100%", textAlign: "left", background: "transparent", border: 0 }}
                  disabled={!canManage}
                >
                  <div className="record__top">
                    <div className="row" style={{ minWidth: 0 }}>
                      <span className="avatar" aria-hidden="true">
                        {row.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="record__title">{row.name}</div>
                        <div className="record__meta">
                          {row.categoryName || "Uncategorised"} · {row.sku}
                        </div>
                        <div className="row row-tight wrap" style={{ marginTop: 5 }}>
                          <Badge tone={row.active ? "success" : "neutral"} dot>
                            {row.active ? "Active" : "Inactive"}
                          </Badge>
                          {row.trackInventory !== false && has("inventory.view") ? (
                            <Badge tone={stock <= 0 ? "danger" : stock <= 10 ? "warning" : "neutral"}>
                              {formatNumber(stock)} {row.unit ?? "pcs"}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <b className="num">{formatCurrency(row.price, currency)}</b>
                      <div className="hint">{formatCurrency(row.cost, currency)} cost</div>
                    </div>
                  </div>
                </button>
              );
            }}
            footer={
              <TablePagination>
                <PageSizeSelect value={pageSize} onChange={setPageSize} options={[10, 20, 50]} />
                <Pagination
                  page={productsQuery.data?.page ?? page}
                  totalPages={productsQuery.data?.totalPages ?? 1}
                  total={productsQuery.data?.total ?? 0}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  label="products"
                />
              </TablePagination>
            }
          />
        )}
        {productsQuery.isFetching && productsQuery.data ? (
          <div className="hint" style={{ padding: "0 16px 12px" }}>
            Updating results…
          </div>
        ) : null}
      </Card>

      {has("inventory.view") && !stockQuery.isLoading && productsQuery.data?.total ? (
        <p className="hint" style={{ margin: 0 }}>
          Stock column reflects {outlet?.name ?? "the selected outlet"}. Products without a balance are shown as zero.
        </p>
      ) : null}

      <ProductEditor
        open={editorOpen}
        product={editing}
        categories={categoriesQuery.data ?? []}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["products"] });
          void queryClient.invalidateQueries({ queryKey: ["categories"] });
          void queryClient.invalidateQueries({ queryKey: ["pos-products"] });
        }}
        outletName={outlet?.name ?? "this outlet"}
        currency={currency}
      />
    </>
  );
}

function ProductEditor({
  open,
  product,
  categories,
  outletName,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  product: Product | null;
  categories: Category[];
  outletName: string;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    name: "",
    sku: "",
    categoryId: "",
    price: "",
    cost: "",
    unit: "pcs",
    trackInventory: true,
    active: true,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [newCategoryOpen, setNewCategoryOpen] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryError, setNewCategoryError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setNewCategoryOpen(false);
    setNewCategoryName("");
    setNewCategoryError(null);
    setForm(
      product
        ? {
            name: product.name,
            sku: product.sku,
            categoryId: product.categoryId || "",
            price: String(product.price),
            cost: String(product.cost),
            unit: product.unit ?? "pcs",
            trackInventory: product.trackInventory !== false,
            active: product.active,
          }
        : {
            name: "",
            sku: "",
            categoryId: "",
            price: "",
            cost: "",
            unit: "pcs",
            trackInventory: true,
            active: true,
          }
    );
  }, [open, product]);

  const margin = React.useMemo(() => {
    const price = Number(form.price);
    const cost = Number(form.cost);
    if (!Number.isFinite(price) || price <= 0) return null;
    return ((price - cost) / price) * 100;
  }, [form.price, form.cost]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const next: Record<string, string> = {};
      if (!form.name.trim()) next.name = "Give the product a name.";
      if (!form.sku.trim()) next.sku = "A SKU is required for the register and stock records.";
      if (form.price === "" || Number(form.price) < 0 || !Number.isFinite(Number(form.price))) {
        next.price = "Enter a selling price of zero or more.";
      }
      if (form.cost === "" || Number(form.cost) < 0 || !Number.isFinite(Number(form.cost))) {
        next.cost = "Enter a cost price of zero or more.";
      }
      setErrors(next);
      if (Object.keys(next).length) throw new Error("Check the highlighted fields");

      const input: ProductInput = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        categoryId: form.categoryId || undefined,
        price: Number(form.price),
        cost: Number(form.cost),
        unit: form.unit.trim() || "pcs",
        trackInventory: form.trackInventory,
        active: form.active,
      };
      if (product) return updateProduct(product.id, input);
      return createProduct(input);
    },
    onSuccess: (saved) => {
      push({
        title: product ? "Product updated" : "Product created",
        description: `${saved.name} is ${saved.active ? "active" : "inactive"} at the register.`,
        variant: "success",
      });
      onSaved();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Check the highlighted fields") return;
      setErrors((current) => ({
        ...current,
        form: error instanceof Error ? error.message : "The product could not be saved.",
      }));
    },
  });

  const categoryMutation = useMutation({
    mutationFn: () => createCategory(newCategoryName.trim()),
    onSuccess: (category) => {
      queryClient.setQueryData<Category[]>(["categories"], (current) => {
        if (!current) return [category];
        return [...current, category];
      });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setForm((current) => ({ ...current, categoryId: category.id }));
      setNewCategoryOpen(false);
      setNewCategoryName("");
      setNewCategoryError(null);
    },
    onError: (error) => {
      setNewCategoryError(error instanceof Error ? error.message : "The category could not be created.");
    },
  });

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={product ? "Edit product" : "New product"}
        description={
          product
            ? `${product.sku} · stock is adjusted from Inventory`
            : `Add an item to the catalog for ${outletName}.`
        }
        width={500}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="product-editor"
              variant="primary"
              loading={saveMutation.isPending}
            >
              {product ? "Save changes" : "Create product"}
            </Button>
          </>
        }
      >
        <form
          id="product-editor"
          className="stack"
          style={{ gap: 16 }}
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          {errors.form ? (
            <div className="alert alert--danger" role="alert">
              {errors.form}
            </div>
          ) : null}

          <Field label="Product name" htmlFor="product-name" required error={errors.name}>
            <Input
              id="product-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="For example: Espresso"
              autoFocus
            />
          </Field>

          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="SKU" htmlFor="product-sku" required error={errors.sku}>
              <Input
                id="product-sku"
                value={form.sku}
                onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
                placeholder="COF-ESP-01"
                className="mono"
              />
            </Field>
            <Field label="Unit" htmlFor="product-unit" hint="How the item is sold.">
              <Input
                id="product-unit"
                value={form.unit}
                onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
                placeholder="pcs"
              />
            </Field>
          </div>

          <Field label="Category" htmlFor="product-category" hint="Optional. Categories drive storefront filters and reports.">
            <div className="row" style={{ gap: 8 }}>
              <Select
                id="product-category"
                value={form.categoryId}
                onChange={(event) => {
                  if (event.target.value === "__new") {
                    setNewCategoryOpen(true);
                    return;
                  }
                  setForm((current) => ({ ...current, categoryId: event.target.value }));
                }}
                style={{ flex: 1 }}
              >
                <option value="">Uncategorised</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value="__new">+ Create a category…</option>
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setNewCategoryOpen(true)}
                aria-label="Create a category"
              >
                <Plus aria-hidden="true" />
              </Button>
            </div>
          </Field>

          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="Selling price" htmlFor="product-price" required error={errors.price}>
              <Input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                placeholder="0"
              />
            </Field>
            <Field label="Cost price" htmlFor="product-cost" required error={errors.cost} hint="Used for margin and stock value.">
              <Input
                id="product-cost"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.cost}
                onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))}
                placeholder="0"
              />
            </Field>
          </div>

          {margin !== null ? (
            <div className="inset">
              <div className="row between">
                <span className="hint" style={{ margin: 0 }}>
                  Gross margin at this price
                </span>
                <b className="num" style={{ color: margin < 0 ? "hsl(var(--danger))" : "hsl(var(--success))" }}>
                  {margin.toFixed(1)}%
                </b>
              </div>
              <p className="hint" style={{ margin: "4px 0 0" }}>
                {formatCurrency(Number(form.price) - Number(form.cost), currency)} per {form.unit || "unit"} before tax and
                overhead. This is a preview, not a profitability report.
              </p>
            </div>
          ) : null}

          <div className="stack-sm" style={{ gap: 12 }}>
            <Switch
              label="Track inventory"
              description="Sales decrement stock at the selected outlet. Turn this off for services or untracked items."
              checked={form.trackInventory}
              onChange={(event) => setForm((current) => ({ ...current, trackInventory: event.target.checked }))}
            />
            <Switch
              label="Available at the register"
              description="Inactive products remain in reporting and history but cannot be sold."
              checked={form.active}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
            />
          </div>

          {product ? (
            <p className="hint">
              Stock is not edited here. Use{" "}
              <Link href="/inventory" className="text-primary" onClick={onClose}>
                Inventory
              </Link>{" "}
              so every change has a reason and an owner.
            </p>
          ) : null}
        </form>
      </Sheet>

      <Dialog
        open={newCategoryOpen}
        onClose={() => {
          setNewCategoryOpen(false);
          setNewCategoryError(null);
        }}
        title="New category"
        description="Categories group products in the register and in sales reports."
        width={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewCategoryOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={categoryMutation.isPending}
              disabled={!newCategoryName.trim()}
              onClick={() => categoryMutation.mutate()}
            >
              Create category
            </Button>
          </>
        }
      >
        <Field label="Category name" htmlFor="category-name" required error={newCategoryError}>
          <Input
            id="category-name"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="For example: Coffee"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && newCategoryName.trim()) {
                event.preventDefault();
                categoryMutation.mutate();
              }
            }}
          />
        </Field>
      </Dialog>
    </>
  );
}

