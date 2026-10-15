"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { GuestCartItem } from "./guest-checkout";
import type { PublicProduct } from "@/types/commerce";
const event = "easy-shop-cart-changed";
const memory = new Map<string, string>();
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(event, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(event, callback);
  };
}
function read(key: string) {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return localStorage.getItem(key) || "[]";
  } catch {
    return memory.get(key) || "[]";
  }
}
function parse(raw: string): GuestCartItem[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v)
      ? v
          .filter(
            (i) =>
              i !== null &&
              typeof i === "object" &&
              typeof i.productId === "string" &&
              typeof i.productName === "string" &&
              typeof i.price === "number" &&
              Number.isFinite(i.price) &&
              i.price >= 0 &&
              Number.isInteger(i.quantity) &&
              i.quantity > 0,
          )
          .map((i) => ({ ...i, quantity: Math.min(99, i.quantity) }))
          .slice(0, 30)
      : [];
  } catch {
    return [];
  }
}
function reconcile(items: GuestCartItem[], products?: PublicProduct[]) {
  if (!products) return items;
  return items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return item;
    const variants = product.variants.filter(
      (variant): variant is Exclude<typeof variant, string> =>
        typeof variant !== "string",
    );
    const variant = item.variantId
      ? variants.find((v) => v.id === item.variantId)
      : variants.length === 1
        ? variants[0]
        : undefined;
    // Keep unavailable selections visible so the buyer can remove them. The
    // backend validates current availability again before creating an order.
    return {
      ...item,
      productName: product.name,
      imageUrl: product.imageUrl,
      slug: product.slug,
      ...(variant
        ? {
            variantId: variant.id,
            variantTitle: variant.title,
            price: variant.price,
          }
        : !item.variantId && !variants.length
          ? { price: product.price }
          : {}),
    };
  });
}
export function useGuestCart(subdomain: string, products?: PublicProduct[]) {
  const key = `easy-shop-bag:${subdomain}`;
  const snapshot = useSyncExternalStore(
    subscribe,
    useCallback(() => read(key), [key]),
    () => "[]",
  );
  const items = useMemo(
    () => reconcile(parse(snapshot), products),
    [snapshot, products],
  );
  const setItems = useCallback(
    (value: GuestCartItem[] | ((v: GuestCartItem[]) => GuestCartItem[])) => {
      const next =
        typeof value === "function"
          ? value(reconcile(parse(read(key)), products))
          : value;
      const serialized = JSON.stringify(parse(JSON.stringify(next)));
      try {
        localStorage.setItem(key, serialized);
        memory.delete(key);
      } catch {
        // Browsers that block storage still support a bag during this visit.
        memory.set(key, serialized);
      }
      window.dispatchEvent(new Event(event));
    },
    [key, products],
  );
  return [items, setItems] as const;
}
