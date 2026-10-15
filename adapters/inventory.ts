import type {
  InventoryInput,
  InventoryProduct,
  VariantInput,
  StockKind,
} from "@/types/inventory";
export const blankVariant = (): VariantInput => ({
  title: "Default",
  sku: "",
  size: "",
  color: "",
  material: "",
  image: "",
  priceOverride: null,
  openingStock: 0,
  lowStockThreshold: 5,
});
export const blankProduct = (): InventoryInput => ({
  name: "",
  sku: "",
  category: "",
  description: "",
  price: 0,
  comparePrice: null,
  cost: null,
  images: [],
  status: "active",
  variants: [blankVariant()],
  aiFacts: { sellingPoints: "", audience: "", care: "", policyExceptions: "" },
  seo: { title: "", description: "" },
  delivery: { weightGrams: null, note: "" },
});
export function editProduct(p: InventoryProduct): InventoryInput {
  return {
    name: p.name,
    sku: p.sku,
    category: p.category,
    description: p.description,
    price: p.price,
    comparePrice: p.comparePrice,
    cost: p.cost,
    images: p.images,
    status: p.status,
    aiFacts: p.aiFacts,
    seo: p.seo,
    delivery: p.delivery,
    variants: p.variants.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      size: v.size,
      color: v.color,
      material: v.material,
      image: v.image,
      priceOverride: v.priceOverride,
      openingStock: 0,
      lowStockThreshold: v.lowStockThreshold,
    })),
  };
}
export function stockPreview(
  v: { onHand: number; reserved: number; sold: number; returned: number },
  kind: StockKind,
  quantity: number,
) {
  const next = { ...v };
  switch (kind) {
    case "correction":
    case "receive":
      next.onHand += quantity;
      break;
    case "reserve":
      next.reserved += quantity;
      break;
    case "release":
      next.reserved -= quantity;
      break;
    case "sale":
      next.onHand -= quantity;
      next.reserved -= quantity;
      next.sold += quantity;
      break;
    case "return":
      next.onHand += quantity;
      next.returned += quantity;
      break;
  }
  return {
    ...next,
    available: next.onHand - next.reserved,
    valid:
      Number.isInteger(quantity) &&
      quantity !== 0 &&
      (kind === "correction" || quantity > 0) &&
      next.onHand >= 0 &&
      next.onHand <= 100000000 &&
      next.reserved >= 0 &&
      next.reserved <= next.onHand &&
      next.returned <= next.sold,
  };
}
