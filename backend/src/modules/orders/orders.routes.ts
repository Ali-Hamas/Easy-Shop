import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Db, ClientSession } from "mongodb";
import { connectDb, transaction } from "../../shared/db.js";
import { collections, amount } from "../../shared/models.js";
import { config } from "../../shared/config.js";
import { orderStock, InventoryError } from "../inventory/inventory.service.js";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const normalizePhone = (s: string) => s.replace(/[^0-9]/g, "");
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d ()-]{7,30}$/)
  .transform(normalizePhone)
  .refine((s) => s.length >= 7 && s.length <= 15);
export type Order = {
  _id: string;
  shopId: string;
  requestId: string;
  receiptHash: string;
  fingerprint: string;
  buyer: { name: string; phone: string; address: string; city: string };
  items: {
    productId: string;
    variantId: string;
    name: string;
    variantTitle: string;
    price: number;
    quantity: number;
  }[];
  subtotal: number;
  delivery: number;
  total: number;
  currency: string;
  status:
    "new" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled";
  version: number;
  createdAt: string;
  timeline: { status: string; at: string }[];
};
const line = z
  .object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(99),
  })
  .strict();
const checkout = z
  .object({
    requestId: z.string().uuid(),
    receiptKey: z.string().regex(/^[a-f0-9]{64}$/),
    buyer: z
      .object({
        name: z.string().trim().min(2).max(100),
        phone,
        address: z.string().trim().min(10).max(500),
        city: z.string().trim().min(2).max(100),
      })
      .strict(),
    items: z.array(line).min(1).max(30),
    expectedTotal: z.number().nonnegative().max(100000000),
  })
  .strict();
