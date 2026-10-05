import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "../dist/shared/load-env.js";
loadEnvFile(".env");
if (!process.env.MONGODB_URI?.startsWith("mongodb+srv://"))
  throw Error("Atlas SRV URI required for this verification.");
const name = `easy_shop_inventory_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
process.env.MONGODB_DB_NAME = name;
process.env.LOG_LEVEL = "silent";
const { buildApp } = await import("../dist/app.js");
const { connectDb, closeDb } = await import("../dist/shared/db.js");
const { ensureIndexes } = await import("../dist/shared/models.js");
let cookie = "";
let db,
  app,
  checks = 0;
async function call(method, url, payload, status = 200) {
  const r = await app.inject({ method, url, payload, headers: { cookie, origin: process.env.APP_ORIGIN ?? "http://localhost:3000" } });
  assert.equal(r.statusCode, status, `${method} ${url}: ${r.body}`);
  checks++;
  return r.json();
}
try {
  db = await connectDb();
  await ensureIndexes(db);
  app = await buildApp();
  const account = await app.inject({ method: "POST", url: "/api/v1/auth/register", headers: { origin: process.env.APP_ORIGIN ?? "http://localhost:3000" }, payload: { name: "Test owner", email: "owner@example.test", password: `Test-only-${randomUUID()}` } });
  assert.equal(account.statusCode, 201);
  cookie = account.headers["set-cookie"].split(";")[0];
  const setup = await call(
    "POST",
    "/api/v1/onboarding/start",
    {
      ownerName: "Inventory verifier",
      shopName: "Inventory verification",
      subdomain: `inv-${randomUUID().slice(0, 8)}`,
      category: "fashion",
      country: "Bangladesh",
      currency: "BDT",
      language: "en",
    },
    201,
  );
  const shopId = setup.shop.id;
  const base = `/api/v1/inventory/${shopId}/products`;
  const product = {
    name: "Olive tote",
    sku: "TOTE",
    category: "Bags",
    description: "Canvas tote",
    price: 850,
    comparePrice: 900,
    cost: 300,
    images: [],
    status: "active",
    aiFacts: {
      sellingPoints: "Canvas",
      audience: "Everyday use",
      care: "Hand wash",
      policyExceptions: "",
    },
    seo: { title: "Tote", description: "" },
    delivery: { weightGrams: 250, note: "" },
    variants: [
      {
        title: "Olive",
        sku: "TOTE-OLIVE",
        size: "One size",
        color: "Olive",
        material: "Canvas",
        image: "",
        priceOverride: null,
        openingStock: 10,
        lowStockThreshold: 3,
      },
    ],
  };
  const requestId = randomUUID();
  let p = await call("POST", base, { requestId, product }, 201);
  assert.equal(p.available, 10);
  const repeated = await call("POST", base, { requestId, product }, 201);
  assert.equal(repeated.id, p.id);
  await call(
    "POST",
    base,
    { requestId, product: { ...product, name: "Different" } },
    409,
  );
  await call(
    "POST",
    base,
    { requestId: randomUUID(), product: { ...product, name: "Duplicate" } },
    409,
  );
  assert.equal(await db.collection("products").countDocuments({ shopId }), 1);
  let v = p.variants[0];
  const adjust = async (kind, quantity, status = 200) =>
    call(
      "POST",
      `${base}/${p.id}/adjustments`,
      {
        requestId: randomUUID(),
        variantId: v.id,
        version: v.version,
        kind,
        quantity,
        reason: "Verified stock operation",
      },
      status,
    );
  await adjust("correction", -11, 409);
  assert.equal(
    await db.collection("inventoryLedger").countDocuments({ shopId }),
    1,
  );
  p = await adjust("reserve", 4);
  v = p.variants[0];
  assert.equal(v.available, 6);
  assert.equal(v.reserved, 4);
  p = await adjust("sale", 2);
  v = p.variants[0];
  assert.equal(v.onHand, 8);
  assert.equal(v.sold, 2);
  p = await adjust("return", 1);
  v = p.variants[0];
  assert.equal(v.onHand, 9);
  assert.equal(v.returned, 1);
  await adjust("return", 2, 409);
  p = await adjust("release", 2);
  v = p.variants[0];
  const same = {
    requestId: randomUUID(),
    variantId: v.id,
    version: v.version,
    kind: "correction",
    quantity: -1,
    reason: "Idempotent correction",
  };
  p = await call("POST", `${base}/${p.id}/adjustments`, same);
  await call("POST", `${base}/${p.id}/adjustments`, same);
  v = p.variants[0];
  const count = await db
    .collection("inventoryLedger")
    .countDocuments({ shopId });
  const attempts = await Promise.all(
    [1, 2, 3, 4].map(() =>
      app.inject({
        headers: { cookie, origin: process.env.APP_ORIGIN ?? "http://localhost:3000" },
        method: "POST",
        url: `${base}/${p.id}/adjustments`,
        payload: { ...same, requestId: randomUUID(), version: v.version },
      }),
    ),
  );
  assert.equal(attempts.filter((r) => r.statusCode === 200).length, 1);
  assert.equal(attempts.filter((r) => r.statusCode === 409).length, 3);
  checks += 4;
  assert.equal(
    await db.collection("inventoryLedger").countDocuments({ shopId }),
    count + 1,
  );
  p = await call("GET", `${base}/${p.id}`);
  const entries = await call("GET", `${base}/${p.id}/history`);
  assert.equal(
    entries.entries.reduce((n, e) => n + e.deltaQuantity, 0),
    p.available,
  );
  const before = await db.collection("products").findOne({ _id: p.id });
  const edited = {
    ...product,
    name: "Updated tote",
    variants: [
      { ...product.variants[0], id: p.variants[0].id, openingStock: 0 },
    ],
  };
  await call(
    "PATCH",
    `${base}/${p.id}`,
    { version: p.version + 1, product: edited },
    409,
  );
  assert.equal(
    (await db.collection("products").findOne({ _id: p.id })).name,
    before.name,
  );
  p = await call("PATCH", `${base}/${p.id}`, {
    version: p.version,
    product: edited,
  });
  assert.equal(p.name, "Updated tote");
  const second = await call(
    "POST",
    base,
    {
      requestId: randomUUID(),
      product: {
        ...product,
        name: "Second",
        sku: "SECOND",
        variants: [{ ...product.variants[0], sku: "SECOND-ONE" }],
      },
    },
    201,
  );
  const bad = {
    ...edited,
    variants: [{ ...edited.variants[0], sku: "SECOND-ONE" }],
  };
  await call(
    "PATCH",
    `${base}/${p.id}`,
    { version: p.version, product: { ...bad, name: "Must roll back" } },
    409,
  );
  assert.equal(
    (await db.collection("products").findOne({ _id: p.id })).name,
    "Updated tote",
  );
  await call(
    "POST",
    base,
    { requestId: randomUUID(), product: { ...product, price: -1 } },
    400,
  );
  await call(
    "GET",
    `/api/v1/inventory/${randomUUID()}/products/${p.id}`,
    undefined,
    404,
  );
  const list = await call("GET", `${base}?q=Second&status=active`);
  assert.equal(list.total, 1);
  assert.equal(list.products[0].id, second.id);
  await call("GET", `${base}?q=%5B`);
  const legacyState = await call(
    "POST",
    `/api/v1/onboarding/${shopId}/products`,
    { name: "Legacy opening product", price: 100, stock: 6 },
    201,
  );
  const legacyId = legacyState.products.find(
    (x) => x.name === "Legacy opening product",
  ).id;
  const legacy = await call("GET", `${base}/${legacyId}`);
  assert.equal(legacy.available, 6);
  const legacyAdjusted = await call("POST", `${base}/${legacyId}/adjustments`, {
    requestId: randomUUID(),
    variantId: legacy.variants[0].id,
    version: 0,
    kind: "correction",
    quantity: -2,
    reason: "Legacy stock count",
  });
  assert.equal(legacyAdjusted.available, 4);
  const legacyHistory = await call("GET", `${base}/${legacyId}/history`);
  assert.equal(
    legacyHistory.entries.reduce((n, e) => n + e.deltaQuantity, 0),
    4,
  );
  await call(
    "POST",
    `${base}/${legacyId}/adjustments`,
    {
      requestId: randomUUID(),
      variantId: legacy.variants[0].id,
      version: 1,
      kind: "receive",
      quantity: 1,
      reason: "Invalid actor injection",
      actor: "admin",
    },
    400,
  );
  await call("POST", `/api/v1/onboarding/${shopId}/launch`);
  const publicStore = await call(
    "GET",
    `/api/v1/storefront/${setup.shop.subdomain}`,
  );
  assert.equal(
    publicStore.products.find((x) => x.id === p.id).stock,
    p.available,
  );
  assert.equal(
    publicStore.products.find((x) => x.id === p.id).slug,
    "olive-tote",
  );
  await call(
    "GET",
    `/api/v1/storefront/${setup.shop.subdomain}/products/olive-tote`,
  );
  p = await call("PATCH", `${base}/${p.id}`, {
    version: p.version,
    product: { ...edited, status: "archived" },
  });
  const after = await call("GET", `/api/v1/storefront/${setup.shop.subdomain}`);
  assert.ok(!after.products.some((x) => x.id === p.id));
  const { config } = await import("../dist/shared/config.js");
  const originalMode = config.nodeEnv;
  config.nodeEnv = "production";
  await call("GET", base);
  cookie = "";
  await call("POST", base, { requestId: randomUUID(), product }, 401);
  config.nodeEnv = originalMode;
  console.log(
    `Inventory Atlas verification passed: ${checks} API checks, transactional rollback, concurrency, idempotency, ledger consistency and storefront compatibility.`,
  );
} finally {
  await app?.close();
  if (
    db &&
    db.databaseName === name &&
    name.startsWith("easy_shop_inventory_test_")
  ) {
    await db.dropDatabase();
    console.log("Isolated inventory test database removed.");
  }
  await closeDb();
}
