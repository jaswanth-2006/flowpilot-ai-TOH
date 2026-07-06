import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  PencilLine,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "../../components/ui/button";
import {
  createProduct,
  deleteProduct,
  getProducts,
  getSuppliers,
  updateProduct,
  type Product,
  type ProductInput,
  type Supplier,
} from "../../services/products";

const PAGE_SIZE = 8;

const emptyForm: ProductInput = {
  supplier_id: "",
  name: "",
  sku: "",
  category: "",
  price: 0,
  inventory: 0,
  description: "",
};

function normalizeSupplierLabel(supplier: Supplier) {
  return (
    supplier.name ??
    supplier.supplier_name ??
    supplier.company_name ??
    supplier.email ??
    supplier.id ??
    "Unknown Supplier"
  );
}

function matchesSearch(product: Product, supplierLabel: string, query: string) {
  const haystack = [
    product.name,
    product.sku,
    product.category,
    product.description ?? "",
    product.supplier_id,
    supplierLabel,
    String(product.price),
    String(product.inventory),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function stockLabel(inventory: number) {
  if (inventory <= 0) {
    return { text: "Out of Stock", className: "bg-rose-50 text-rose-700" };
  }

  if (inventory <= 10) {
    return { text: "Low Stock", className: "bg-amber-50 text-amber-700" };
  }

  return { text: "In Stock", className: "bg-emerald-50 text-emerald-700" };
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierLoading, setSupplierLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      try {
        setLoading(true);
        const data = await getProducts();

        if (mounted) {
          setProducts(data);
        }
      } catch {
        if (mounted) {
          setError("Failed to load products. Please try again.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    async function loadSuppliers() {
      try {
        setSupplierLoading(true);
        const data = await getSuppliers();

        if (mounted) {
          setSuppliers(data);
        }
      } catch {
        if (mounted) {
          setSuppliers([]);
        }
      } finally {
        if (mounted) {
          setSupplierLoading(false);
        }
      }
    }

    void loadProducts();
    void loadSuppliers();

    return () => {
      mounted = false;
    };
  }, []);

  const supplierMap = useMemo(() => {
    return new Map(
      suppliers.map((supplier) => [supplier.id ?? "", normalizeSupplierLabel(supplier)]),
    );
  }, [suppliers]);

  const productRows = useMemo(() => {
    const trimmed = search.trim();

    if (!trimmed) {
      return products;
    }

    return products.filter((product) => matchesSearch(product, supplierMap.get(product.supplier_id) ?? "", trimmed));
  }, [products, search, supplierMap]);

  const totalPages = Math.max(1, Math.ceil(productRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageRows = productRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalCount = productRows.length;

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  function openCreateDialog() {
    setDialogMode("create");
    setSelectedProduct(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(product: Product) {
    setDialogMode("edit");
    setSelectedProduct(product);
    setForm({
      supplier_id: product.supplier_id ?? "",
      name: product.name ?? "",
      sku: product.sku ?? "",
      category: product.category ?? "",
      price: Number(product.price ?? 0),
      inventory: Number(product.inventory ?? 0),
      description: product.description ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog(force = false) {
    if (submitting && !force) {
      return;
    }

    setDialogOpen(false);
    setSelectedProduct(null);
    setForm(emptyForm);
  }

  async function refreshProducts() {
    const data = await getProducts();
    setProducts(data);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);

      if (dialogMode === "edit" && selectedProduct?.id) {
        await updateProduct(selectedProduct.id, form);
      } else {
        await createProduct(form);
      }

      await refreshProducts();
      closeDialog(true);
    } catch {
      setError("Unable to save the product right now.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?.id) {
      setDeleteTarget(null);
      return;
    }

    try {
      setSubmitting(true);
      await deleteProduct(deleteTarget.id);
      await refreshProducts();
      setDeleteTarget(null);
    } catch {
      setError("Unable to delete the product right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <div className="mb-8 flex flex-col gap-4 rounded-[32px] border border-slate-200/80 bg-white/85 px-6 py-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-blue-600">Inventory Module</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Products</h1>
            <p className="mt-2 text-sm text-slate-500">
              Track product records, supplier mapping, and inventory levels in one place.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-72 flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search products"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>

            <Button onClick={openCreateDialog} className="h-11 rounded-2xl px-4">
              <Plus className="mr-2 h-4 w-4" />
              New Product
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Product Directory</h2>
              <p className="text-sm text-slate-500">
                {loading ? "Loading products..." : `${totalCount} product${totalCount === 1 ? "" : "s"} found`}
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Page {safePage} of {totalPages}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Supplier</th>
                  <th className="px-6 py-4">Inventory</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  Array.from({ length: PAGE_SIZE }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td className="px-6 py-5"><div className="h-4 w-40 rounded bg-slate-200" /><div className="mt-2 h-3 w-28 rounded bg-slate-100" /></td>
                      <td className="px-6 py-5"><div className="h-4 w-36 rounded bg-slate-200" /></td>
                      <td className="px-6 py-5"><div className="h-6 w-24 rounded-full bg-slate-200" /></td>
                      <td className="px-6 py-5"><div className="h-4 w-20 rounded bg-slate-200" /></td>
                      <td className="px-6 py-5"><div className="h-4 w-28 rounded bg-slate-200" /></td>
                      <td className="px-6 py-5 text-right"><div className="ml-auto h-4 w-24 rounded bg-slate-200" /></td>
                    </tr>
                  ))
                ) : pageRows.length > 0 ? (
                  pageRows.map((product) => {
                    const supplierLabel = supplierMap.get(product.supplier_id) ?? product.supplier_id;
                    const status = stockLabel(Number(product.inventory ?? 0));

                    return (
                      <tr key={product.id ?? `${product.sku}-${product.name}`} className="transition hover:bg-slate-50/80">
                        <td className="px-6 py-5 align-top">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                              <Package className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-950">{product.name}</div>
                              <div className="mt-1 text-sm text-slate-500">SKU: {product.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 align-top text-sm text-slate-700">{supplierLabel}</td>
                        <td className="px-6 py-5 align-top">
                          <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                            {status.text} • {Number(product.inventory ?? 0)} units
                          </div>
                        </td>
                        <td className="px-6 py-5 align-top text-sm font-medium text-slate-700">
                          ₹{Number(product.price ?? 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-6 py-5 align-top text-sm text-slate-700">{product.category}</td>
                        <td className="px-6 py-5 align-top text-right">
                          <div className="inline-flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(product)} className="rounded-xl">
                              <PencilLine className="mr-2 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(product)} className="rounded-xl">
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-md">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                          <Package className="h-6 w-6" />
                        </div>
                        <h3 className="mt-5 text-xl font-semibold text-slate-950">
                          {search ? "No matching products" : "No products yet"}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {search
                            ? "Try another search term or clear the filters to view the full inventory."
                            : "Add the first product to start managing your inventory."}
                        </p>
                        {!search ? (
                          <Button onClick={openCreateDialog} className="mt-6 rounded-2xl px-5">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Product
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">Showing {pageRows.length} of {totalCount} product{totalCount === 1 ? "" : "s"}</p>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safePage === 1} className="rounded-xl">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safePage === totalPages} className="rounded-xl">
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-md">
          <div className="w-full max-w-3xl rounded-[32px] border border-slate-200/80 bg-white shadow-[0_30px_100px_-45px_rgba(15,23,42,0.6)]">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                  {dialogMode === "create" ? "New Product" : "Edit Product"}
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-950">
                  {dialogMode === "create" ? "Create product record" : "Update product details"}
                </h3>
              </div>
              <button type="button" onClick={() => closeDialog()} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 px-6 py-6 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Supplier</span>
                <select
                  required
                  value={form.supplier_id}
                  onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500"
                  disabled={supplierLoading}
                >
                  <option value="">{supplierLoading ? "Loading suppliers..." : "Select supplier"}</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id ?? normalizeSupplierLabel(supplier)} value={supplier.id ?? ""}>
                      {normalizeSupplierLabel(supplier)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Product Name</span>
                <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500" placeholder="Product name" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">SKU</span>
                <input required value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500" placeholder="SKU-001" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Category</span>
                <input required value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500" placeholder="Category" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Price</span>
                <input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: Number(event.target.value) }))} className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500" placeholder="0.00" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Inventory</span>
                <input required type="number" min="0" step="1" value={form.inventory} onChange={(event) => setForm((current) => ({ ...current, inventory: Number(event.target.value) }))} className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500" placeholder="0" />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Description</span>
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500" placeholder="Optional product description" />
              </label>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end">
                <Button variant="outline" type="button" onClick={() => closeDialog()} className="rounded-2xl px-5">Cancel</Button>
                <Button type="submit" className="rounded-2xl px-5" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {dialogMode === "create" ? "Create Product" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_30px_100px_-45px_rgba(15,23,42,0.6)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-600">Delete Product</p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-950">Remove {deleteTarget.name}?</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">This action will permanently delete the product record from Supabase.</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" type="button" onClick={() => setDeleteTarget(null)} className="rounded-2xl px-5" disabled={submitting}>Cancel</Button>
              <Button variant="destructive" type="button" onClick={confirmDelete} className="rounded-2xl px-5" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete Product
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
