import type { Db } from "mongodb";
import { connectDb } from "../../shared/db.js";
import { amount, collections } from "../../shared/models.js";
import { config } from "../../shared/config.js";
import { fetchWithRetry } from "../../shared/fetch-retry.js";
import { downloadImageBuffer, type VisualProductCandidate } from "./gemini-vision.service.js";

const EMBEDDING_DIMENSIONS = 768;

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
  embedding?: number[];
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
  const rows = [];
  for (const imageUrl of urls) {
    const embedding = await embedProductImage(imageUrl);
    rows.push({
      _id: `${productId}:${Buffer.from(imageUrl).toString("base64url").slice(0, 80)}`,
      shopId,
      productId,
      imageUrl,
      name: product.name,
      category: product.category,
      description: product.description,
      status: product.status,
      updatedAt: now,
      ...(embedding ? { embedding, dimensions: embedding.length } : {}),
    });
  }
  await col(db).insertMany(rows, { ordered: false }).catch(() => undefined);
}

export async function searchProductImages(shopId: string, imageUrl: string) {
  if (!config.geminiApiKey) return null;
  const query = await embedImageFromUrl(imageUrl);
  if (!query) return null;
  const db = await dbOrConnect();
  const rows = await col(db).find({
    shopId,
    status: "active",
    embedding: { $exists: true },
  }).toArray();
  const scored = rows
    .map((row) => ({
      productId: row.productId,
      imageUrl: row.imageUrl,
      name: row.name,
      similarity: cosineSimilarity(query, row.embedding ?? []),
    }))
    .sort((a, b) => b.similarity - a.similarity);
  const best = scored[0];
  if (!best) return null;
  const second = scored.find((row) => row.productId !== best.productId);
  const gap = best.similarity - (second?.similarity ?? 0);
  return {
    productId: best.productId,
    confidence: best.similarity,
    gap,
    strong: best.similarity >= config.aiVisualConfidenceThreshold && gap >= 0.06,
    candidates: scored.slice(0, 8),
  };
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

let cachedDb: Db | null = null;
async function dbOrConnect() {
  cachedDb ??= await connectDb();
  return cachedDb;
}

async function embedProductImage(imageUrl: string) {
  if (!config.geminiApiKey) return null;
  try {
    return await embedImageFromUrl(imageUrl);
  } catch (error) {
    console.warn("Product image embedding failed:", error);
    return null;
  }
}

async function embedImageFromUrl(imageUrl: string) {
  const { buffer, mimeType } = await downloadImageBuffer(imageUrl);
  const response = await fetchWithRetry(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": config.geminiApiKey },
      body: JSON.stringify({
        content: { parts: [{ inline_data: { mime_type: mimeType, data: buffer.toString("base64") } }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    },
    { maxRetries: 2, timeoutMs: 20000, actionName: "geminiImageEmbedding" },
  );
  const body = (await response.json()) as {
    embedding?: { values?: number[] };
    embeddings?: Array<{ values?: number[] }>;
  };
  const values = body.embedding?.values ?? body.embeddings?.[0]?.values;
  if (!response.ok || !values?.length) throw new Error("Gemini image embedding failed.");
  return normalizeEmbedding(values);
}

function normalizeEmbedding(values: number[]) {
  if (values.length > EMBEDDING_DIMENSIONS) return values.slice(0, EMBEDDING_DIMENSIONS);
  return values.length === EMBEDDING_DIMENSIONS
    ? values
    : [...values, ...new Array(EMBEDDING_DIMENSIONS - values.length).fill(0)];
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aNorm += a[i] ** 2;
    bNorm += b[i] ** 2;
  }
  return dot / ((Math.sqrt(aNorm) * Math.sqrt(bNorm)) || 1);
}
