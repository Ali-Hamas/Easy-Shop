import type { FastifyInstance } from "fastify";
import { connectDb } from "../../shared/db.js";
import { collections, amount } from "../../shared/models.js";
import { templateCatalog } from "../onboarding/template-catalog.js";

const STOREFRONT_CACHE_TTL_MS = 15_000;
const storefrontCache = new Map<
  string,
  { expiresAt: number; value: unknown }
>();

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
    const wantsPreview = Boolean(
      (request.query as { preview?: string })?.preview === "true" ||
      request.headers["x-preview-mode"] === "true",
    );
    const cached = !wantsPreview ? storefrontCache.get(subdomain) : undefined;
    if (cached && cached.expiresAt > Date.now())
      return reply
        .header(
          "Cache-Control",
          "public, max-age=15, stale-while-revalidate=45",
        )
        .send(cached.value);
    const db = await connectDb();
    const c = collections(db);
    const shop = await c.shops.findOne({ subdomain });
    if (!shop) {
      return reply
        .code(404)
        .send({ code: "SHOP_NOT_FOUND", message: "Published shop not found." });
    }

    const isOwner = Boolean(
      request.authUser && request.authUser.id === shop.ownerId,
    );
    const isPreview = isOwner && wantsPreview;

    if (shop.status !== "launched" && !isOwner) {
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

    const productIds = documents.map((product) => product._id);
    const [variants, imgDocs] = await Promise.all([
      c.variants
        .find({ shopId: shop._id, productId: { $in: productIds } })
        .toArray(),
      c.images
        .find({ shopId: shop._id, productId: { $in: productIds } })
        .sort({ sortOrder: 1 })
        .toArray(),
    ]);
    const variantIds = variants.map((variant) => variant._id);
    const assetIds = imgDocs.map((image) => image.assetId);
    const [balances, assets] = await Promise.all([
      variantIds.length
        ? db
            .collection<{
              _id: string;
              shopId: string;
              onHand: number;
              reserved: number;
            }>("inventoryBalances")
            .find({ shopId: shop._id, _id: { $in: variantIds } })
            .toArray()
        : [],
      assetIds.length
        ? c.assets.find({ shopId: shop._id, _id: { $in: assetIds } }).toArray()
        : [],
    ]);
    const variantsByProduct = new Map<string, typeof variants>();
    for (const variant of variants)
      variantsByProduct.set(variant.productId, [
        ...(variantsByProduct.get(variant.productId) ?? []),
        variant,
      ]);
    const imagesByProduct = new Map<string, typeof imgDocs>();
    for (const image of imgDocs)
      imagesByProduct.set(image.productId, [
        ...(imagesByProduct.get(image.productId) ?? []),
        image,
      ]);
    const assetUrlById = new Map(
      assets.map((asset) => [asset._id, asset.publicUrl]),
    );
    const balanceByVariant = new Map(
      balances.map((balance) => [balance._id, balance]),
    );

    const products = documents.map((p) => {
      const productVariants = variantsByProduct.get(p._id) ?? [];
      const assetImages = (imagesByProduct.get(p._id) ?? [])
        .map((image) => assetUrlById.get(image.assetId))
        .filter((url): url is string => Boolean(url));
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
        productImages[0] || productVariants.find((v) => v.image)?.image || null;

      let stock = productVariants.reduce((total, variant) => {
        const balance = balanceByVariant.get(variant._id);
        return (
          total +
          (balance
            ? balance.onHand - balance.reserved
            : variant.openingStock || 0)
        );
      }, 0);
      if (stock === 0 && p.stock) {
        stock = Number(p.stock);
      }

      const canonicalSlug = p.slug || toSlug(p.name) || `product-${p._id}`;

      return {
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
        variants: productVariants.map((v) => ({
          id: v._id,
          sku: v.sku ?? null,
          title: v.title,
          price: amount(v.price),
          stock: (() => {
            const balance = balanceByVariant.get(v._id);
            return balance
              ? balance.onHand - balance.reserved
              : v.openingStock || 0;
          })(),
        })),
      };
    });

    const template =
      templateCatalog.find((t) => t.id === shop.selectedTemplateId) ??
      templateCatalog[0];

    const result = {
      shop: {
        id: shop._id,
        displayName: shop.displayName,
        subdomain: shop.subdomain,
        category: shop.category,
        country: shop.country,
        currency: shop.currency,
        logoUrl: shop.logoUrl ?? null,
        language: shop.language,
        status: shop.status,
        policyDefaults: shop.policyDefaults,
        selectedTemplateId: template.id,
        config: shop.storefrontConfig,
      },
      template,
      products,
    };
    if (!isPreview && shop.status === "launched") {
      storefrontCache.set(subdomain, {
        value: result,
        expiresAt: Date.now() + STOREFRONT_CACHE_TTL_MS,
      });
      return reply
        .header(
          "Cache-Control",
          "public, max-age=15, stale-while-revalidate=45",
        )
        .send(result);
    }
    return result;
  });

  app.get("/:subdomain/products/:slug", async (request, reply) => {
    const { subdomain, slug } = request.params as {
      subdomain: string;
      slug: string;
    };
    const wantsPreview = Boolean(
      (request.query as { preview?: string })?.preview === "true" ||
      request.headers["x-preview-mode"] === "true",
    );
    const productId = (request.query as { productId?: string })?.productId;
    const cacheKey = `product:${subdomain}:${slug}:${productId ?? ""}`;
    const cached = !wantsPreview ? storefrontCache.get(cacheKey) : undefined;
    if (cached && cached.expiresAt > Date.now())
      return reply
        .header(
          "Cache-Control",
          "public, max-age=15, stale-while-revalidate=45",
        )
        .send(cached.value);
    const db = await connectDb();
    const c = collections(db);
    const shop = await c.shops.findOne({ subdomain });
    if (!shop) {
      return reply
        .code(404)
        .send({ code: "SHOP_NOT_FOUND", message: "Published shop not found." });
    }

    const isOwner = Boolean(
      request.authUser && request.authUser.id === shop.ownerId,
    );
    const isPreview = isOwner && wantsPreview;

    if (shop.status !== "launched" && !isOwner) {
      return reply
        .code(404)
        .send({ code: "SHOP_NOT_FOUND", message: "Published shop not found." });
    }

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

    const [variants, imgDocs] = await Promise.all([
      c.variants
        .find({ shopId: p.shopId, productId: p._id })
        .sort({ createdAt: 1, _id: 1 })
        .toArray(),
      c.images
        .find({ shopId: p.shopId, productId: p._id })
        .sort({ sortOrder: 1 })
        .toArray(),
    ]);
    const [balances, assets] = await Promise.all([
      variants.length
        ? db
            .collection<{ _id: string; onHand: number; reserved: number }>(
              "inventoryBalances",
            )
            .find({
              shopId: p.shopId,
              _id: { $in: variants.map((v) => v._id) },
            })
            .toArray()
        : [],
      imgDocs.length
        ? c.assets
            .find({
              shopId: p.shopId,
              _id: { $in: imgDocs.map((img) => img.assetId) },
            })
            .toArray()
        : [],
    ]);
    const balanceByVariant = new Map(
      balances.map((balance) => [balance._id, balance]),
    );
    const assetUrlById = new Map(
      assets.map((asset) => [asset._id, asset.publicUrl]),
    );
    const assetImages = imgDocs
      .map((img) => assetUrlById.get(img.assetId))
      .filter((url): url is string => Boolean(url));
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
            stock: (() => {
              const balance = balanceByVariant.get(v._id);
              return balance
                ? balance.onHand - balance.reserved
                : v.openingStock || 0;
            })(),
          }))
        : [
            {
              id: p._id,
              sku: p.sku ?? null,
              title: "Default",
              price: amount(p.price),
              stock: p.stock ? Number(p.stock) : 0,
            },
          ];

    const result = {
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
    if (!isPreview && shop.status === "launched") {
      storefrontCache.set(cacheKey, {
        value: result,
        expiresAt: Date.now() + STOREFRONT_CACHE_TTL_MS,
      });
      return reply
        .header(
          "Cache-Control",
          "public, max-age=15, stale-while-revalidate=45",
        )
        .send(result);
    }
    return result;
  });
}
