import { apiRequest } from "@/lib/api/client";

const base = (shopId: string) => `ads/${encodeURIComponent(shopId)}`;
export type AdsOverview = {
  connection: {
    connected: boolean;
    status: string;
    adAccounts: { id: string; name: string; currency?: string }[];
    pixels: { id: string; name: string }[];
    catalogs: { id: string; name: string }[];
    selection: { adAccountId: string | null; pixelId: string | null; catalogId: string | null };
    lastSyncAt: string | null;
    lastError: string | null;
  };
  insights: Array<{ id: string; dateStart: string; dateStop: string; rows: unknown[]; syncedAt: string }>;
  drafts: unknown[];
  tracking: { failedEvents: number };
};
export const adsService = {
  overview: (shopId: string, signal?: AbortSignal) => apiRequest<AdsOverview>(base(shopId), { signal }),
  connect: (shopId: string) => apiRequest<{ authUrl: string }>(`${base(shopId)}/connect`, { method: "POST" }),
  select: (shopId: string, body: { adAccountId: string; pixelId?: string; catalogId?: string }) => apiRequest<AdsOverview>(`${base(shopId)}/selection`, { method: "PATCH", body }),
  sync: (shopId: string, since: string, until: string) => apiRequest(`${base(shopId)}/insights/sync`, { method: "POST", body: { since, until } }),
};
