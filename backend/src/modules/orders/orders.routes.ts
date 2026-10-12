import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { MongoServerError, type ClientSession, type Db, type Decimal128 } from "mongodb";
import { connectDb, transaction } from "../../shared/db.js";
import { amount, collections, money, publicDocument } from "../../shared/models.js";

const uuid = z.string().uuid();
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

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
  fingerprint: string;
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

function publicOrder(order: OrderDocument) {
  return {
    ...publicDocument(order),
    subtotal: amount(order.subtotal),
    deliveryCharge: amount(order.deliveryCharge),
    total: amount(order.total),
  };
}

function validationError(error: ZodError) {
  return {
    code: "VALIDATION_ERROR",
    message: "Check the highlighted fields and try again.",
    issues: error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    })),
  };
}

async function stockFor(
  db: Db,
  shopId: string,
  productId: string,
  variantId: string,
  session?: ClientSession,
) {
  const balance = await db
    .collection<{
      _id: string;
      shopId: string;
      onHand: number;
      reserved: number;
    }>("inventoryBalances")
    .findOne({ shopId, _id: variantId }, { session });
  if (balance)
    return Number(balance.onHand ?? 0) - Number(balance.reserved ?? 0);
  const entries = await collections(db).ledger
    .find({ shopId, variantId }, { session })
    .toArray();
  return entries.reduce((sum, entry) => sum + entry.deltaQuantity, 0);
}

async function reserveStock(
  db: Db,
  session: ClientSession,
  line: OrderDocument["items"][number],
  shopId: string,
  orderId: string,
) {
  const balances = db.collection<{
    _id: string;
    shopId: string;
    productId: string;
    onHand: number;
    reserved: number;
    sold: number;
    returned: number;
    version: number;
  }>("inventoryBalances");
  let current = await balances.findOne(
    { shopId, _id: line.variantId },
    { session },
  );
  if (!current) {
    await balances.updateOne(
      { shopId, _id: line.variantId },
      {
        $setOnInsert: {
          _id: line.variantId,
          shopId,
          productId: line.productId,
          onHand: await stockFor(
            db,
            shopId,
            line.productId,
            line.variantId,
            session,
          ),
          reserved: 0,
          sold: 0,
          returned: 0,
          version: 0,
        },
      },
      { upsert: true, session },
    );
    current = await balances.findOne(
      { shopId, _id: line.variantId },
      { session },
    );
  }
  if (!current)
    throw Object.assign(new Error("Stock changed. Reload before trying again."), {
      statusCode: 409,
      code: "VERSION_CONFLICT",
    });
  const onHand = current.onHand;
  const reserved = current.reserved;
  if (onHand - reserved < line.quantity)
    throw Object.assign(
      new Error(`${line.productName} has only ${Math.max(0, onHand - reserved)} available.`),
      { statusCode: 409, code: "INSUFFICIENT_STOCK" },
    );
  const saved = await balances.updateOne(
    {
      shopId,
      _id: line.variantId,
      version: current.version,
      $expr: {
        $gte: [{ $subtract: ["$onHand", "$reserved"] }, line.quantity],
      },
    },
    { $inc: { reserved: line.quantity, version: 1 } },
    { session },
  );
  if (saved.modifiedCount !== 1)
    throw Object.assign(new Error("Stock changed. Reload before trying again."), {
      statusCode: 409,
      code: "VERSION_CONFLICT",
    });
  const availableAfter = onHand - reserved - line.quantity;
  await db.collection<{ _id: string; [key: string]: unknown }>("inventoryLedger").insertOne(
    {
      _id: randomUUID(),
      shopId,
      productId: line.productId,
      variantId: line.variantId,
      previousValue: onHand,
      newValue: onHand,
      difference: 0,
      before: { onHand, reserved, sold: current?.sold ?? 0, returned: current?.returned ?? 0 },
      after: {
        onHand,
        reserved: reserved + line.quantity,
        sold: current?.sold ?? 0,
        returned: current?.returned ?? 0,
      },
      deltaQuantity: -line.quantity,
      quantityAfter: availableAfter,
      reason: `Order ${orderId}`,
      kind: "reserve",
      createdBy: "buyer",
      source: "storefront-order",
      createdAt: new Date().toISOString(),
      requestId: `${orderId}:${line.variantId}`,
      fingerprint: digest({ orderId, variantId: line.variantId, quantity: line.quantity }),
    },
    { session },
  );
}

