import { publicStorefrontContent } from "./content.schema.js";
import type { FastifyInstance } from "fastify";
import { connectDb } from "../../shared/db.js";
import { collections, amount } from "../../shared/models.js";
import { templateCatalog, resolveTemplateId } from "../onboarding/template-catalog.js";

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

export async function registerStorefrontRoutes(app: FastifyInstance) {
  app.get("/:subdomain", async (request, reply) => {
    const { subdomain } = request.params as { subdomain: string };
    const c = collections(await connectDb());
    const shop = await c.shops.findOne({ subdomain });
    if (!shop) {
      return reply
        .code(404)
        .send({ code: "SHOP_NOT_FOUND", message: "Published shop not found." });
    }

    const isOwner = Boolean(
      request.authUser && request.authUser.id === shop.ownerId,
    );
    const isPreview =
      isOwner && (request.query as { preview?: string })?.preview === "true";

    if (shop.status !== "launched" && !isPreview) {
      return reply
        .code(404)
        .send({ code: "SHOP_NOT_FOUND", message: "Published shop not found." });
    }

    const documents = await c.products
      .find({
        shopId: shop._id,
        ...(isPreview ? {} : { status: "active" }),
      })
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    const products = [];
    for (const p of documents) {
      const variants = await c.variants
        .find({ shopId: shop._id, productId: p._id, status: "active" })
        .toArray();
      const entries = await c.ledger
        .find({
          shopId: shop._id,
          variantId: { $in: variants.map((v) => v._id) },
        })
        .toArray();
      const imgDocs = await c.images
        .find({ shopId: shop._id, productId: p._id, status: "active" })
        .sort({ sortOrder: 1 })
        .toArray();
      const assetImages: string[] = [];
      for (const img of imgDocs) {
        const a = await c.assets.findOne({
          _id: img.assetId,
          shopId: shop._id,
        });
        if (a?.publicUrl) assetImages.push(a.publicUrl);
      }
      const rawImages: string[] =
        Array.isArray(p.images) && p.images.length > 0
          ? p.images
          : assetImages.length > 0
            ? assetImages
            : p.imageUrl
              ? [p.imageUrl]
              : [];
      const productImages = Array.from(new Set(rawImages.filter(Boolean)));
      const imageUrl =
        productImages[0] || variants.find((v) => v.image)?.image || null;

      let stock = entries.reduce((n, e) => n + e.deltaQuantity, 0);
      if (entries.length === 0 && p.stock) {
        stock = Number(p.stock);
      }
      if (entries.length === 0 && stock === 0 && variants.length > 0) {
        stock = variants.reduce((sum, v) => sum + (v.openingStock || 0), 0);
      }

      const canonicalSlug = p.slug || toSlug(p.name) || `product-${p._id}`;

      products.push({
        id: p._id,
        slug: canonicalSlug,
        name: p.name,
        category: p.category || "",
        description: p.description || null,
        price: amount(p.price),
        stock,
        imageUrl: typeof imageUrl === "string" ? imageUrl : null,
        images: productImages,
        status: p.status,
        variants: variants.map((v) => ({
          id: v._id,
          sku: v.sku ?? null,
          title: v.title,
          price: amount(v.price),
          stock: entries.some((e) => e.variantId === v._id)
            ? entries
                .filter((e) => e.variantId === v._id)
                .reduce((n, e) => n + e.deltaQuantity, 0)
            : v.openingStock || 0,
        })),
      });
    }

    const template =
      templateCatalog.find((t) => t.id === resolveTemplateId(shop.selectedTemplateId)) ??
      templateCatalog[0];

    return {
      shop: {
        id: shop._id,
        displayName: publicStorefrontContent(isPreview ? shop.storefrontConfig?.draftContent ?? shop.storefrontConfig?.content : shop.storefrontConfig?.content).storeName || shop.displayName,
        subdomain: shop.subdomain,
        category: shop.category,
        country: shop.country,
        currency: shop.currency,
        logoUrl: shop.logoUrl ?? null,
        language: shop.language,
        status: shop.status,
        ownerPreview: isPreview,
        policyDefaults: shop.policyDefaults,
        selectedTemplateId: template.id,
        content: publicStorefrontContent(isPreview ? shop.storefrontConfig?.draftContent ?? shop.storefrontConfig?.content : shop.storefrontConfig?.content),
      },
      template,
      products,
    };
  });

  app.get("/:subdomain/products/:slug", async (request, reply) => {
    const { subdomain, slug } = request.params as {
      subdomain: string;
      slug: string;
    };
    const c = collections(await connectDb());
    const shop = await c.shops.findOne({ subdomain });
    if (!shop) {
      return reply
        .code(404)
        .send({ code: "SHOP_NOT_FOUND", message: "Published shop not found." });
    }

    const isOwner = Boolean(
      request.authUser && request.authUser.id === shop.ownerId,
    );
    const isPreview =
      isOwner && (request.query as { preview?: string })?.preview === "true";

    if (shop.status !== "launched" && !isPreview) {
      return reply
        .code(404)
        .send({ code: "SHOP_NOT_FOUND", message: "Published shop not found." });
    }

    const productId = (request.query as { productId?: string })?.productId;
    const p = await c.products.findOne({
      shopId: shop._id,
      $or: [
        { slug },
        ...(productId ? [{ _id: productId }] : []),
        { _id: slug },
      ],
      ...(isPreview ? {} : { status: "active" }),
    });

    if (!p) {
      return reply.code(404).send({
        code: "PRODUCT_NOT_FOUND",
        message: "Published product not found.",
      });
    }

    const variants = await c.variants
      .find({ shopId: p.shopId, productId: p._id, status: "active" })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();

    const entries = await c.ledger
      .find({
        shopId: p.shopId,
        variantId: { $in: variants.map((v) => v._id) },
      })
      .toArray();

    const imgDocs = await c.images
      .find({ shopId: p.shopId, productId: p._id, status: "active" })
      .sort({ sortOrder: 1 })
      .toArray();
    const assetImages: string[] = [];
    for (const img of imgDocs) {
      const a = await c.assets.findOne({ _id: img.assetId, shopId: p.shopId });
      if (a?.publicUrl) assetImages.push(a.publicUrl);
    }
    const rawImages: string[] =
      Array.isArray(p.images) && p.images.length > 0
        ? p.images
        : assetImages.length > 0
          ? assetImages
          : p.imageUrl
            ? [p.imageUrl]
            : [];
    const productImages = Array.from(new Set(rawImages.filter(Boolean)));
    const imageUrl =
      productImages[0] || variants.find((v) => v.image)?.image || null;

    const mappedVariants =
      variants.length > 0
        ? variants.map((v) => ({
            id: v._id,
            sku: v.sku ?? null,
            title: v.title,
            price: amount(v.price),
            stock: entries.some((e) => e.variantId === v._id)
              ? entries
                  .filter((e) => e.variantId === v._id)
                  .reduce((n, e) => n + e.deltaQuantity, 0)
              : v.openingStock || 0,
          }))
        : [
            {
              id: p._id,
              sku: p.sku ?? null,
              title: "Default",
              price: amount(p.price),
              stock:
                entries.reduce((n, e) => n + e.deltaQuantity, 0) ||
                (p.stock ? Number(p.stock) : 0),
            },
          ];

    return {
      product: {
        id: p._id,
        name: p.name,
        slug: p.slug || toSlug(p.name) || `product-${p._id}`,
        category: p.category || "",
        description: p.description ?? null,
        price: amount(p.price),
        currency: p.currency,
        imageUrl: typeof imageUrl === "string" ? imageUrl : null,
        images: productImages,
        variants: mappedVariants,
      },
    };
  });
}
