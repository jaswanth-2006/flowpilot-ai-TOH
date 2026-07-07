import axios from "axios";
import { getApiErrorMessage } from "./apiError";

export type Supplier = {
  id?: string;
  name: string;
  rating: number;
  lead_time: string;
  address: string;
  products_supplied: string[];
  created_at?: string;
  updated_at?: string;
};

export type SupplierInput = {
  name: string;
  rating: number;
  lead_time: string;
  address: string;
  products_supplied: string[];
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
});

export async function getSuppliers() {
  const response = await api.get<Supplier[] | { data?: Supplier[] }>("/suppliers/");
  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  return data.data ?? [];
}

export async function createSupplier(payload: SupplierInput) {
  const response = await api.post<{ message: string; data: Supplier[] }>("/suppliers/", payload);
  return response.data;
}

export async function updateSupplier(supplierId: string, payload: SupplierInput) {
  const response = await api.put<{ message: string; data: Supplier[] }>(`/suppliers/${supplierId}`, payload);
  return response.data;
}

export async function deleteSupplier(supplierId: string) {
  const response = await api.delete<{ message: string; data: Supplier[] }>(`/suppliers/${supplierId}`);
  return response.data;
}

export { getApiErrorMessage };
