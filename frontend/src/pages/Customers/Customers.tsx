import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  PencilLine,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import { Button } from "../../components/ui/button";
import {
  createCustomer,
  deleteCustomer,
  getApiErrorMessage,
  getCustomers,
  type Customer,
  type CustomerInput,
  updateCustomer,
} from "../../services/customers";

const emptyForm: CustomerInput = {
  company_id: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
};

const PAGE_SIZE = 8;

function matchesSearch(customer: Customer, query: string) {
  const haystack = [
    customer.company_id,
    customer.name,
    customer.email,
    customer.phone,
    customer.address,
    customer.notes ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function formatCustomerId(customer: Customer) {
  if (customer.id) {
    return customer.id;
  }

  return customer.company_id || "N/A";
}

function validateCustomerForm(form: CustomerInput) {
  if (!form.company_id.trim()) {
    return "Company ID is required.";
  }

  if (!form.name.trim()) {
    return "Customer name is required.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Please enter a valid email address.";
  }

  if (!form.phone.trim()) {
    return "Phone number is required.";
  }

  if (!form.address.trim()) {
    return "Address is required.";
  }

  return null;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerInput>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadCustomers() {
      try {
        setLoading(true);
        setError(null);

        const data = await getCustomers();

        if (mounted) {
          setCustomers(data);
        }
      } catch (requestError) {
        if (mounted) {
          setError(getApiErrorMessage(requestError, "Failed to load customers. Please try again."));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadCustomers();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    const trimmedQuery = search.trim();

    if (!trimmedQuery) {
      return customers;
    }

    return customers.filter((customer) => matchesSearch(customer, trimmedQuery));
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageCustomers = filteredCustomers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalCount = filteredCustomers.length;

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  function openCreateDialog() {
    setDialogMode("create");
    setSelectedCustomer(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEditDialog(customer: Customer) {
    setDialogMode("edit");
    setSelectedCustomer(customer);
    setForm({
      company_id: customer.company_id ?? "",
      name: customer.name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
    });
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog(force = false) {
    if (submitting && !force) {
      return;
    }

    setDialogOpen(false);
    setSelectedCustomer(null);
    setForm(emptyForm);
  }

  async function refreshCustomers() {
    const data = await getCustomers();
    setCustomers(data);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateCustomerForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (dialogMode === "edit" && selectedCustomer?.id) {
        await updateCustomer(selectedCustomer.id, { ...form, email: form.email.trim(), phone: form.phone.trim() });
      } else {
        await createCustomer({ ...form, email: form.email.trim(), phone: form.phone.trim() });
      }

      await refreshCustomers();
      closeDialog(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to save the customer right now."));
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
      await deleteCustomer(deleteTarget.id);
      await refreshCustomers();
      setDeleteTarget(null);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to delete the customer right now."));
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
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-blue-600">
                Customer Module
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-950">
                Customers
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Manage customer records, contact details, and company references.
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
                  placeholder="Search customers"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition-all duration-200 ease-out focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <Button onClick={openCreateDialog} className="h-11 rounded-2xl px-4">
                <Plus className="mr-2 h-4 w-4" />
                New Customer
              </Button>
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Customer Directory</h2>
                <p className="text-sm text-slate-500">
                  {loading ? "Loading customers..." : `${totalCount} customer${totalCount === 1 ? "" : "s"} found`}
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
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Company</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Address</th>
                    <th className="px-6 py-4">Notes</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    Array.from({ length: PAGE_SIZE }).map((_, index) => (
                      <tr key={index} className="animate-pulse">
                        <td className="px-6 py-5">
                          <div className="h-4 w-40 rounded bg-slate-200" />
                          <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
                        </td>
                        <td className="px-6 py-5"><div className="h-4 w-28 rounded bg-slate-200" /></td>
                        <td className="px-6 py-5"><div className="h-4 w-36 rounded bg-slate-200" /></td>
                        <td className="px-6 py-5"><div className="h-4 w-44 rounded bg-slate-200" /></td>
                        <td className="px-6 py-5"><div className="h-4 w-32 rounded bg-slate-200" /></td>
                        <td className="px-6 py-5 text-right"><div className="ml-auto h-4 w-24 rounded bg-slate-200" /></td>
                      </tr>
                    ))
                  ) : pageCustomers.length > 0 ? (
                    pageCustomers.map((customer) => (
                      <tr key={customer.id ?? `${customer.company_id}-${customer.email}`} className="transition hover:bg-slate-50/80">
                        <td className="px-6 py-5 align-top">
                          <div className="font-semibold text-slate-950">{customer.name}</div>
                          <div className="mt-1 text-sm text-slate-500">ID: {formatCustomerId(customer)}</div>
                        </td>
                        <td className="px-6 py-5 align-top text-sm text-slate-700">{customer.company_id}</td>
                        <td className="px-6 py-5 align-top">
                          <div className="text-sm font-medium text-slate-700">{customer.email}</div>
                          <div className="text-sm text-slate-500">{customer.phone}</div>
                        </td>
                        <td className="px-6 py-5 align-top text-sm text-slate-700">{customer.address}</td>
                        <td className="px-6 py-5 align-top text-sm text-slate-500">
                          <div className="max-w-xs truncate">{customer.notes || "-"}</div>
                        </td>
                        <td className="px-6 py-5 align-top text-right">
                          <div className="inline-flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(customer)}
                              className="rounded-xl"
                            >
                              <PencilLine className="mr-2 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTarget(customer)}
                              className="rounded-xl"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="mx-auto max-w-md">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <Search className="h-6 w-6" />
                          </div>
                          <h3 className="mt-5 text-xl font-semibold text-slate-950">
                            {search ? "No matching customers" : "No customers yet"}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {search
                              ? "Try another search term or clear the filters to view the full list."
                              : "Create the first customer record to start building the directory."}
                          </p>
                          {!search ? (
                            <Button onClick={openCreateDialog} className="mt-6 rounded-2xl px-5">
                              <Plus className="mr-2 h-4 w-4" />
                              Add Customer
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
                Showing {pageCustomers.length} of {totalCount} customer{totalCount === 1 ? "" : "s"}
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
          <div className="w-full max-w-2xl rounded-[32px] border border-slate-200/80 bg-white shadow-[0_30px_100px_-45px_rgba(15,23,42,0.6)]">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                  {dialogMode === "create" ? "New Customer" : "Edit Customer"}
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-950">
                  {dialogMode === "create" ? "Create customer record" : "Update customer details"}
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
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Company ID</span>
                <input
                  required
                  value={form.company_id}
                  onChange={(event) => setForm((current) => ({ ...current, company_id: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500"
                  placeholder="Company identifier"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Customer Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500"
                  placeholder="Full name"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500"
                  placeholder="name@company.com"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Phone</span>
                <input
                  required
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500"
                  placeholder="Phone number"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Address</span>
                <input
                  required
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-blue-500"
                  placeholder="Office or billing address"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                  placeholder="Optional notes about this customer"
                />
              </label>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end">
                <Button variant="outline" type="button" onClick={() => closeDialog()} className="rounded-2xl px-5">
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl px-5" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {dialogMode === "create" ? "Create Customer" : "Save Changes"}
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
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-600">
                  Delete Customer
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-950">
                  Remove {deleteTarget.name}?
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This action will permanently delete the customer record from Supabase.
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
                Delete Customer
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