export const receiptInput = z.object({
  orderId: z.string().uuid(),
  phone,
  receiptKey: z.string().regex(/^[a-f0-9]{64}$/),
});
export async function verifiedOrder(
  db: Db,
  shopId: string,
  input: z.infer<typeof receiptInput>,
  session?: ClientSession,
) {
  const order = await db
    .collection<Order>("orders")
    .findOne(
      {
        _id: input.orderId,
        shopId,
        "buyer.phone": input.phone,
        receiptHash: digest(input.receiptKey),
        status: "delivered",
      },
      { session },
    );
  return order;
}
function publicOrder(o: Order) {
  return {
    id: o._id,
    status: o.status,
    items: o.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      productId: i.productId,
    })),
    total: o.total,
    currency: o.currency,
    timeline: o.timeline,
    reviewEligible: o.status === "delivered",
  };
}
export async function registerGuestOrders(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (req.method === "POST" && req.headers.origin !== config.appOrigin)
      return reply
        .code(403)
        .send({
          code: "ORIGIN_REJECTED",
          message: "Use the storefront to place or track an order.",
        });
  });
  app.post(
    "/:subdomain/checkout",
    { config: { rateLimit: { max: 20, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const parsed = checkout.safeParse(req.body);
      if (!parsed.success)
        return reply
          .code(400)
          .send({
            code: "VALIDATION_ERROR",
            message: "Check your delivery details and bag.",
            issues: parsed.error.issues,
          });
      const input = parsed.data;
      const { subdomain } = req.params as { subdomain: string };
      try {
        const order = await transaction(async (db, session) => {
          const c = collections(db),
            shop = await c.shops.findOne(
              { subdomain, status: "launched" },
              { session },
            );
          if (!shop)
            throw new InventoryError(
              "SHOP_NOT_FOUND",
              "Published shop not found.",
              404,
            );
          const existing = await db
            .collection<Order>("orders")
            .findOne(
              { shopId: shop._id, requestId: input.requestId },
              { session },
            );
          const fingerprint = digest(JSON.stringify(input));
          if (existing) {
            if (existing.fingerprint !== fingerprint)
              throw new InventoryError(
                "IDEMPOTENCY_CONFLICT",
                "This request was already used. Refresh your bag.",
              );
            return existing;
          }
          if (!shop.policyDefaults.codAllowed)
            throw new InventoryError(
              "PAYMENT_UNAVAILABLE",
              "Online checkout is not available for this shop. Ask the seller about payment.",
            );
          const items: Order["items"] = [];
          for (const l of input.items) {
            const p = await c.products.findOne(
              { _id: l.productId, shopId: shop._id, status: "active" },
              { session },
            );
            if (!p)
              throw new InventoryError(
                "PRODUCT_UNAVAILABLE",
                "A product is no longer available. Refresh your bag.",
              );
            const variants = await c.variants
              .find(
                { shopId: shop._id, productId: p._id, status: "active" },
                { session },
              )
              .toArray();
            const v = l.variantId
              ? variants.find((v) => v._id === l.variantId)
              : variants.length === 1
                ? variants[0]
                : undefined;
            if (!v)
              throw new InventoryError(
                "VARIANT_REQUIRED",
                `Choose an available option for ${p.name}.`,
              );
            if (items.some((i) => i.variantId === v._id))
              throw new InventoryError(
                "DUPLICATE_ITEM",
                "Combine duplicate items in your bag.",
                400,
              );
            const b = await db
              .collection<{ _id: string; onHand: number; reserved: number }>(
                "inventoryBalances",
              )
              .findOne({ _id: v._id, shopId: shop._id } as never, { session });
            const ledger = await c.ledger
              .find({ shopId: shop._id, variantId: v._id }, { session })
              .toArray();
            const available = b
              ? b.onHand - b.reserved
              : ledger.reduce((n, e) => n + e.deltaQuantity, 0);
            if (available < l.quantity)
              throw new InventoryError(
                "INVALID_STOCK",
                `${p.name} has insufficient stock. Refresh your bag.`,
              );
            items.push({
              productId: p._id,
              variantId: v._id,
              name: p.name,
              variantTitle: v.title,
              price: amount(v.price),
              quantity: l.quantity,
            });
          }
          const subtotal =
              items.reduce(
                (n, i) => n + Math.round(i.price * 100) * i.quantity,
                0,
              ) / 100,
            delivery = shop.policyDefaults.deliveryCharge,
            total = Math.round((subtotal + delivery) * 100) / 100;
          if (Math.round(input.expectedTotal * 100) !== Math.round(total * 100))
            throw new InventoryError(
              "PRICE_CHANGED",
              "Prices or delivery charges changed. Refresh your bag before placing the order.",
            );
          // Serialize duplicate checks for this shop without touching inventory until seller confirmation.
          await c.shops.updateOne(
            { _id: shop._id },
            { $inc: { revision: 1 } },
            { session },
          );
          const duplicate = await db
            .collection<Order>("orders")
            .findOne(
              {
                shopId: shop._id,
                "buyer.phone": input.buyer.phone,
                status: "new",
                createdAt: {
                  $gte: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                },
                items,
              },
              { session },
            );
          if (duplicate)
            throw new InventoryError(
              "DUPLICATE_ORDER",
              "A matching order is already awaiting confirmation. Track your earlier order or contact the shop.",
            );
          const now = new Date().toISOString(),
            o: Order = {
              _id: randomUUID(),
              shopId: shop._id,
              requestId: input.requestId,
              receiptHash: digest(input.receiptKey),
              fingerprint,
              buyer: input.buyer,
              items,
              subtotal,
              delivery,
              total,
              currency: shop.currency,
              status: "new",
              version: 0,
              createdAt: now,
              timeline: [{ status: "new", at: now }],
            };
          await db.collection<Order>("orders").insertOne(o, { session });
          return o;
        });
        return reply.code(201).send({ order: publicOrder(order) });
      } catch (e) {
        if (e instanceof InventoryError)
          return reply
            .code(e.statusCode)
            .send({ code: e.code, message: e.message });
        throw e;
      }
    },
  );
  app.post(
    "/:subdomain/orders/track",
    { config: { rateLimit: { max: 30, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const parsed = z
        .object({ orderId: z.string().uuid(), phone })
        .strict()
        .safeParse(req.body);
      if (!parsed.success)
        return reply
          .code(400)
          .send({
            code: "VALIDATION_ERROR",
            message: "Enter the order reference and checkout phone number.",
          });
      const db = await connectDb(),
        { subdomain } = req.params as { subdomain: string };
      const shop = await collections(db).shops.findOne({
        subdomain,
        status: "launched",
      });
      const order =
        shop &&
        (await db
          .collection<Order>("orders")
          .findOne({
            _id: parsed.data.orderId,
            shopId: shop._id,
            "buyer.phone": parsed.data.phone,
          }));
      if (!order)
        return reply
          .code(404)
          .send({
            code: "ORDER_NOT_FOUND",
            message:
              "No matching order. Check your reference and phone number.",
          });
      return { order: publicOrder(order) };
    },
  );
}
export async function registerSellerOrders(app: FastifyInstance) {
  app.get("/:shopId", async (req) => {
    const { shopId } = req.params as { shopId: string };
    const db = await connectDb();
    const orders = await db
      .collection<Order>("orders")
      .find(
        { shopId },
        { projection: { receiptHash: 0, fingerprint: 0, requestId: 0 } },
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    return { orders: orders.map(({ _id, ...o }) => ({ id: _id, ...o })) };
  });
  app.patch("/:shopId/:orderId", async (req, reply) => {
    const { shopId, orderId } = req.params as {
      shopId: string;
      orderId: string;
    };
    const parsed = z
      .object({
        version: z.number().int().nonnegative(),
        status: z.enum([
          "confirmed",
          "packed",
          "shipped",
          "delivered",
          "cancelled",
        ]),
      })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({
          code: "VALIDATION_ERROR",
          message: "Choose a valid order transition.",
        });
    try {
      return await transaction(async (db, session) => {
        const col = db.collection<Order>("orders"),
          o = await col.findOne({ _id: orderId, shopId }, { session });
        if (!o)
          throw new InventoryError("ORDER_NOT_FOUND", "Order not found.", 404);
        if (o.version !== parsed.data.version)
          throw new InventoryError(
            "VERSION_CONFLICT",
            "Order changed. Reload before updating.",
          );
        const next: Record<string, string[]> = {
          new: ["confirmed", "cancelled"],
          confirmed: ["packed", "cancelled"],
          packed: ["shipped", "cancelled"],
          shipped: ["delivered"],
          delivered: [],
          cancelled: [],
        };
        const status = parsed.data.status;
        if (!next[o.status].includes(status))
          throw new InventoryError(
            "INVALID_TRANSITION",
            "This order cannot move to that status.",
          );
        const kind =
          status === "confirmed"
            ? "reserve"
            : status === "delivered"
              ? "sale"
              : status === "cancelled" && o.status !== "new"
                ? "release"
                : null;
        if (kind)
          for (const i of o.items)
            await orderStock(
              db,
              session,
              shopId,
              i.productId,
              i.variantId,
              i.quantity,
              kind,
              o._id,
            );
        const now = new Date().toISOString();
        await col.updateOne(
          { _id: o._id, shopId },
          {
            $set: { status },
            $inc: { version: 1 },
            $push: { timeline: { status, at: now } },
          },
          { session },
        );
        await collections(db).audit.insertOne(
          {
            _id: randomUUID(),
            shopId,
            actor: "owner",
            actorId: req.authUser!.id,
            action: "order.status_updated",
            targetType: "order",
            targetId: o._id,
            metadata: { from: o.status, to: status },
            createdAt: now,
          },
          { session },
        );
        return { status, version: o.version + 1 };
      });
    } catch (e) {
      if (e instanceof InventoryError)
        return reply
          .code(e.statusCode)
          .send({ code: e.code, message: e.message });
      throw e;
    }
  });
}
