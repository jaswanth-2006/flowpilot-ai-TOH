import axios from "axios";
import { getApiErrorMessage } from "./apiError";

export type Customer = {
  id?: string;
  company_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type CustomerInput = {
  company_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
});

export async function getCustomers() {
  const response = await api.get<Customer[] | { data?: Customer[] }>("/customers/");
  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  return data.data ?? [];
}

export async function createCustomer(payload: CustomerInput) {
  const response = await api.post<{ message: string; data: Customer[] }>("/customers/", payload);
  return response.data;
}

export async function updateCustomer(customerId: string, payload: CustomerInput) {
  const response = await api.put<{ message: string; data: Customer[] }>(`/customers/${customerId}`, payload);
  return response.data;
}

export async function deleteCustomer(customerId: string) {
  const response = await api.delete<{ message: string; data: Customer[] }>(`/customers/${customerId}`);
  return response.data;
}

export { getApiErrorMessage };
