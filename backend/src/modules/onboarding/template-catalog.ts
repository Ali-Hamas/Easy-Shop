import type { StoreTemplate } from "./onboarding.types.js";
export const templateCatalog: StoreTemplate[] = [
  {
    id: "fashion-lifestyle",
    name: "Atelier",
    bestFor: ["fashion", "lifestyle"],
    notes:
      "An editorial fashion storefront with generous photography and considered typography.",
  },
  {
    id: "beauty-cosmetics",
    name: "Bloom",
    bestFor: ["beauty", "cosmetics"],
    notes:
      "A soft product-first beauty storefront with elegant rounded compositions.",
  },
  {
    id: "electronics-gadgets",
    name: "Circuit",
    bestFor: ["electronics", "gadgets"],
    notes:
      "A structured technical catalog with clear product comparison and purchase controls.",
  },
  {
    id: "food-restaurant",
    name: "Gather",
    bestFor: ["food", "restaurant"],
    notes: "A welcoming food storefront with menu-like product presentation.",
  },
  {
    id: "modern-general",
    name: "Forma",
    bestFor: ["general", "home", "accessories"],
    notes: "A versatile modern shop for mixed catalogs.",
  },
].map((theme) => ({
  ...theme,
  type: "storefront",
  sourceUrl: "internal:easy-shop-themes",
  license: "Easy Shop first-party theme",
  stack: ["Next.js", "React", "TypeScript"],
  status: "available",
}));
export function resolveTemplateId(id: string | null | undefined) {
  return id === "test-fashion-basic"
    ? "fashion-lifestyle"
    : id === "test-gadget-basic"
      ? "electronics-gadgets"
      : templateCatalog.some((t) => t.id === id)
        ? id!
        : "modern-general";
}
