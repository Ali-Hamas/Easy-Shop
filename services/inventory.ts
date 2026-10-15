import { apiRequest } from "@/lib/api/client";
import type {
  InventoryInput,
  InventoryProduct,
  InventoryList,
  StockAdjustment,
  StockEntry,
} from "@/types/inventory";
const base = (shopId: string) =>
  `inventory/${encodeURIComponent(shopId)}/products`;
export const inventoryService = {
  list: (
    shopId: string,
    query: Record<string, string | number>,
    signal?: AbortSignal,
  ) =>
    apiRequest<InventoryList>(
      `${base(shopId)}?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`,
      { signal },
    ),
  get: (shopId: string, id: string) =>
    apiRequest<InventoryProduct>(`${base(shopId)}/${id}`),
  create: (shopId: string, product: InventoryInput, requestId: string) =>
    apiRequest<InventoryProduct>(base(shopId), {
      method: "POST",
      body: { product, requestId },
    }),
  update: (
    shopId: string,
    id: string,
    product: InventoryInput,
    version: number,
  ) =>
    apiRequest<InventoryProduct>(`${base(shopId)}/${id}`, {
      method: "PATCH",
      body: { product, version },
    }),
  adjust: (shopId: string, id: string, input: StockAdjustment) =>
    apiRequest<InventoryProduct>(`${base(shopId)}/${id}/adjustments`, {
      method: "POST",
      body: input,
    }),
  history: (shopId: string, id: string, page = 1) =>
    apiRequest<{ entries: StockEntry[]; total: number; page: number }>(
      `${base(shopId)}/${id}/history?page=${page}`,
    ),
};
