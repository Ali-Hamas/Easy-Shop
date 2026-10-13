import { randomUUID } from "node:crypto";
import { connectDb } from "../../shared/db.js";
import { amount, collections, type ShopDocument } from "../../shared/models.js";
import { config } from "../../shared/config.js";
import { inventoryService } from "../inventory/inventory.service.js";
import { activeVisualCandidates, matchedProductContext, searchProductImages } from "../ai-replies/product-visual-index.service.js";
import { matchProductImageWithGemini } from "../ai-replies/gemini-vision.service.js";
import { aiReplyService } from "../ai-replies/ai-replies.service.js";

const DEMO_ITEMS = [
  ["Black Cotton Casual Shirt with White Dots", 1250, 15, ["M", "L", "XL"], "Premium breathable 100% combed cotton casual shirt featuring subtle micro-dot patterning.", "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80"],
  ["Solid Crimson Red Silk Party Dress", 2450, 8, ["S", "M", "L"], "Graceful full-length A-line party dress crafted with lightweight faux georgette silk.", "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&auto=format&fit=crop&q=80"],
  ["Classic Minimalist White Leather Sneakers", 1850, 22, ["40", "41", "42", "43"], "Unisex low-top everyday casual sneakers made with durable synthetic leather upper.", "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=80"],
  ["Vintage Genuine Leather Bi-Fold Wallet", 850, 50, ["Tan Brown", "Classic Black"], "Handcrafted top-grain cowhide leather wallet with RFID blocking.", "https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80"],
  ["Smart Fitness Tracker Watch with AMOLED Display", 3200, 12, ["Midnight Black", "Steel Silver"], "AMOLED display, calling, heart rate and SpO2 monitoring with 7-day battery life.", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80"],
  ["Katan Silk Traditional Maroon Saree", 4500, 8, ["Standard"], "Rich Banarasi Katan silk saree in royal maroon with golden zari work.", "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80"],
  ["Rugged Blue Denim Jacket", 2150, 20, ["M", "L", "XL"], "Heavyweight washed denim trucker jacket with brass buttons and chest pockets.", "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&auto=format&fit=crop&q=80"],
  ["Active Noise Cancelling Wireless Earbuds", 2200, 35, ["Matte Black", "Pearl White"], "32dB hybrid noise cancellation, bass drivers and IPX5 water resistance.", "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80"],
  ["Canvas Structured Laptop Tote Bag", 1650, 18, ["Beige", "Olive Green"], "Water-resistant canvas tote with padded compartment for 15.6-inch laptops.", "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80"],
  ["Polarized Retro Aviator Sunglasses", 950, 40, ["Gold / Dark Green", "Gunmetal / Grey"], "UV400 protection polarized lenses with a thin stainless steel frame.", "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&auto=format&fit=crop&q=80"],
] as const;

type LabItem = { name: string; price: number; stock: number; sizes: string[]; description: string; imageUrl: string; is_embedded: boolean; image_url: string; id: string; slug: string; currency: string };

function demoContext(name: string | undefined, id: string, similarity: number) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const item = DEMO_ITEMS.find(([title]) => normalize(title) === normalize(name ?? ""));
  if (!item) return null;
  const [title, price, stock, sizes] = item;
  return { id, name: title, price, currency: "BDT", inStock: stock > 0, availableQuantity: stock, variants: sizes.map((size, index) => ({ id: `demo-${index}`, name: size, price, availableQuantity: stock, inStock: stock > 0 })), similarity };
}

