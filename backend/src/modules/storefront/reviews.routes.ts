import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { MongoServerError } from "mongodb";
import { z } from "zod";
import { connectDb, transaction } from "../../shared/db.js";
import { collections } from "../../shared/models.js";
import { config } from "../../shared/config.js";
import { receiptInput, verifiedOrder } from "../orders/orders.routes.js";
export type Review = {
  _id: string;
  shopId: string;
  orderId: string;
  target: string;
  name: string;
  rating: number;
  text: string;
  createdAt: Date;
  reply?: { text: string; at: string };
};
const bodySchema = receiptInput
  .extend({
    name: z.string().trim().min(2).max(60),
    rating: z.number().int().min(1).max(5),
    text: z.string().trim().min(10).max(1500),
    productId: z.string().uuid().optional(),
  })
  .strict();
const view = (r: Review) => ({
  id: r._id,
  productId: r.target === "store" ? null : r.target,
  name: r.name,
  rating: r.rating,
  text: r.text,
  createdAt: r.createdAt,
  purchaseVerified: true,
  reply: r.reply ?? null,
});
export async function registerStorefrontReviews(app: FastifyInstance) {
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  app.get("/:subdomain/reviews", async (req, reply) => {
    const { subdomain } = req.params as { subdomain: string };
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).max(1000).default(1),
        productId: z.string().uuid().optional(),
      })
      .safeParse(req.query);
    if (!parsed.success)
      return reply
        .code(400)
        .send({ code: "VALIDATION_ERROR", message: "Invalid review page." });
    const db = await connectDb(),
      shop = await collections(db).shops.findOne({
        subdomain,
        status: "launched",
      });
    if (!shop)
      return reply
        .code(404)
        .send({ code: "SHOP_NOT_FOUND", message: "Published shop not found." });
    const filter = {
        shopId: shop._id,
        target: parsed.data.productId ?? "store",
      },
      c = db.collection<Review>("verifiedReviews");
    const groups = await c
      .aggregate<{ _id: number; count: number }>([
        { $match: filter },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
      ])
      .toArray();
    const count = groups.reduce((n, g) => n + g.count, 0);
    const reviews = await c
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((parsed.data.page - 1) * 6)
      .limit(6)
      .toArray();
    return {
      reviews: reviews.map(view),
      count,
      average: count
        ? groups.reduce((n, g) => n + g._id * g.count, 0) / count
        : null,
      distribution: [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count: groups.find((g) => g._id === rating)?.count ?? 0,
      })),
      page: parsed.data.page,
      hasMore: parsed.data.page * 6 < count,
    };
  });
  app.post(
    "/:subdomain/reviews",
    { config: { rateLimit: { max: 30, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      if (req.headers.origin !== config.appOrigin)
        return reply
          .code(403)
          .send({
            code: "ORIGIN_REJECTED",
            message: "Use the storefront review form.",
          });
      const body = bodySchema.safeParse(req.body);
      if (!body.success)
        return reply
          .code(400)
          .send({
            code: "VALIDATION_ERROR",
            message:
              "Check your order reference, receipt key, rating and review.",
            issues: body.error.issues,
          });
      const { subdomain } = req.params as { subdomain: string };
      try {
        return await transaction(async (db, session) => {
          const shop = await collections(db).shops.findOne(
            { subdomain, status: "launched" },
            { session },
          );
          if (!shop)
            return reply
              .code(404)
              .send({
                code: "SHOP_NOT_FOUND",
                message: "Published shop not found.",
              });
          const o = await verifiedOrder(db, shop._id, body.data, session);
          if (!o)
            return reply
              .code(403)
              .send({
                code: "REVIEW_NOT_ELIGIBLE",
                message:
                  "Use the order reference, checkout phone and private receipt key from a delivered order.",
              });
          if (
            body.data.productId &&
            !o.items.some((i) => i.productId === body.data.productId)
          )
            return reply
              .code(403)
              .send({
                code: "REVIEW_NOT_ELIGIBLE",
                message:
                  "This product was not included in that delivered order.",
              });
          const c = db.collection<Review>("verifiedReviews"),
            filter = {
              shopId: shop._id,
              orderId: o._id,
              target: body.data.productId ?? "store",
            },
            old = await c.findOne(filter, { session });
          if (old) {
            if (
              old.name === body.data.name &&
              old.rating === body.data.rating &&
              old.text === body.data.text
            )
              return { review: view(old) };
            return reply
              .code(409)
              .send({
                code: "REVIEW_EXISTS",
                message: "This order has already reviewed this item or store.",
              });
          }
          const review: Review = {
            _id: randomUUID(),
            ...filter,
            name: body.data.name,
            rating: body.data.rating,
            text: body.data.text,
            createdAt: new Date(),
          };
          await c.insertOne(review, { session });
          return { review: view(review) };
        });
      } catch (e) {
        if (e instanceof MongoServerError && e.code === 11000)
          return reply
            .code(409)
            .send({
              code: "REVIEW_EXISTS",
              message: "A review was already submitted for this order.",
            });
        throw e;
      }
    },
  );
}
export async function registerSellerReviews(app: FastifyInstance) {
  app.get("/:shopId", async (req) => {
    const { shopId } = req.params as { shopId: string };
    const db = await connectDb();
    const reviews = await db
      .collection<Review>("verifiedReviews")
      .find({ shopId })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    const products = await collections(db)
      .products.find({ shopId })
      .project({ _id: 1, name: 1 })
      .toArray();
    return {
      reviews: reviews.map((r) => ({
        ...view(r),
        productName:
          r.target === "store"
            ? null
            : (products.find((p) => p._id === r.target)?.name ??
              "Product no longer available"),
      })),
    };
  });
  app.patch("/:shopId/:reviewId/reply", async (req, reply) => {
    const { shopId, reviewId } = req.params as {
      shopId: string;
      reviewId: string;
    };
    const parsed = z
      .object({ text: z.string().trim().min(2).max(1500) })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({
          code: "VALIDATION_ERROR",
          message: "Write a reply of 2–1,500 characters.",
        });
    return transaction(async (db, session) => {
      const response = { text: parsed.data.text, at: new Date().toISOString() };
      const result = await db
        .collection<Review>("verifiedReviews")
        .updateOne(
          { _id: reviewId, shopId },
          { $set: { reply: response } },
          { session },
        );
      if (!result.matchedCount)
        return reply
          .code(404)
          .send({ code: "REVIEW_NOT_FOUND", message: "Review not found." });
      await collections(db).audit.insertOne(
        {
          _id: randomUUID(),
          shopId,
          actor: "owner",
          actorId: req.authUser!.id,
          action: "review.replied",
          targetType: "review",
          targetId: reviewId,
          metadata: {},
          createdAt: response.at,
        },
        { session },
      );
      return { reply: response };
    });
  });
}
