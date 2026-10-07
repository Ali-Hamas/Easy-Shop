import { currentActor } from "../auth/auth.js";
import { randomUUID, createHash } from "node:crypto";
import { MongoServerError, type Db, type ClientSession } from "mongodb";
import { connectDb, transaction } from "../../shared/db.js";
import {
  collections,
  amount,
  money,
  type ProductDocument,
  type VariantDocument,
} from "../../shared/models.js";
import type { ProductInput, AdjustmentInput } from "./inventory.validators.js";
type Product = ProductDocument &
  Omit<ProductInput, "price" | "variants" | "status"> & {
    version: number;
    updatedAt: string;
    requestId?: string;
    fingerprint?: string;
  };
type Variant = VariantDocument &
  Omit<ProductInput["variants"][number], "id"> & { inventoryRevision?: number };
type Balance = {
  _id: string;
  shopId: string;
  productId: string;
  onHand: number;
  reserved: number;
  sold: number;
  returned: number;
  version: number;
};
export class InventoryError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 409,
  ) {
    super(message);
  }
}
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const pcol = (db: Db) => db.collection<Product>("products");
const vcol = (db: Db) => db.collection<Variant>("productVariants");
const bcol = (db: Db) => db.collection<Balance>("inventoryBalances");
async function shopExists(db: Db, shopId: string, session?: ClientSession) {
  if (!(await collections(db).shops.findOne({ _id: shopId }, { session })))
    throw new InventoryError("SHOP_NOT_FOUND", "Shop not found.", 404);
}
async function balance(
  db: Db,
  shopId: string,
  variantId: string,
  productId: string,
  session?: ClientSession,
): Promise<Balance> {
  const stored = await bcol(db).findOne(
    { _id: variantId, shopId },
    { session },
  );
  if (stored) return stored;
  const entries = await collections(db)
    .ledger.find({ shopId, variantId }, { session })
    .toArray();
  return {
    _id: variantId,
    shopId,
    productId,
    onHand: entries.reduce((n, e) => n + e.deltaQuantity, 0),
    reserved: 0,
    sold: 0,
    returned: 0,
    version: 0,
  };
}
async function detail(
  db: Db,
  shopId: string,
  id: string,
  session?: ClientSession,
) {
  const p = await pcol(db).findOne({ _id: id, shopId }, { session });
  if (!p)
    throw new InventoryError("PRODUCT_NOT_FOUND", "Product not found.", 404);
  const variants = await vcol(db)
    .find({ shopId, productId: id }, { session })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
  const mapped = await Promise.all(
    variants.map(async (v) => {
      const b = await balance(db, shopId, v._id, id, session);
      return {
        id: v._id,
        title: v.title,
        sku: v.sku ?? "",
        size: v.size ?? "",
        color: v.color ?? "",
        material: v.material ?? "",
        image: v.image ?? "",
        priceOverride: v.priceOverride ?? null,
        price: amount(v.price),
        lowStockThreshold: v.lowStockThreshold ?? 5,
        onHand: b.onHand,
        reserved: b.reserved,
        available: b.onHand - b.reserved,
        sold: b.sold,
        returned: b.returned,
        version: b.version,
      };
    }),
  );
  return {
    id: p._id,
    shopId,
    name: p.name,
    slug: p.slug,
    sku: p.sku ?? "",
    category: p.category ?? "",
    description: p.description ?? "",
    price: amount(p.price),
    currency: p.currency,
    comparePrice: p.comparePrice ?? null,
    cost: p.cost ?? null,
    images: p.images ?? [],
    status: p.status,
    aiFacts: p.aiFacts ?? {
      sellingPoints: "",
      audience: "",
      care: "",
      policyExceptions: "",
    },
    seo: p.seo ?? { title: "", description: "" },
    delivery: p.delivery ?? { weightGrams: null, note: "" },
    version: p.version ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt ?? p.createdAt,
    variants: mapped,
    available: mapped.reduce((n, v) => n + v.available, 0),
    reserved: mapped.reduce((n, v) => n + v.reserved, 0),
    lowStock:
      mapped.some((v) => v.available > 0) &&
      mapped.some((v) => v.available <= v.lowStockThreshold),
    outOfStock: mapped.every((v) => v.available === 0),
  };
}
async function audit(
  db: Db,
  session: ClientSession,
  shopId: string,
  id: string,
  event: string,
) {
  await collections(db).audit.insertOne(
    {
      _id: randomUUID(),
      shopId,
      actorId: currentActor(),
      actor: "system",
      action: event,
      targetType: "product",
      targetId: id,
      metadata: { source: "inventory-development" },
      createdAt: new Date().toISOString(),
    },
    { session },
  );
}
async function writeLedger(
  db: Db,
  session: ClientSession,
  before: Balance,
  after: Balance,
  reason: string,
  kind: string,
  requestId: string,
  hash: string,
) {
  const availableBefore = before.onHand - before.reserved,
    availableAfter = after.onHand - after.reserved;
  await db
    .collection<{ _id: string; [key: string]: unknown }>("inventoryLedger")
    .insertOne(
      {
        _id: randomUUID(),
        shopId: after.shopId,
        productId: after.productId,
        variantId: after._id,
        previousValue: before.onHand,
        newValue: after.onHand,
        difference: after.onHand - before.onHand,
        before: {
          onHand: before.onHand,
          reserved: before.reserved,
          sold: before.sold,
          returned: before.returned,
        },
        after: {
          onHand: after.onHand,
          reserved: after.reserved,
          sold: after.sold,
          returned: after.returned,
        },
        deltaQuantity: availableAfter - availableBefore,
        quantityAfter: availableAfter,
        reason,
        kind,
        createdBy: currentActor(),
        source: "inventory-development",
        createdAt: new Date().toISOString(),
        requestId,
        fingerprint: hash,
      },
      { session },
    );
}
async function saveImages(
  db: Db,
  session: ClientSession,
  shopId: string,
  productId: string,
  urls: string[],
) {
  const c = collections(db);
  await c.images.deleteMany({ shopId, productId }, { session });
  for (const [sortOrder, publicUrl] of urls.entries()) {
    const assetId = randomUUID();
    await c.assets.insertOne(
      {
        _id: assetId,
        shopId,
        storageDriver: "external",
        bucket: "inventory",
        objectKey: assetId,
        publicUrl,
        mimeType: "image/*",
        byteSize: 0,
        purpose: "product",
        createdAt: new Date().toISOString(),
      },
      { session },
    );
    await c.images.insertOne(
      { _id: randomUUID(), shopId, productId, assetId, sortOrder },
      { session },
    );
  }
}
async function conflict<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof MongoServerError && e.code === 11000)
      throw new InventoryError(
        "SKU_CONFLICT",
        "This SKU, product address or request already exists. Reload before retrying.",
      );
    throw e;
  }
}
export const inventoryService = {
  async list(
    shopId: string,
    query: {
      q: string;
      status: string;
      category: string;
      stock: string;
      page: number;
      limit: number;
    },
  ) {
    const db = await connectDb();
    await shopExists(db, shopId);
    const filter: Record<string, unknown> = { shopId };
    if (query.status !== "all") filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { sku: { $regex: escaped, $options: "i" } },
      ];
    }
    const docs = await pcol(db)
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(2001)
      .toArray();
    if (docs.length > 2000)
      throw new InventoryError(
        "FILTER_REQUIRED",
        "Narrow your search to fewer than 2,000 products.",
        422,
      );
    let products = await Promise.all(
      docs.map((p) => detail(db, shopId, p._id)),
    );
    const summary = {
      products: products.length,
      available: products.reduce((n, p) => n + p.available, 0),
      reserved: products.reduce((n, p) => n + p.reserved, 0),
      low: products.filter((p) => p.lowStock && p.status === "active").length,
      out: products.filter((p) => p.outOfStock && p.status === "active").length,
    };
    if (query.stock !== "all")
      products = products.filter((p) =>
        query.stock === "out"
          ? p.outOfStock
          : query.stock === "low"
            ? p.lowStock
            : !p.outOfStock && !p.lowStock,
      );
    return {
      products: products.slice(
        (query.page - 1) * query.limit,
        query.page * query.limit,
      ),
      total: products.length,
      page: query.page,
      summary,
      currency: (await collections(db).shops.findOne({ _id: shopId }))!
        .currency,
      categories: await pcol(db).distinct("category", { shopId }),
    };
  },
  async get(shopId: string, id: string) {
    return detail(await connectDb(), shopId, id);
  },
  async save(
    shopId: string,
    input: ProductInput,
    id?: string,
    version = 0,
    requestId?: string,
  ) {
    return conflict(() =>
      transaction(async (db, session) => {
        await shopExists(db, shopId, session);
        const c = collections(db);
        const hash = fingerprint(input);
        if (!id && requestId) {
          const old = await pcol(db).findOne(
            { shopId, requestId },
            { session },
          );
          if (old) {
            if (old.fingerprint !== hash)
              throw new InventoryError(
                "IDEMPOTENCY_CONFLICT",
                "Request ID was already used with different data.",
              );
            return detail(db, shopId, old._id, session);
          }
        }
        const old = id
          ? await pcol(db).findOne({ _id: id, shopId }, { session })
          : null;
        if (id && !old)
          throw new InventoryError(
            "PRODUCT_NOT_FOUND",
            "Product not found.",
            404,
          );
        if (old && (old.version ?? 0) !== version)
          throw new InventoryError(
            "VERSION_CONFLICT",
            "Product changed. Reload before saving.",
          );
        const productId = id ?? randomUUID(),
          now = new Date().toISOString();
        const current = old
          ? await vcol(db).find({ shopId, productId }, { session }).toArray()
          : [];
        if (current.some((v) => !input.variants.some((i) => i.id === v._id)))
          throw new InventoryError(
            "VARIANT_HISTORY_REQUIRED",
            "Existing variants cannot be removed. Their stock history must be retained.",
          );
        for (const v of input.variants) {
          if (v.id && !current.some((c) => c._id === v.id))
            throw new InventoryError(
              "VARIANT_NOT_FOUND",
              "Variant does not belong to this product.",
              404,
            );
          if (v.id && v.openingStock !== 0)
            throw new InventoryError(
              "USE_ADJUSTMENT",
              "Use the adjustment flow to change existing stock.",
              400,
            );
        }
        const shop = await c.shops.findOne({ _id: shopId }, { session });
        const { variants, ...fields } = input;
        const record = {
          ...fields,
          price: money(input.price),
          updatedAt: now,
          version: version + 1,
        };
        if (old)
          await pcol(db).updateOne(
            { _id: productId, shopId },
            { $set: record },
            { session },
          );
        else
          await pcol(db).insertOne(
            {
              ...record,
              _id: productId,
              shopId,
              slug:
                input.name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "") || `product-${productId}`,
              currency: shop!.currency,
              createdAt: now,
              requestId,
              fingerprint: hash,
            },
            { session },
          );
        for (const v of variants) {
          const variantId = v.id ?? randomUUID();
          const { id: _, openingStock, ...rest } = v;
          const data = {
            ...rest,
            price: money(v.priceOverride ?? input.price),
          };
          if (v.id)
            await vcol(db).updateOne(
              { _id: variantId, shopId, productId },
              { $set: data },
              { session },
            );
          else {
            await vcol(db).insertOne(
              {
                ...data,
                openingStock: 0,
                _id: variantId,
                shopId,
                productId,
                status: "active",
                createdAt: now,
              },
              { session },
            );
            const initial: Balance = {
                _id: variantId,
                shopId,
                productId,
                onHand: 0,
                reserved: 0,
                sold: 0,
                returned: 0,
                version: 0,
              },
              after = { ...initial, onHand: openingStock, version: 1 };
            await bcol(db).insertOne(after, { session });
            await writeLedger(
              db,
              session,
              initial,
              after,
              "Opening stock",
              "opening",
              `${requestId ?? randomUUID()}:${variantId}`,
              hash,
            );
          }
        }
        await saveImages(db, session, shopId, productId, input.images);
        await audit(
          db,
          session,
          shopId,
          productId,
          old ? "inventory.product_updated" : "inventory.product_created",
        );
        return detail(db, shopId, productId, session);
      }),
    );
  },
  async adjust(shopId: string, productId: string, input: AdjustmentInput) {
    return conflict(() =>
      transaction(async (db, session) => {
        const hash = fingerprint({ productId, ...input });
        const prior = await db
          .collection("inventoryLedger")
          .findOne({ shopId, requestId: input.requestId }, { session });
        if (prior) {
          if (prior.fingerprint !== hash)
            throw new InventoryError(
              "IDEMPOTENCY_CONFLICT",
              "Request ID was already used with different data.",
            );
          return detail(db, shopId, productId, session);
        }
        const variant = await vcol(db).findOneAndUpdate(
          { _id: input.variantId, shopId, productId },
          { $inc: { inventoryRevision: 1 } },
          { session },
        );
        if (!variant)
          throw new InventoryError(
            "VARIANT_NOT_FOUND",
            "Variant not found.",
            404,
          );
        const before = await balance(
          db,
          shopId,
          input.variantId,
          productId,
          session,
        );
        if (before.version !== input.version)
          throw new InventoryError(
            "VERSION_CONFLICT",
            "Stock changed. Reload the latest quantity before adjusting.",
          );
        const after = { ...before, version: before.version + 1 },
          q = input.quantity;
        if (input.kind !== "correction" && q < 0)
          throw new InventoryError(
            "INVALID_QUANTITY",
            "Use a positive quantity for this operation.",
            400,
          );
        switch (input.kind) {
          case "correction":
          case "receive":
            after.onHand += q;
            break;
          case "reserve":
            after.reserved += q;
            break;
          case "release":
            after.reserved -= q;
            break;
          case "sale":
            after.onHand -= q;
            after.reserved -= q;
            after.sold += q;
            break;
          case "return":
            after.onHand += q;
            after.returned += q;
            break;
        }
        if (
          after.onHand < 0 ||
          after.reserved < 0 ||
          after.reserved > after.onHand ||
          after.returned > after.sold ||
          after.onHand > 100000000
        )
          throw new InventoryError(
            "INVALID_STOCK",
            "This change would make stock invalid. Check available, reserved and sold quantities.",
          );
        await bcol(db).replaceOne({ _id: after._id, shopId }, after, {
          upsert: true,
          session,
        });
        await writeLedger(
          db,
          session,
          before,
          after,
          input.reason,
          input.kind,
          input.requestId,
          hash,
        );
        await audit(db, session, shopId, productId, "inventory.stock_adjusted");
        return detail(db, shopId, productId, session);
      }),
    );
  },
  async history(shopId: string, productId: string, page = 1) {
    const db = await connectDb();
    const p = await detail(db, shopId, productId);
    const filter = { shopId, variantId: { $in: p.variants.map((v) => v.id) } };
    const entries = await db
      .collection("inventoryLedger")
      .find(filter, { projection: { fingerprint: 0 } })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * 50)
      .limit(50)
      .toArray();
    return {
      entries: entries.map(({ _id, ...e }) => ({
        id: _id,
        ...e,
        previousValue: e.previousValue ?? e.quantityAfter - e.deltaQuantity,
        newValue: e.newValue ?? e.quantityAfter,
        difference: e.difference ?? e.deltaQuantity,
      })),
      total: await db.collection("inventoryLedger").countDocuments(filter),
      page,
    };
  },
};
