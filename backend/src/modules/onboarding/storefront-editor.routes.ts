import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { connectDb, transaction } from "../../shared/db.js";
import { collections } from "../../shared/models.js";
import {
  storefrontContentSchema,
  publicStorefrontContent,
} from "../storefront/content.schema.js";
export async function registerStorefrontEditorRoutes(app: FastifyInstance) {
  app.get("/:shopId/storefront-content", async (request, reply) => {
    const { shopId } = request.params as { shopId: string };
    const c = collections(await connectDb());
    const shop = await c.shops.findOne({
      _id: shopId,
      ownerId: request.authUser!.id,
    });
    if (!shop)
      return reply
        .code(404)
        .send({ code: "SHOP_NOT_FOUND", message: "Shop not found." });
    const products = await c.products
      .find(
        { shopId, status: { $ne: "archived" } },
        { projection: { _id: 1, name: 1, status: 1, imageUrl: 1, images: 1 } },
      )
      .toArray();
    return {
      content: publicStorefrontContent(
        shop.storefrontConfig?.draftContent ?? shop.storefrontConfig?.content,
      ),
      hasUnpublishedChanges: Boolean(
        shop.storefrontConfig?.hasUnpublishedChanges,
      ),
      version: Number(shop.storefrontConfig?.contentVersion ?? 0),
      shop: {
        id: shopId,
        name: shop.displayName,
        subdomain: shop.subdomain,
        status: shop.status,
        selectedTemplateId: shop.selectedTemplateId,
      },
      products: products.map((p) => ({
        id: p._id,
        name: p.name,
        status: p.status,
        imageUrl: p.images?.[0] || p.imageUrl || null,
      })),
    };
  });
  app.patch("/:shopId/storefront-content", async (request, reply) => {
    const { shopId } = request.params as { shopId: string };
    const parsed = z
      .object({
        version: z.number().int().nonnegative(),
        content: storefrontContentSchema,
        publish: z.boolean().default(true),
      })
      .strict()
      .safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "Check your storefront information.",
        issues: parsed.error.issues,
      });
    const { content, version, publish } = parsed.data;
    const db = await connectDb();
    const result = await transaction(async (_db, session) => {
      const c = collections(db);
      const shop = await c.shops.findOne(
        { _id: shopId, ownerId: request.authUser!.id },
        { session },
      );
      if (!shop) return "missing";
      if (Number(shop.storefrontConfig?.contentVersion ?? 0) !== version)
        return "stale";
      const ids = [
        ...new Set([
          ...content.featuredProductIds,
          ...content.collections.flatMap((v) => v.productIds),
        ]),
      ];
      if (
        ids.length !==
        (await c.products.countDocuments(
          { _id: { $in: ids }, shopId, status: { $ne: "archived" } },
          { session },
        ))
      )
        return "products";
      const now = new Date().toISOString();
      await c.shops.updateOne(
        { _id: shopId, ownerId: request.authUser!.id },
        {
          $set: {
            "storefrontConfig.draftContent": content,
            "storefrontConfig.hasUnpublishedChanges": !publish,
            ...(publish
              ? {
                  "storefrontConfig.content": content,
                  ...(content.design.themeId
                    ? { selectedTemplateId: content.design.themeId }
                    : {}),
                }
              : {}),
            "storefrontConfig.contentVersion": version + 1,
            updatedAt: now,
          },
          $inc: { revision: 1 },
        },
        { session },
      );
      await c.audit.insertOne(
        {
          _id: randomUUID(),
          shopId,
          actor: "owner",
          actorId: request.authUser!.id,
          action: "storefront.content_updated",
          targetType: "shop",
          targetId: shopId,
          createdAt: now,
          metadata: { version: version + 1, publish },
        },
        { session },
      );
      return "saved";
    });
    if (result !== "saved")
      return reply.code(result === "missing" ? 404 : 409).send({
        code:
          result === "stale"
            ? "CONTENT_CONFLICT"
            : result === "products"
              ? "PRODUCT_SELECTION_INVALID"
              : "SHOP_NOT_FOUND",
        message:
          result === "stale"
            ? "This storefront changed in another tab. Reload before saving."
            : result === "products"
              ? "A selected product is no longer available. Review your selection."
              : "Shop not found.",
      });
    return { content, version: version + 1, hasUnpublishedChanges: !publish };
  });
}