export async function registerOrderRoutes(app: FastifyInstance) {
  app.post("/storefront/:subdomain/orders", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const params = z
      .object({ subdomain: z.string().trim().min(3).max(40) })
      .safeParse(request.params);
    const parsed = checkoutSchema.safeParse(request.body);
    if (!params.success)
      return reply.code(400).send(validationError(params.error));
    if (!parsed.success)
      return reply.code(400).send(validationError(parsed.error));
    const subdomain = params.data.subdomain.toLowerCase();
    const input = parsed.data;
    const fingerprint = digest(input);
    const db = await connectDb();
    const c = collections(db);
    const shop = await c.shops.findOne({ subdomain, status: "launched" });
    if (!shop)
      return reply.code(404).send({ code: "SHOP_NOT_FOUND", message: "Published shop not found." });
    const orders = db.collection<OrderDocument>("orders");
    const prior = await orders.findOne({ shopId: shop._id, requestId: input.requestId });
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        return reply.code(409).send({
          code: "IDEMPOTENCY_CONFLICT",
          message: "This order request was already used with different data.",
        });
      return publicOrder(prior);
    }

    const lines: OrderDocument["items"] = [];
    for (const item of input.items) {
      const product = await c.products.findOne({ _id: item.productId, shopId: shop._id, status: "active" });
      const variant =
        item.variantId === item.productId
          ? await c.variants.findOne(
              { shopId: shop._id, productId: item.productId, status: "active" },
              { sort: { createdAt: 1, _id: 1 } },
            )
          : await c.variants.findOne({
              _id: item.variantId,
              shopId: shop._id,
              productId: item.productId,
              status: "active",
            });
      if (!product || !variant)
        return reply.code(404).send({ code: "PRODUCT_NOT_FOUND", message: "One product is no longer available." });
      const available = await stockFor(db, shop._id, product._id, variant._id);
      if (available < item.quantity)
        return reply.code(409).send({ code: "INSUFFICIENT_STOCK", message: `${product.name} has only ${available} available.` });
      const existing = lines.find((line) => line.variantId === variant._id);
      if (existing) {
        existing.quantity += item.quantity;
        existing.lineTotal = existing.unitPrice * existing.quantity;
      } else {
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
    }
    for (const line of lines) {
      const available = await stockFor(db, shop._id, line.productId, line.variantId);
      if (available < line.quantity)
        return reply.code(409).send({ code: "INSUFFICIENT_STOCK", message: `${line.productName} has only ${available} available.` });
    }

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const deliveryCharge = Number(shop.policyDefaults?.deliveryCharge ?? 0);
    const createdAt = new Date().toISOString();
    const order: OrderDocument = {
      _id: randomUUID(),
      shopId: shop._id,
      orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`,
      status: "new",
      buyer: input.buyer,
      items: lines,
      currency: shop.currency,
      subtotal: money(subtotal),
      deliveryCharge: money(deliveryCharge),
      total: money(subtotal + deliveryCharge),
      requestId: input.requestId,
      fingerprint,
      source: "storefront",
      createdAt,
      updatedAt: createdAt,
    };
    try {
      return await transaction(async (txDb, session) => {
        const txOrders = txDb.collection<OrderDocument>("orders");
        await txOrders.insertOne(order, { session });
        for (const line of lines)
          await reserveStock(txDb, session, line, shop._id, order._id);
        await txDb.collection<{ _id: string; [key: string]: unknown }>("auditEvents").insertOne(
          {
            _id: randomUUID(),
            shopId: shop._id,
            actor: "system",
            actorId: "buyer",
            action: "order.created",
            targetType: "order",
            targetId: order._id,
            createdAt,
          },
          { session },
        );
        return publicOrder(order);
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        const completed = await orders.findOne({
          shopId: shop._id,
          requestId: input.requestId,
        });
        if (completed?.fingerprint === fingerprint) return publicOrder(completed);
        return reply.code(409).send({
          code: "IDEMPOTENCY_CONFLICT",
          message: "This order request was already used with different data.",
        });
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        "code" in error
      )
        return reply
          .code(Number(error.statusCode))
          .send({
            code: String(error.code),
            message: error instanceof Error ? error.message : "Request failed.",
          });
      throw error;
    }
  });

  app.get("/:shopId", async (request) => {
    const parsed = z.object({ shopId: uuid }).safeParse(request.params);
    if (!parsed.success) return { orders: [] };
    const { shopId } = parsed.data;
    const db = await connectDb();
    const orders = await db
      .collection<OrderDocument>("orders")
      .find({ shopId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .toArray();
    return {
      orders: orders.map(publicOrder),
    };
  });
}
