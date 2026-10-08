import type { PublicProduct } from "@/types/commerce";
const storefrontRoot =
  process.env.NEXT_PUBLIC_STOREFRONT_ROOT_DOMAIN ?? "easyshop.britsyncai.com";

export function storefrontUrl(subdomain: string, path = "") {
  const encoded = encodeURIComponent(subdomain);
  if (typeof window === "undefined") return `/store/${encoded}${path}`;
  return `${window.location.protocol}//${encoded}.${storefrontRoot}${path}`;
}

/** Prefer canonical slugs; normalization remains a compatibility fallback for older servers. */
export function productPath(
  subdomain: string,
  product: PublicProduct,
): string | null {
  const slug =
    product.slug ??
    product.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
  if (!slug) return null;
  const productUrl = `/products/${encodeURIComponent(slug)}?productId=${encodeURIComponent(product.id)}`;
  if (
    typeof window !== "undefined" &&
    window.location.hostname.toLowerCase().startsWith(`${subdomain}.`)
  ) {
    return productUrl;
  }
  return storefrontUrl(subdomain, productUrl);
}
export function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
export const draftKey = "easy-shop:onboarding-id";
export function rememberedShop() {
  try {
    return sessionStorage.getItem(draftKey);
  } catch {
    return null;
  }
}
export function rememberedShopName() {
  try {
    return sessionStorage.getItem(`${draftKey}:name`);
  } catch {
    return null;
  }
}
export function subscribeShop(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener("easy-shop:changed", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("easy-shop:changed", notify);
  };
}
export function rememberShop(id: string, name?: string) {
  try {
    sessionStorage.setItem(draftKey, id);
    if (name) sessionStorage.setItem(`${draftKey}:name`, name);
    window.dispatchEvent(new Event("easy-shop:changed"));
  } catch {
    /* URL remains a usable resume path when browser storage is unavailable. */
  }
}
