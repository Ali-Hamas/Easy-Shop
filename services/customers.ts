import { apiRequest } from "@/lib/api/client";
import type {
  Customer,
  CustomerInput,
  CustomerList,
  CustomerHistory,
} from "@/types/customers";
const base = (shop: string) => `customers/${encodeURIComponent(shop)}`;
export const customerService = {
  list: (
    shop: string,
    query: Record<string, string | number>,
    signal?: AbortSignal,
  ) =>
    apiRequest<CustomerList>(
      `${base(shop)}?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`,
      { signal },
    ),
  get: (shop: string, id: string, signal?: AbortSignal) =>
    apiRequest<Customer>(`${base(shop)}/${id}`, { signal }),
  create: (shop: string, customer: CustomerInput, requestId: string) =>
    apiRequest<Customer>(base(shop), {
      method: "POST",
      body: { customer, requestId },
    }),
  update: (
    shop: string,
    id: string,
    customer: CustomerInput,
    version: number,
  ) =>
    apiRequest<Customer>(`${base(shop)}/${id}`, {
      method: "PATCH",
      body: { customer, version },
    }),
  history: (shop: string, id: string, page = 1, signal?: AbortSignal) =>
    apiRequest<CustomerHistory>(`${base(shop)}/${id}/history?page=${page}`, {
      signal,
    }),
  note: (shop: string, id: string, text: string, requestId: string) =>
    apiRequest<{ id: string }>(`${base(shop)}/${id}/notes`, {
      method: "POST",
      body: { text, requestId },
    }),
};
