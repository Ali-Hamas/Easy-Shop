import { Decimal128, type Db } from "mongodb";
import type {
  Owner,
  Shop,
  ChannelConnection,
  AuditEvent,
} from "../modules/onboarding/onboarding.types.js";
type Stored<T> = Omit<T, "id"> & { _id: string };
export type ShopDocument = Stored<Shop> & {
  storefrontConfig: Record<string, unknown>;
  revision: number;
};
export type ProductDocument = {
  _id: string;
  shopId: string;
  name: string;
  slug: string;
  sku?: string;
  category?: string;
  description?: string;
  images?: string[];
  imageUrl?: string;
  stock?: number;
  status: "draft" | "active" | "archived";
  price: Decimal128;
  currency: string;
  createdAt: string;
};
export type VariantDocument = {
  _id: string;
  shopId: string;
  productId: string;
  title: string;
  sku?: string;
  image?: string;
  openingStock?: number;
  price: Decimal128;
  status: "active" | "archived";
  createdAt: string;
};
export function money(value: number) {
  // Match NUMERIC(12,2) rounding using decimal digits, not binary toFixed rounding.
  const [coefficient, exponent = "0"] = value.toString().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = BigInt(whole + fraction);
  const scale = Number(exponent) - fraction.length + 2;
  const divisor = 10n ** BigInt(Math.max(0, -scale));
  const cents =
    scale >= 0
      ? digits * 10n ** BigInt(scale)
      : (digits + divisor / 2n) / divisor;
  return Decimal128.fromString(
    `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`,
  );
}
export const amount = (value: Decimal128) => Number(value.toString());
export function collections(db: Db) {
  return {
    users: db.collection<Stored<Owner>>("users"),
    shops: db.collection<ShopDocument>("shops"),
    staff: db.collection<{
      _id: string;
      shopId: string;
      userId: string;
      role: string;
      status: string;
      createdAt: string;
    }>("shopStaff"),
    products: db.collection<ProductDocument>("products"),
    variants: db.collection<VariantDocument>("productVariants"),
    assets: db.collection<{
      _id: string;
      shopId: string;
      storageDriver: string;
      bucket: string;
      objectKey: string;
      publicUrl: string;
      mimeType: string;
      byteSize: number;
      purpose: string;
      createdAt: string;
    }>("assetObjects"),
    images: db.collection<{
      _id: string;
      shopId: string;
      productId: string;
      assetId: string;
      sortOrder: number;
      altText?: string;
    }>("productImages"),
    ledger: db.collection<{
      _id: string;
      shopId: string;
      variantId: string;
      reason: string;
      deltaQuantity: number;
      quantityAfter: number;
      createdBy: string;
      createdAt: string;
    }>("inventoryLedger"),
    audit: db.collection<Stored<AuditEvent> & { actorId: string }>(
      "auditEvents",
    ),
    channels: db.collection<Stored<ChannelConnection>>("shopChannels"),
  };
}
export async function ensureIndexes(db: Db) {
  await db
    .collection("buyerSessions")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db
    .collection("authSessions")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("authSessions").createIndex({ userId: 1 });
  await db
    .collection("customers")
    .createIndex({ shopId: 1, lastActivityAt: -1, _id: 1 });
  await db
    .collection("customers")
    .createIndex({ shopId: 1, status: 1, source: 1 });
  await db.collection("customers").createIndex({ shopId: 1, tags: 1 });
  await db.collection("customers").createIndex(
    { shopId: 1, phoneKey: 1 },
    {
      unique: true,
      partialFilterExpression: { phoneKey: { $type: "string" } },
    },
  );
  await db
    .collection("customers")
    .createIndex({ shopId: 1, requestId: 1 }, { unique: true });
  await db
    .collection("customerEvents")
    .createIndex({ shopId: 1, customerId: 1, createdAt: -1, _id: -1 });
  await db.collection("customerEvents").createIndex(
    { shopId: 1, requestId: 1 },
    {
      unique: true,
      partialFilterExpression: { requestId: { $type: "string" } },
    },
  );
  const c = collections(db);
  await c.users.createIndex(
    { email: 1 },
    { unique: true, partialFilterExpression: { email: { $type: "string" } } },
  );
  await c.users.createIndex(
    { phone: 1 },
    { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
  );
  await c.shops.createIndex({ subdomain: 1 }, { unique: true });
  await c.shops.createIndex({ ownerId: 1, createdAt: 1 });
  await c.staff.createIndex({ shopId: 1, userId: 1 }, { unique: true });
  await c.products.createIndex({ shopId: 1, slug: 1 }, { unique: true });
  await c.products.createIndex({ shopId: 1, status: 1, createdAt: 1 });
  await c.products.createIndex({ shopId: 1, category: 1, createdAt: -1 });
  await c.products.createIndex(
    { shopId: 1, sku: 1 },
    { unique: true, partialFilterExpression: { sku: { $type: "string" } } },
  );
  await c.products.createIndex(
    { shopId: 1, requestId: 1 },
    {
      unique: true,
      partialFilterExpression: { requestId: { $type: "string" } },
    },
  );
  await db
    .collection("inventoryBalances")
    .createIndex({ shopId: 1, productId: 1 });
  await c.ledger.createIndex({ shopId: 1, productId: 1, createdAt: -1 });
  await c.ledger.createIndex(
    { shopId: 1, requestId: 1 },
    {
      unique: true,
      partialFilterExpression: { requestId: { $type: "string" } },
    },
  );
  await c.variants.createIndex({ shopId: 1, productId: 1 });
  await c.variants.createIndex(
    { shopId: 1, sku: 1 },
    { unique: true, partialFilterExpression: { sku: { $type: "string" } } },
  );
  await c.assets.createIndex(
    { storageDriver: 1, bucket: 1, objectKey: 1 },
    { unique: true },
  );
  await c.images.createIndex({ shopId: 1, productId: 1, sortOrder: 1 });
  await c.ledger.createIndex({ shopId: 1, variantId: 1, createdAt: 1 });
  await c.audit.createIndex({ shopId: 1, createdAt: 1 });
  await c.channels.createIndex({ shopId: 1, provider: 1 }, { unique: true });
  await db
    .collection("conversations")
    .createIndex({ shopId: 1, lastActivityAt: -1, _id: 1 });
  await db
    .collection("conversations")
    .createIndex({ shopId: 1, customerId: 1, lastActivityAt: -1 });
  await db
    .collection("conversations")
    .createIndex({ shopId: 1, status: 1, aiStatus: 1 });
  await db.collection("conversations").createIndex(
    { shopId: 1, channelThreadId: 1 },
    {
      unique: true,
      partialFilterExpression: { channelThreadId: { $type: "string" } },
    },
  );
  await db.collection("conversations").createIndex(
    { shopId: 1, requestId: 1 },
    {
      unique: true,
      partialFilterExpression: { requestId: { $type: "string" } },
    },
  );
  await db
    .collection("messages")
    .createIndex({ shopId: 1, conversationId: 1, createdAt: 1, _id: 1 });
  await db.collection("messages").createIndex(
    { shopId: 1, requestId: 1 },
    {
      unique: true,
      partialFilterExpression: { requestId: { $type: "string" } },
    },
  );
  await db
    .collection("aiDrafts")
    .createIndex({ shopId: 1, conversationId: 1, createdAt: -1 });
  await db.collection("aiDrafts").createIndex(
    { shopId: 1, requestId: 1 },
    {
      unique: true,
      partialFilterExpression: { requestId: { $type: "string" } },
    },
  );
  await db
    .collection("passwordResetOtps")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("passwordResetOtps").createIndex({ email: 1 });
}
export function publicDocument<T extends { _id: string }>(
  document: T,
): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = document;
  return { id: _id, ...rest };
}