async function labShop(userId: string): Promise<ShopDocument> {
  const db = await connectDb();
  const links = db.collection<{ _id: string; shopId: string }>("testLabShops");
  const link = await links.findOne({ _id: userId });
  if (link) {
    const existing = await collections(db).shops.findOne({ _id: link.shopId, ownerId: userId });
    if (existing) return existing;
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  const shop: ShopDocument = {
    _id: id, ownerId: userId, displayName: "AI Vision Lab", legalName: "AI Vision Lab",
    subdomain: `ai-vision-${userId.slice(0, 8)}`, category: "lifestyle", country: "Bangladesh", currency: "BDT",
    language: "en", status: "launched", onboardingStep: "products", policyDefaults: { deliveryCharge: 80, returnDays: 7, codAllowed: true },
    aiMode: "suggest", createdAt: now, updatedAt: now, storefrontConfig: {}, revision: 1,
  };
  await collections(db).shops.insertOne(shop);
  await links.updateOne({ _id: userId }, { $set: { shopId: id } }, { upsert: true });
  return shop;
}

function toInput(item: { name: string; price: number; stock: number; sizes?: string[]; description?: string; imageUrl: string }) {
  return {
    name: item.name, sku: "", category: "AI Vision Lab", description: item.description ?? "", price: item.price,
    comparePrice: null, cost: null, images: [item.imageUrl], status: "active" as const,
    variants: (item.sizes?.length ? item.sizes : ["Standard"]).map((title) => ({ title, sku: "", size: title, color: "", material: "", image: "", priceOverride: null, openingStock: item.stock, lowStockThreshold: 5 })),
    aiFacts: { sellingPoints: "", audience: "", care: "", policyExceptions: "" }, seo: { title: "", description: "" }, delivery: { weightGrams: null, note: "" },
  };
}

export async function addLabProduct(userId: string, item: { name: string; description?: string; price: number; stock: number; imageUrl: string; sizes?: string[] }) {
  const shop = await labShop(userId);
  return inventoryService.save(shop._id, toInput(item), undefined, 0, randomUUID());
}

export async function listLabProducts(userId: string): Promise<LabItem[]> {
  const shop = await labShop(userId); const db = await connectDb();
  const products = await collections(db).products.find({ shopId: shop._id, status: "active" }).sort({ createdAt: 1 }).toArray();
  const embeddings = db.collection<{ productId: string }>("productImageEmbeddings");
  return Promise.all(products.map(async (p) => ({
    id: p._id, name: p.name, slug: p.slug, description: p.description ?? "", price: amount(p.price), base_price: amount(p.price), currency: p.currency,
    stock: p.stock ?? 0, sizes: [], imageUrl: p.images?.[0] ?? p.imageUrl ?? "", image_url: p.images?.[0] ?? p.imageUrl ?? "",
    is_embedded: Boolean(await embeddings.findOne({ shopId: shop._id, productId: p._id, embedding: { $exists: true } })),
  })));
}

export async function seed10DemoProducts(userId: string, custom?: Array<{ name: string; description?: string; price: number; stock: number; imageUrl: string; sizes?: string[] }>) {
  const shop = await labShop(userId); const db = await connectDb();
  await Promise.all([
    collections(db).products.deleteMany({ shopId: shop._id }), collections(db).variants.deleteMany({ shopId: shop._id }),
    collections(db).ledger.deleteMany({ shopId: shop._id }), db.collection("inventoryBalances").deleteMany({ shopId: shop._id }),
    db.collection("productImageEmbeddings").deleteMany({ shopId: shop._id }), db.collection("productImages").deleteMany({ shopId: shop._id }),
  ]);
  const items = custom ?? DEMO_ITEMS.map(([name, price, stock, sizes, description, imageUrl]) => ({ name, price, stock, sizes: [...sizes], description, imageUrl }));
  const products = [];
  for (const item of items) products.push(await addLabProduct(userId, item));
  return { success: true, seeded: products.length, products };
}

export async function verifyLabKeys() {
  return {
    gemini: { valid: Boolean(config.geminiApiKey), message: config.geminiApiKey ? "Server Gemini key configured." : "Gemini key is not configured." },
    groq: { valid: Boolean(config.groqApiKey), message: config.groqApiKey ? "Server Groq key configured." : "Groq key is not configured." },
  };
}

export async function chatSimulate(userId: string, input: { text?: string | null; imageUrl?: string | null; imageBase64?: string | null; mimeType?: string | null; history?: Array<{ source: "buyer" | "ai" | "staff" | "user" | "assistant"; body: string }> | null }) {
  const shop = await labShop(userId); const image = input.imageBase64 ? `data:${input.mimeType || "image/jpeg"};base64,${input.imageBase64.replace(/^data:[^,]+,/, "")}` : input.imageUrl || undefined;
  const started = Date.now(); let match: { productId: string; confidence: number; source: string; reason: string } | null = null; let candidates: unknown[] = [];
  let catalogProduct: ReturnType<typeof demoContext> = null;
  if (image) {
    const vector = await searchProductImages(shop._id, image);
    candidates = vector?.candidates ?? [];
    if (vector?.strong) {
      match = { productId: vector.productId, confidence: vector.confidence, source: "gemini_vector", reason: `Vector search found a strong match (${vector.confidence.toFixed(3)}).` };
      catalogProduct = demoContext((vector.candidates[0] as { name?: string } | undefined)?.name, vector.productId, vector.confidence);
    }
    else {
      const judged = await matchProductImageWithGemini(image, await activeVisualCandidates(shop._id));
      if (judged.productId && judged.confidence >= config.aiVisualConfidenceThreshold) match = { productId: judged.productId, confidence: judged.confidence, source: "gemini_vision", reason: judged.reason };
    }
  }
  let detail = match ? await inventoryService.get(shop._id, match.productId).catch(() => null) : null;
  if (!detail && match) {
    const top = (candidates[0] ?? {}) as { name?: string };
    if (top.name) {
      const db = await connectDb();
      const current = await collections(db).products.findOne({ shopId: shop._id, name: top.name, status: "active" });
      if (current) detail = await inventoryService.get(shop._id, current._id).catch(() => null);
    }
  }
  let product = catalogProduct ?? (detail ? {
    id: detail.id,
    name: detail.name,
    price: detail.price,
    currency: detail.currency,
    inStock: detail.available > 0,
    availableQuantity: detail.available,
    variants: detail.variants.map((variant) => ({ id: variant.id, name: variant.title, price: variant.price, availableQuantity: variant.available, inStock: variant.available > 0 })),
  } : match ? await matchedProductContext(shop._id, match.productId) : null);
  if (!product && match) {
    const top = (candidates[0] ?? {}) as { name?: string };
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const demo = DEMO_ITEMS.find(([name]) => normalize(name) === normalize(top.name ?? ""));
    if (demo) {
      const [name, price, stock, sizes] = demo;
      product = { id: match.productId, name, price, currency: "BDT", inStock: stock > 0, availableQuantity: stock, variants: sizes.map((size, index) => ({ id: `demo-${index}`, name: size, price, availableQuantity: stock, inStock: stock > 0 })) };
    }
  }
  const reply = await aiReplyService.provider.generateReply({ shopId: shop._id, customer: { id: "ai-vision-lab", name: "AI Vision Lab", language: "en", tags: [], staffNotes: [] }, latestCustomerMessage: input.text || "What product is this in the picture?", conversationHistory: (input.history ?? []).map((item) => ({ sender: item.source === "buyer" || item.source === "user" ? "customer" as const : "staff" as const, text: item.body, createdAt: new Date().toISOString() })), relevantProducts: product ? [product] : [], channel: "storefront" });
  const matched = product ? { ...product, stock: product.availableQuantity, similarity: match?.confidence ?? 0, source: match?.source ?? "none" } : null;
  const groundedFallback = matched ? `This is ${matched.name}. It is listed at ${matched.currency} ${matched.price} and currently has ${matched.stock} unit${matched.stock === 1 ? "" : "s"} available.` : "Sorry, I could not find the exact item in the catalog.";
  const modelReply = reply.replyText?.trim() || "";
  const trustedReply = matched && !modelReply.toLowerCase().includes(matched.name.toLowerCase()) && !modelReply.includes(String(matched.price)) ? groundedFallback : (modelReply || groundedFallback);
  return { reply: trustedReply, provider: reply.provider ?? "fallback", matchedProduct: matched, visualInspection: { hasImage: Boolean(image), imageHashReceived: false, imageHashCount: 0, catalogHashCount: 0, similarityScore: match?.confidence ?? 0, vectorSearchMatched: match?.source === "gemini_vector", reason: match?.reason ?? "No confident catalog match.", topCandidates: candidates, vectorLatencyMs: Date.now() - started, groqLatencyMs: 0 } };
}
