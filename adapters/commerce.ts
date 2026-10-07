import type { PublicProduct } from "@/types/commerce";
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
  return slug
    ? `/store/${encodeURIComponent(subdomain)}/products/${encodeURIComponent(slug)}?productId=${encodeURIComponent(product.id)}`
    : null;
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
