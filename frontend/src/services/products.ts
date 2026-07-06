import axios from "axios";

export type Product = {
  id?: string;
  supplier_id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  inventory: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
};

export type Supplier = {
  id?: string;
  name?: string;
  supplier_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
};

export type ProductInput = {
  supplier_id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  inventory: number;
  description: string;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
});

export async function getProducts() {
  const response = await api.get<Product[] | { data?: Product[] }>("/products/");
  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  return data.data ?? [];
}

export async function createProduct(payload: ProductInput) {
  const response = await api.post<{ message: string; data: Product[] }>("/products/", payload);
  return response.data;
}

export async function updateProduct(productId: string, payload: ProductInput) {
  const response = await api.put<{ message: string; data: Product[] }>(`/products/${productId}`, payload);
  return response.data;
}

export async function deleteProduct(productId: string) {
  const response = await api.delete<{ message: string; data: Product[] }>(`/products/${productId}`);
  return response.data;
}

export async function getSuppliers() {
  const response = await api.get<Supplier[] | { data?: Supplier[] }>("/suppliers/");
  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  return data.data ?? [];
}
