import { randomUUID } from "node:crypto";
import { connectDb } from "../../shared/db.js";
import { collections } from "../../shared/models.js";
import { inventoryService } from "../inventory/inventory.service.js";
import { aiReplyService } from "../ai-replies/ai-replies.service.js";
import { activeVisualCandidates, searchProductImages } from "../ai-replies/product-visual-index.service.js";
import { matchProductImageWithGemini } from "../ai-replies/gemini-vision.service.js";

export async function ownedShop(userId: string) {
  const db = await connectDb();
  const shop = await collections(db).shops.findOne({ ownerId: userId, status: "launched" });
  if (!shop) throw new Error("Launch a shop before using AI Vision Lab.");
  return shop;
}

export async function labStatus(userId: string) {
  const shop = await ownedShop(userId);
  const db = await connectDb();
  const products = await db.collection("products").find({ shopId: shop._id, status: "active" }).project({ _id: 1, name: 1, images: 1 }).toArray();
  const embedded = await db.collection("productImageEmbeddings").countDocuments({ shopId: shop._id, embedding: { $exists: true } });
  return { shop: { id: shop._id, name: shop.displayName, currency: shop.currency }, products, embeddedCount: embedded };
}

export async function addLabProduct(userId: string, input: { name: string; description: string; price: number; stock: number; image: string }) {
  const shop = await ownedShop(userId);
  return inventoryService.save(shop._id, {
    name: input.name,
    sku: "",
    category: "",
    description: input.description,
    price: input.price,
    comparePrice: null,
    cost: null,
    images: [input.image],
    status: "active",
    variants: [{ title: "Standard", sku: "", size: "", color: "", material: "", image: "", priceOverride: null, openingStock: input.stock, lowStockThreshold: 5 }],
    aiFacts: { sellingPoints: "", audience: "", care: "", policyExceptions: "" },
    seo: { title: "", description: "" },
    delivery: { weightGrams: null, note: "" },
  }, undefined, 0, randomUUID());
}

export async function runLabChat(userId: string, input: { text?: string; image?: string }) {
  const shop = await ownedShop(userId);
  const image = input.image?.trim();
  let match: { productId: string; confidence: number; source: string; reason?: string } | null = null;
  if (image) {
    const vector = await searchProductImages(shop._id, image);
    if (vector?.strong) {
      match = { productId: vector.productId, confidence: vector.confidence, source: "gemini_vector" };
    } else {
      const candidates = await activeVisualCandidates(shop._id);
      const judged = await matchProductImageWithGemini(image, candidates);
      if (judged.productId && judged.confidence >= 0.7)
        match = { productId: judged.productId, confidence: judged.confidence, source: "gemini_vision", reason: judged.reason };
    }
  }
  const product = match ? await inventoryService.get(shop._id, match.productId) : null;
  const context = product ? [{
    id: product.id,
    name: product.name,
    price: product.price,
    currency: product.currency,
    inStock: product.available > 0,
    availableQuantity: product.available,
    variants: product.variants.map((v) => ({ id: v.id, name: v.title, price: v.price, availableQuantity: v.available, inStock: v.available > 0 })),
  }] : [];
  const reply = await aiReplyService.provider.generateReply({
    shopId: shop._id,
    customer: { id: "ai-vision-lab", name: "AI Vision Lab", language: "en", tags: [], staffNotes: [] },
    latestCustomerMessage: input.text?.trim() || "What product is this in the picture?",
    conversationHistory: [],
    relevantProducts: context,
    channel: "storefront",
  });
  return {
    reply: reply.replyText,
    provider: reply.provider ?? "fallback",
    matchedProduct: product ? { id: product.id, name: product.name, price: product.price, currency: product.currency, stock: product.available } : null,
    visualInspection: { hasImage: Boolean(image), matched: Boolean(match), confidence: match?.confidence ?? 0, source: match?.source ?? "none", reason: match?.reason ?? "No confident catalog match." },
  };
}
