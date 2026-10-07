import { randomUUID } from "node:crypto";
import { MongoServerError, type Db, type ClientSession } from "mongodb";
import { connectDb, transaction } from "../../shared/db.js";
import {
  collections,
  publicDocument,
  money,
  amount,
  type ShopDocument,
} from "../../shared/models.js";
import { templateCatalog } from "./template-catalog.js";
import type {
  AiMode,
  FirstProduct,
  OnboardingState,
  Owner,
  PolicyDefaults,
  Shop,
} from "./onboarding.types.js";
const reservedSubdomains = new Set([
  "admin",
  "api",
  "app",
  "www",
  "mail",
  "support",
  "help",
  "assets",
]);
export class OnboardingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
  }
}
export function normalizeSubdomain(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
export function suggestSubdomains(input: string, taken: Set<string>) {
  const base = normalizeSubdomain(input) || "shop";
  const result: string[] = [];
  for (const suffix of [
    "bd",
    "shop",
    "store",
    "online",
    String(Math.floor(100 + Math.random() * 900)),
  ]) {
    const candidate = `${base.slice(0, 40 - suffix.length - 1)}-${suffix}`;
    if (
      !taken.has(candidate) &&
      !reservedSubdomains.has(candidate) &&
      !result.includes(candidate)
    )
      result.push(candidate);
    if (result.length === 3) break;
  }
  return result;
}
const now = () => new Date().toISOString();
export function launchChecklist(shop: Shop, products: FirstProduct[]) {
  const hasProduct = products.some((p) => p.status === "active"),
    hasTemplate = Boolean(shop.selectedTemplateId),
    blockers: string[] = [];
  if (!shop.displayName) blockers.push("shop display name missing");
  if (!shop.subdomain) blockers.push("subdomain missing");
  if (!hasProduct && !hasTemplate)
    blockers.push("add at least one product or choose a template");
  return { hasProduct, hasTemplate, canLaunch: !blockers.length, blockers };
}
async function audit(
  db: Db,
  session: ClientSession,
  shop: ShopDocument,
  action: string,
  targetType = "shop",
  targetId = shop._id,
  metadata?: Record<string, unknown>,
) {
  await collections(db).audit.insertOne(
    {
      _id: randomUUID(),
      shopId: shop._id,
      actor: "owner",
      actorId: shop.ownerId,
      action,
      targetType,
      targetId,
      metadata,
      createdAt: now(),
    },
    { session },
  );
}
export class OnboardingService {
  async checkSubdomain(input: string) {
    const subdomain = normalizeSubdomain(input);
    if (subdomain.length < 3)
      throw new OnboardingError(
        "Subdomain must be at least 3 valid characters.",
        400,
        "SUBDOMAIN_TOO_SHORT",
      );
    const c = collections(await connectDb());
    const occupied =
      reservedSubdomains.has(subdomain) ||
      Boolean(await c.shops.findOne({ subdomain }, { projection: { _id: 1 } }));
    const candidates = suggestSubdomains(subdomain, new Set());
    const taken = new Set(
      (
        await c.shops
          .find(
            { subdomain: { $in: candidates } },
            { projection: { subdomain: 1 } },
          )
          .toArray()
      ).map((s) => s.subdomain),
    );
    return {
      subdomain,
      available: !occupied,
      suggestions: occupied ? candidates.filter((s) => !taken.has(s)) : [],
    };
  }
  listTemplates() {
    return { templates: templateCatalog };
  }
  async start(input: {
    ownerName: string;
    email?: string;
    phone?: string;
    language: Owner["language"];
    shopName: string;
    subdomain?: string;
    category: string;
    country: string;
    currency: string;
    ownerUserId?: string;
  }) {
    const check = await this.checkSubdomain(input.subdomain ?? input.shopName);
    if (!check.available)
      throw new OnboardingError(
        "Subdomain is not available.",
        409,
        "SUBDOMAIN_TAKEN",
      );
    const shopId = randomUUID();
    try {
      await transaction(async (db, session) => {
        const c = collections(db),
          createdAt = now();
        const ownerId = input.ownerUserId;
        if (!ownerId || !(await c.users.findOne({ _id: ownerId }, { session })))
          throw new OnboardingError("Authenticated owner required.", 401, "AUTH_REQUIRED");
        const shop: ShopDocument = {
          _id: shopId,
          ownerId,
          displayName: input.shopName,
          subdomain: check.subdomain,
          category: input.category,
          country: input.country,
          currency: input.currency.toUpperCase(),
          language: input.language,
          status: "draft",
          onboardingStep: "products",
          policyDefaults: {
            deliveryCharge: 0,
            returnDays: 3,
            codAllowed: true,
          },
          aiMode: "suggest",
          createdAt,
          updatedAt: createdAt,
          revision: 0,
          storefrontConfig: {
            theme: {
              accent: "#111827",
              background: "#ffffff",
              text: "#111827",
            },
            sections: ["hero", "products"],
            seo: {},
          },
        };
        await c.shops.insertOne(shop, { session });
        await c.staff.insertOne(
          {
            _id: randomUUID(),
            shopId,
            userId: ownerId,
            role: "owner",
            status: "active",
            createdAt,
          },
          { session },
        );
        await audit(db, session, shop, "onboarding.started");
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        const subdomain = Boolean(error.keyPattern?.subdomain);
        throw new OnboardingError(
          subdomain
            ? "Subdomain is not available."
            : "Owner identifier already exists.",
          409,
          subdomain ? "SUBDOMAIN_TAKEN" : "OWNER_CONFLICT",
        );
      }
      throw error;
    }
    return this.getState(shopId);
  }
  async getState(shopId: string): Promise<OnboardingState> {
    const c = collections(await connectDb());
    const stored = await c.shops.findOne({ _id: shopId });
    if (!stored)
      throw new OnboardingError("Shop not found.", 404, "SHOP_NOT_FOUND");
    const owner = await c.users.findOne({ _id: stored.ownerId });
    if (!owner)
      throw new OnboardingError("Owner not found.", 404, "OWNER_NOT_FOUND");
    const {
      storefrontConfig: _,
      revision: __,
      ...shop
    } = publicDocument(stored);
    const documents = await c.products
      .find({ shopId })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    const products: FirstProduct[] = [];
    for (const product of documents) {
      const variants = await c.variants
        .find({ shopId, productId: product._id })
        .toArray();
      const entries = await c.ledger
        .find({ shopId, variantId: { $in: variants.map((v) => v._id) } })
        .toArray();
      products.push({
        id: product._id,
        shopId,
        name: product.name,
        price: amount(product.price),
        stock: entries.reduce((sum, e) => sum + e.deltaQuantity, 0),
        status: product.status as FirstProduct["status"],
        createdAt: product.createdAt,
      });
    }
    const channels = (
      await c.channels.find({ shopId }).sort({ createdAt: 1, _id: 1 }).toArray()
    ).map(publicDocument);
    const audits = (
      await c.audit.find({ shopId }).sort({ createdAt: 1, _id: 1 }).toArray()
    ).map((doc) => {
      const { actorId, ...entry } = publicDocument(doc);
      return entry;
    });
    return {
      owner: { id: owner._id, name: owner.name, email: owner.email, phone: owner.phone, language: owner.language, createdAt: owner.createdAt },
      shop,
      products,
      channels,
      audit: audits,
      templates: templateCatalog,
      launchChecklist: launchChecklist(shop, products),
    };
  }
  private async mutate(
    shopId: string,
    draftOnly: boolean,
    run: (db: Db, session: ClientSession, shop: ShopDocument) => Promise<void>,
  ) {
    await transaction(async (db, session) => {
      const c = collections(db);
      const shop = await c.shops.findOne({ _id: shopId }, { session });
      if (!shop)
        throw new OnboardingError("Shop not found.", 404, "SHOP_NOT_FOUND");
      if (draftOnly && shop.status === "launched")
        throw new OnboardingError(
          "Use the relevant module after launch.",
          409,
          "SHOP_LAUNCHED",
        );
      // Every mutation takes the same document write lock; transaction retries re-read launch status.
      await c.shops.updateOne(
        { _id: shopId },
        { $inc: { revision: 1 }, $set: { updatedAt: now() } },
        { session },
      );
      await run(db, session, shop);
    });
    return this.getState(shopId);
  }
  async updateShop(
    shopId: string,
    input: Partial<Omit<Shop, "policyDefaults">> & {
      policyDefaults?: Partial<PolicyDefaults>;
    },
  ) {
    if (input.subdomain) {
      const normalized = normalizeSubdomain(input.subdomain);
      if (normalized.length < 3)
        throw new OnboardingError(
          "Subdomain must be at least 3 valid characters.",
          400,
          "SUBDOMAIN_TOO_SHORT",
        );
      if (reservedSubdomains.has(normalized))
        throw new OnboardingError(
          "Subdomain is not available.",
          409,
          "SUBDOMAIN_TAKEN",
        );
    }
    try {
      return await this.mutate(shopId, true, async (db, session, shop) => {
        const fields: Partial<ShopDocument> = {
          policyDefaults: { ...shop.policyDefaults, ...input.policyDefaults },
        };
        for (const key of [
          "legalName",
          "displayName",
          "category",
          "country",
          "address",
          "logoUrl",
          "language",
        ] as const) {
          if (input[key] !== undefined)
            Object.assign(fields, { [key]: input[key] });
        }
        if (input.currency) fields.currency = input.currency.toUpperCase();
        if (input.subdomain)
          fields.subdomain = normalizeSubdomain(input.subdomain);
        await collections(db).shops.updateOne(
          { _id: shopId },
          { $set: fields },
          { session },
        );
        await audit(db, session, shop, "shop.updated");
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000)
        throw new OnboardingError(
          "Subdomain is not available.",
          409,
          "SUBDOMAIN_TAKEN",
        );
      throw error;
    }
  }
  async addProduct(
    shopId: string,
    input: Omit<FirstProduct, "id" | "shopId" | "status" | "createdAt">,
  ) {
    try {
      return await this.mutate(shopId, true, async (db, session, shop) => {
        const c = collections(db),
          productId = randomUUID(),
          variantId = randomUUID(),
          createdAt = now();
        await c.products.insertOne(
          {
            _id: productId,
            shopId,
            name: input.name,
            slug: normalizeSubdomain(input.name),
            status: "active",
            price: money(input.price),
            currency: shop.currency,
            createdAt,
          },
          { session },
        );
        await c.variants.insertOne(
          {
            _id: variantId,
            shopId,
            productId,
            title: "Default",
            price: money(input.price),
            status: "active",
            createdAt,
          },
          { session },
        );
        await c.ledger.insertOne(
          {
            _id: randomUUID(),
            shopId,
            variantId,
            reason: "opening_stock",
            deltaQuantity: input.stock,
            quantityAfter: input.stock,
            createdBy: "onboarding",
            createdAt,
          },
          { session },
        );
        await c.shops.updateOne(
          { _id: shopId },
          { $set: { onboardingStep: "channels" } },
          { session },
        );
        await audit(db, session, shop, "product.created", "product", productId);
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000)
        throw new OnboardingError(
          "Product already exists.",
          409,
          "PRODUCT_CONFLICT",
        );
      throw error;
    }
  }
  async skipMeta(shopId: string) {
    return this.mutate(shopId, false, async (db, session, shop) => {
      const c = collections(db);
      await c.channels.updateOne(
        { shopId, provider: "meta" },
        {
          $setOnInsert: {
            _id: randomUUID(),
            shopId,
            provider: "meta",
            status: "skipped",
            reason: "website-only-start",
            createdAt: now(),
          },
        },
        { upsert: true, session },
      );
      await c.shops.updateOne(
        { _id: shopId },
        { $set: { onboardingStep: "ai_mode" } },
        { session },
      );
      await audit(db, session, shop, "channel.meta_skipped");
    });
  }
  async updateAiMode(shopId: string, aiMode: AiMode) {
    return this.mutate(shopId, false, async (db, session, shop) => {
      await collections(db).shops.updateOne(
        { _id: shopId },
        { $set: { aiMode, onboardingStep: "launch" } },
        { session },
      );
      await audit(db, session, shop, "ai_mode.updated", "shop", shopId, {
        aiMode,
      });
    });
  }
  async chooseTemplate(shopId: string, templateId: string) {
    return this.mutate(shopId, true, async (db, session, shop) => {
      if (!templateCatalog.some((t) => t.id === templateId))
        throw new OnboardingError(
          "Template not found.",
          404,
          "TEMPLATE_NOT_FOUND",
        );
      await collections(db).shops.updateOne(
        { _id: shopId },
        { $set: { selectedTemplateId: templateId } },
        { session },
      );
      await audit(
        db,
        session,
        shop,
        "template.selected",
        "template",
        templateId,
      );
    });
  }
  async launch(shopId: string) {
    return this.mutate(shopId, false, async (db, session, shop) => {
      const c = collections(db);
      const product = await c.products.findOne(
        { shopId, status: "active" },
        { session },
      );
      if (
        !shop.displayName ||
        !shop.subdomain ||
        (!product && !shop.selectedTemplateId)
      )
        throw new OnboardingError(
          "Launch blocked: add at least one product or choose a template",
          409,
          "LAUNCH_BLOCKED",
        );
      await c.shops.updateOne(
        { _id: shopId },
        { $set: { status: "launched", launchedAt: now() } },
        { session },
      );
      await audit(db, session, shop, "shop.launched");
    });
  }
}
export const onboardingService = new OnboardingService();
