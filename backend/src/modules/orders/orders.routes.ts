import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Db, Decimal128 } from "mongodb";
import { connectDb } from "../../shared/db.js";
import { amount, collections, money, publicDocument } from "../../shared/models.js";

const uuid = z.string().uuid();
type OrderDocument = {
  _id: string;
  shopId: string;
  orderNumber: string;
  status: string;
  buyer: { name: string; phone: string; address: string; notes?: string };
  items: Array<{
    productId: string;
    variantId: string;
    productName: string;
    variantTitle: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  currency: string;
  subtotal: Decimal128;
  deliveryCharge: Decimal128;
  total: Decimal128;
  requestId: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};
const checkoutSchema = z.object({
  requestId: uuid,
  buyer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(30),
    address: z.string().trim().min(3).max(400),
    notes: z.string().trim().max(1000).optional(),
  }),
  items: z
    .array(
      z.object({
        productId: uuid,
        variantId: uuid,
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(30),
});

async function stockFor(db: Db, shopId: string, variantId: string) {
  const balance = await db
    .collection<{
      _id: string;
      shopId: string;
      onHand: number;
      reserved: number;
    }>("inventoryBalances")
    .findOne({ shopId, _id: variantId });
  if (balance)
    return Number(balance.onHand ?? 0) - Number(balance.reserved ?? 0);
  const entries = await collections(db).ledger
    .find({ shopId, variantId })
    .toArray();
  return entries.reduce((sum, entry) => sum + entry.deltaQuantity, 0);
}

export async function registerOrderRoutes(app: FastifyInstance) {
  app.post("/storefront/:subdomain/orders", async (request, reply) => {
    const { subdomain } = z
      .object({ subdomain: z.string().trim().min(3).max(40) })
      .parse(request.params);
    const input = checkoutSchema.parse(request.body);
    const db = await connectDb();
    const c = collections(db);
    const shop = await c.shops.findOne({ subdomain, status: "launched" });
    if (!shop)
      return reply.code(404).send({ code: "SHOP_NOT_FOUND", message: "Published shop not found." });
    const orders = db.collection<OrderDocument>("orders");
    const prior = await orders.findOne({ shopId: shop._id, requestId: input.requestId });
    if (prior) return publicDocument(prior);

    const lines = [];
    for (const item of input.items) {
      const product = await c.products.findOne({ _id: item.productId, shopId: shop._id, status: "active" });
      const variant = await c.variants.findOne({
        _id: item.variantId,
        shopId: shop._id,
        productId: item.productId,
        status: "active",
      });
      if (!product || !variant)
        return reply.code(404).send({ code: "PRODUCT_NOT_FOUND", message: "One product is no longer available." });
      const available = await stockFor(db, shop._id, variant._id);
      if (available < item.quantity)
        return reply.code(409).send({ code: "INSUFFICIENT_STOCK", message: `${product.name} has only ${available} available.` });
      const unitPrice = amount(variant.price);
      lines.push({
        productId: product._id,
        variantId: variant._id,
        productName: product.name,
        variantTitle: variant.title,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      });
    }

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const deliveryCharge = Number(shop.policyDefaults?.deliveryCharge ?? 0);
    const createdAt = new Date().toISOString();
    const order = {
      _id: randomUUID(),
      shopId: shop._id,
      orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}`,
      status: "new",
      buyer: input.buyer,
      items: lines,
      currency: shop.currency,
      subtotal: money(subtotal),
      deliveryCharge: money(deliveryCharge),
      total: money(subtotal + deliveryCharge),
      requestId: input.requestId,
      source: "storefront",
      createdAt,
      updatedAt: createdAt,
    };
    await orders.insertOne(order);
    await c.audit.insertOne({
      _id: randomUUID(),
      shopId: shop._id,
      actor: "system",
      actorId: "buyer",
      action: "order.created",
      targetType: "order",
      targetId: order._id,
      createdAt,
    });
    return publicDocument(order);
  });

  app.get("/:shopId", async (request) => {
    const { shopId } = z.object({ shopId: uuid }).parse(request.params);
    const db = await connectDb();
    const orders = await db
      .collection<OrderDocument>("orders")
      .find({ shopId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .toArray();
    return {
      orders: orders.map((order) => ({
        ...publicDocument(order),
        subtotal: amount(order.subtotal),
        deliveryCharge: amount(order.deliveryCharge),
        total: amount(order.total),
      })),
    };
  });
}
