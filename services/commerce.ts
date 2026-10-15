import type {
  AiMode,
  OnboardingState,
  StartInput,
  ShopInput,
  ProductInput,
  StoreTemplate,
  PublicStore,
  ProductDetail,
} from "@/types/commerce";
import { apiRequest } from "@/lib/api/client";
const base = "onboarding";
const shop = (id: string) => `${base}/${encodeURIComponent(id)}`;
export const onboardingService = {
  start: (body: StartInput) =>
    apiRequest<OnboardingState>(`${base}/start`, { method: "POST", body }),
  checkSubdomain: (subdomain: string) =>
    apiRequest<{
      subdomain: string;
      available: boolean;
      suggestions: string[];
    }>(`${base}/subdomain/check`, { method: "POST", body: { subdomain } }),
  templates: () =>
    apiRequest<{ templates: StoreTemplate[] }>(`${base}/templates`),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest<OnboardingState>(shop(id), { signal }),
  updateShop: (id: string, body: ShopInput) =>
    apiRequest<OnboardingState>(`${shop(id)}/shop`, { method: "PATCH", body }),
  addProduct: (id: string, body: ProductInput) =>
    apiRequest<OnboardingState>(`${shop(id)}/products`, {
      method: "POST",
      body,
    }),
  skipMeta: (id: string) =>
    apiRequest<OnboardingState>(`${shop(id)}/channels/meta/skip`, {
      method: "POST",
    }),
  setAiMode: (id: string, aiMode: AiMode) =>
    apiRequest<OnboardingState>(`${shop(id)}/ai-mode`, {
      method: "PATCH",
      body: { aiMode },
    }),
  selectTemplate: (id: string, templateId: string) =>
    apiRequest<OnboardingState>(`${shop(id)}/template`, {
      method: "POST",
      body: { templateId },
    }),
  launch: (id: string) =>
    apiRequest<OnboardingState>(`${shop(id)}/launch`, { method: "POST" }),
};
export const storefrontService = {
  get: (subdomain: string, signal?: AbortSignal, preview?: boolean) => {
    const qs = preview ? "?preview=true" : "";
    return apiRequest<PublicStore>(
      `storefront/${encodeURIComponent(subdomain)}${qs}`,
      { signal },
    );
  },
  product: (
    subdomain: string,
    slug: string,
    signal?: AbortSignal,
    preview?: boolean,
    productId?: string,
  ) => {
    const params = new URLSearchParams();
    if (preview) params.set("preview", "true");
    if (productId) params.set("productId", productId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiRequest<{ product: ProductDetail }>(
      `storefront/${encodeURIComponent(subdomain)}/products/${encodeURIComponent(slug)}${qs}`,
      { signal },
    );
  },
};
