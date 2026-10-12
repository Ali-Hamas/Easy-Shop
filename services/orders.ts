import { apiRequest } from "@/lib/api/client";
import type { OrderSummary } from "@/types/orders";

export const orderService = {
  list: (shopId: string, signal?: AbortSignal) =>
    apiRequest<{ orders: OrderSummary[] }>(
      `orders/${encodeURIComponent(shopId)}`,
      { signal },
    ),
};
