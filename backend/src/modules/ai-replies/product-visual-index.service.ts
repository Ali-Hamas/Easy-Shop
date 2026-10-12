import type { Db } from "mongodb";
import { connectDb } from "../../shared/db.js";
import { amount, collections } from "../../shared/models.js";
import type { VisualProductCandidate } from "./gemini-vision.service.js";

type ProductImageIndex = {
  _id: string;
  shopId: string;
  productId: string;
  imageUrl: string;
  name: string;
  category?: string;
  description?: string;
  status: string;
  updatedAt: string;
};

const col = (db: Db) => db.collection<ProductImageIndex>("productImageEmbeddings");

export async function indexProductImages(shopId: string, productId: string) {
  const db = await connectDb();
  const c = collections(db);
  const product = await c.products.findOne({ _id: productId, shopId });
  if (!product) return;
  const urls = Array.from(new Set((product.images ?? []).filter(Boolean))).slice(0, 10);
  await col(db).deleteMany({ shopId, productId });
  if (!urls.length) return;
  const now = new Date().toISOString();
  await col(db).insertMany(
    urls.map((imageUrl) => ({
      _id: `${productId}:${Buffer.from(imageUrl).toString("base64url").slice(0, 80)}`,
      shopId,
      productId,
      imageUrl,
      name: product.name,
      category: product.category,
      description: product.description,
      status: product.status,
      updatedAt: now,
    })),
    { ordered: false },
  ).catch(() => undefined);
}

export async function activeVisualCandidates(shopId: string): Promise<VisualProductCandidate[]> {
  const db = await connectDb();
  const c = collections(db);
  const indexed = await col(db).find({ shopId, status: "active" }).limit(300).toArray();
  const grouped = new Map<string, ProductImageIndex[]>();
  for (const item of indexed) grouped.set(item.productId, [...(grouped.get(item.productId) ?? []), item]);
  if (!grouped.size) {
    const products = await c.products
      .find({ shopId, status: "active" }, { projection: { _id: 1, images: 1, name: 1, category: 1, description: 1 } })
      .limit(60)
      .toArray();
    return products
      .filter((p) => p.images?.length)
      .map((p) => ({
        id: p._id,
        name: p.name,
        category: p.category,
        description: p.description,
        imageUrls: (p.images ?? []).slice(0, 5),
      }));
  }
  return [...grouped.entries()].map(([id, rows]) => ({
    id,
    name: rows[0].name,
    category: rows[0].category,
    description: rows[0].description,
    imageUrls: rows.map((r) => r.imageUrl).slice(0, 5),
  }));
}

export async function matchedProductContext(shopId: string, productId: string) {
  const db = await connectDb();
  const product = await collections(db).products.findOne({ _id: productId, shopId, status: "active" });
  if (!product) return null;
  return {
    id: product._id,
    name: product.name,
    price: amount(product.price),
    currency: product.currency,
    inStock: Number(product.stock ?? 0) > 0,
    availableQuantity: Number(product.stock ?? 0),
    variants: [],
  };
}
