export type ProductStatus = "draft" | "active" | "archived";
export type VariantInput = {
  id?: string;
  title: string;
  sku: string;
  size: string;
  color: string;
  material: string;
  image: string;
  priceOverride: number | null;
  openingStock: number;
  lowStockThreshold: number;
};
export type InventoryInput = {
  name: string;
  sku: string;
  category: string;
  description: string;
  price: number;
  comparePrice: number | null;
  cost: number | null;
  images: string[];
  status: ProductStatus;
  variants: VariantInput[];
  aiFacts: {
    sellingPoints: string;
    audience: string;
    care: string;
    policyExceptions: string;
  };
  seo: { title: string; description: string };
  delivery: { weightGrams: number | null; note: string };
};
export type InventoryVariant = Omit<VariantInput, "openingStock"> & {
  id: string;
  price: number;
  onHand: number;
  reserved: number;
  available: number;
  sold: number;
  returned: number;
  version: number;
};
export type InventoryProduct = Omit<InventoryInput, "variants"> & {
  id: string;
  shopId: string;
  slug: string;
  currency: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  variants: InventoryVariant[];
  available: number;
  reserved: number;
  lowStock: boolean;
  outOfStock: boolean;
};
export type InventoryList = {
  currency: string;
  products: InventoryProduct[];
  total: number;
  page: number;
  summary: {
    products: number;
    available: number;
    reserved: number;
    low: number;
    out: number;
  };
  categories: string[];
};
export type StockKind =
  "correction" | "receive" | "reserve" | "release" | "sale" | "return";
export type StockAdjustment = {
  requestId: string;
  variantId: string;
  version: number;
  quantity: number;
  reason: string;
  kind: StockKind;
};
export type StockEntry = {
  id: string;
  variantId: string;
  previousValue: number;
  newValue: number;
  difference: number;
  reason: string;
  kind?: string;
  createdBy: string;
  source?: string;
  createdAt: string;
  before?: { onHand: number; reserved: number; sold: number; returned: number };
  after?: { onHand: number; reserved: number; sold: number; returned: number };
};
