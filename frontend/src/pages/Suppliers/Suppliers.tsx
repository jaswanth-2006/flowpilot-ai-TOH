import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  PencilLine,
  Plus,
  Search,
  Star,
  Trash2,
  X,
  Truck,
} from "lucide-react";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import { Button } from "../../components/ui/button";
import {
  createSupplier,
  deleteSupplier,
  getApiErrorMessage,
  getSuppliers,
  updateSupplier,
  type Supplier,
  type SupplierInput,
} from "../../services/suppliers";

const PAGE_SIZE = 8;

const emptyForm: SupplierInput = {
  name: "",
  rating: 4.5,
  lead_time: "",
  address: "",
  products_supplied: [],
};

function matchesSearch(supplier: Supplier, query: string) {
  const haystack = [
    supplier.name,
    String(supplier.rating),
    supplier.lead_time,
    supplier.address,
    supplier.products_supplied.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function productsText(products: string[]) {
  return products.length > 0 ? products.join(", ") : "-";
}

function ratingColor(rating: number) {
  if (rating >= 4.5) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (rating >= 3.5) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-rose-50 text-rose-700";
}

function validateSupplierForm(form: SupplierInput) {
  if (!form.name.trim()) {
    return "Supplier name is required.";
  }

  if (!Number.isFinite(form.rating) || form.rating < 0 || form.rating > 5) {
    return "Rating must be between 0 and 5.";
  }

  if (!form.lead_time.trim()) {
    return "Lead time is required.";
  }

  if (!form.address.trim()) {
    return "Address is required.";
  }

  return null;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierInput>(emptyForm);
  const [productsTextInput, setProductsTextInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSuppliers() {
      try {
        setLoading(true);
        setError(null);
        const data = await getSuppliers();

        if (mounted) {
          setSuppliers(data);
        }
      } catch (requestError) {
        if (mounted) {
          setError(getApiErrorMessage(requestError, "Failed to load suppliers. Please try again."));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadSuppliers();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredSuppliers = useMemo(() => {
    const trimmedQuery = search.trim();

    if (!trimmedQuery) {
      return suppliers;
    }

    return suppliers.filter((supplier) => matchesSearch(supplier, trimmedQuery));
  }, [search, suppliers]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageSuppliers = filteredSuppliers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalCount = filteredSuppliers.length;

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  function openCreateDialog() {
    setDialogMode("create");
    setSelectedSupplier(null);
    setForm(emptyForm);
    setProductsTextInput("");
    setError(null);
    setDialogOpen(true);
  }

  function openEditDialog(supplier: Supplier) {
    setDialogMode("edit");
    setSelectedSupplier(supplier);
    setForm({
      name: supplier.name ?? "",
      rating: supplier.rating ?? 0,
      lead_time: supplier.lead_time ?? "",
      address: supplier.address ?? "",
      products_supplied: supplier.products_supplied ?? [],
    });
    setProductsTextInput((supplier.products_supplied ?? []).join(", "));
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog(force = false) {
    if (submitting && !force) {
      return;
    }

    setDialogOpen(false);
    setSelectedSupplier(null);
    setForm(emptyForm);
    setProductsTextInput("");
  }

  async function refreshSuppliers() {
    const data = await getSuppliers();
    setSuppliers(data);
  }

  function buildPayload(): SupplierInput {
    const productsSupplied = productsTextInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      ...form,
      rating: Number(form.rating),
      products_supplied: productsSupplied,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateSupplierForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const payload = buildPayload();

      if (dialogMode === "edit" && selectedSupplier?.id) {
        await updateSupplier(selectedSupplier.id, payload);
      } else {
        await createSupplier(payload);
      }

      await refreshSuppliers();
      closeDialog(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to save the supplier right now."));
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
      await deleteSupplier(deleteTarget.id);
      await refreshSuppliers();
      setDeleteTarget(null);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to delete the supplier right now."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">
          <div className="mb-8 flex flex-col gap-4 rounded-[32px] border border-slate-200/80 bg-white/85 px-6 py-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-0.5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-blue-600">Vendor Module</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-950">Suppliers</h1>
              <p className="mt-2 text-sm text-slate-500">
                Track supplier ratings, lead times, addresses, and the products they supply.
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
                  placeholder="Search suppliers"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>

              <Button onClick={openCreateDialog} className="h-11 rounded-2xl px-4">
                <Plus className="mr-2 h-4 w-4" />
                New Supplier
              </Button>
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-0.5">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Supplier Directory</h2>
                <p className="text-sm text-slate-500">
                  {loading ? "Loading suppliers..." : `${totalCount} supplier${totalCount === 1 ? "" : "s"} found`}
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
                    <th className="px-6 py-4">Supplier</th>
                    <th className="px-6 py-4">Rating</th>
                    <th className="px-6 py-4">Lead Time</th>
                    <th className="px-6 py-4">Address</th>
                    <th className="px-6 py-4">Products Supplied</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    Array.from({ length: PAGE_SIZE }).map((_, index) => (
                      <tr key={index} className="animate-pulse">
                        <td className="px-6 py-5"><div className="h-4 w-40 rounded bg-slate-200" /><div className="mt-2 h-3 w-24 rounded bg-slate-100" /></td>
                        <td className="px-6 py-5"><div className="h-6 w-16 rounded-full bg-slate-200" /></td>
                        <td className="px-6 py-5"><div className="h-4 w-24 rounded bg-slate-200" /></td>
                        <td className="px-6 py-5"><div className="h-4 w-44 rounded bg-slate-200" /></td>
                        <td className="px-6 py-5"><div className="h-4 w-56 rounded bg-slate-200" /></td>
                        <td className="px-6 py-5 text-right"><div className="ml-auto h-4 w-24 rounded bg-slate-200" /></td>
                      </tr>
                    ))
                  ) : pageSuppliers.length > 0 ? (
                    pageSuppliers.map((supplier) => {
                      const ratingDisplay = Number(supplier.rating ?? 0).toFixed(1);
                      const ratingClass = ratingColor(Number(supplier.rating ?? 0));

                      return (
                        <tr key={supplier.id ?? supplier.name} className="transition hover:bg-slate-50/80">
                          <td className="px-6 py-5 align-top">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                                <Truck className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="font-semibold text-slate-950">{supplier.name}</div>
                                <div className="mt-1 text-sm text-slate-500">ID: {supplier.id ?? "N/A"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 align-top">
                            <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${ratingClass}`}>
                              <Star className="h-3.5 w-3.5 fill-current" />
                              {ratingDisplay}/5
                            </div>
                          </td>
                          <td className="px-6 py-5 align-top text-sm text-slate-700">{supplier.lead_time}</td>
                          <td className="px-6 py-5 align-top text-sm text-slate-700">{supplier.address}</td>
                          <td className="px-6 py-5 align-top text-sm text-slate-700">{productsText(supplier.products_supplied ?? [])}</td>
                          <td className="px-6 py-5 align-top text-right">
                            <div className="inline-flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(supplier)} className="rounded-xl">
                                <PencilLine className="mr-2 h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(supplier)} className="rounded-xl">
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
                            <Truck className="h-6 w-6" />
                          </div>
                          <h3 className="mt-5 text-xl font-semibold text-slate-950">
                            {search ? "No matching suppliers" : "No suppliers yet"}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {search
                              ? "Try another search term or clear the filters to view the full supplier list."
                              : "Create the first supplier record to start managing vendors."}
                          </p>
                          {!search ? (
                            <Button onClick={openCreateDialog} className="mt-6 rounded-2xl px-5">
                              <Plus className="mr-2 h-4 w-4" />
                              Add Supplier
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
              <p className="text-sm text-slate-500">
                Showing {pageSuppliers.length} of {totalCount} supplier{totalCount === 1 ? "" : "s"}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safePage === 1}
                  className="rounded-xl"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safePage === totalPages}
                  className="rounded-xl"
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-md">
          <div className="w-full max-w-3xl rounded-[32px] border border-slate-200/80 bg-white shadow-[0_30px_100px_-45px_rgba(15,23,42,0.6)]">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                  {dialogMode === "create" ? "New Supplier" : "Edit Supplier"}
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-950">
                  {dialogMode === "create" ? "Create supplier record" : "Update supplier details"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => closeDialog()}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 px-6 py-6 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Supplier Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500"
                  placeholder="Supplier name"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Rating</span>
                <input
                  required
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={form.rating}
                  onChange={(event) => setForm((current) => ({ ...current, rating: Number(event.target.value) }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500"
                  placeholder="4.5"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Lead Time</span>
                <input
                  required
                  value={form.lead_time}
                  onChange={(event) => setForm((current) => ({ ...current, lead_time: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500"
                  placeholder="3-5 business days"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Address</span>
                <input
                  required
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500"
                  placeholder="Supplier address"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Products Supplied</span>
                <textarea
                  value={productsTextInput}
                  onChange={(event) => setProductsTextInput(event.target.value)}
                  className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                  placeholder="Comma separated products supplied"
                />
              </label>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end">
                <Button variant="outline" type="button" onClick={() => closeDialog()} className="rounded-2xl px-5">
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl px-5" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {dialogMode === "create" ? "Create Supplier" : "Save Changes"}
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
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-600">Delete Supplier</p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-950">Remove {deleteTarget.name}?</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This action will permanently delete the supplier record from Supabase.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-2xl px-5"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                type="button"
                onClick={confirmDelete}
                className="rounded-2xl px-5"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete Supplier
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
