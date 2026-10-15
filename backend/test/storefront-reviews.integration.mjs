import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { loadEnvFile } from "../dist/shared/load-env.js";
loadEnvFile(".env");
if (!process.env.MONGODB_URI?.startsWith("mongodb+srv://"))
  throw Error("Atlas SRV URI required for this verification.");
const database = `easy_shop_orders_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
process.env.MONGODB_DB_NAME = database;
process.env.LOG_LEVEL = "silent";
const { buildApp } = await import("../dist/app.js");
const { connectDb, closeDb } = await import("../dist/shared/db.js");
const { ensureIndexes } = await import("../dist/shared/models.js");
const { config } = await import("../dist/shared/config.js");
let db,
  app,
  count = 0;
try {
  db = await connectDb();
  await ensureIndexes(db);
  app = await buildApp();
  async function call(method, path, payload, cookie = "", status = 200) {
    const r = await app.inject({
      method,
      url: "/api/v1/" + path,
      payload,
      headers: { origin: config.appOrigin, cookie },
    });
    assert.equal(
      r.statusCode,
      status,
      `${method} ${path}: ${r.statusCode} ${r.json().code ?? ""}`,
    );
    count++;
    return r;
  }
  const owner = (
    await call(
      "POST",
      "auth/register",
      {
        name: "Owner",
        email: "owner@example.test",
        password: "Testing-Order-Only-123",
      },
      "",
      201,
    )
  ).headers["set-cookie"].split(";")[0];
  const other = (
    await call(
      "POST",
      "auth/register",
      {
        name: "Other",
        email: "other@example.test",
        password: "Testing-Order-Only-123",
      },
      "",
      201,
    )
  ).headers["set-cookie"].split(";")[0];
  const state = (
    await call(
      "POST",
      "onboarding/start",
      {
        ownerName: "Owner",
        shopName: "Order studio",
        subdomain: "order-studio",
        category: "Bags",
        country: "Bangladesh",
        currency: "BDT",
        language: "en",
      },
      owner,
      201,
    )
  ).json();
  const shopId = state.shop.id;
  const p = (
    await call(
      "POST",
      `onboarding/${shopId}/products`,
      { name: "Canvas bag", price: 850, stock: 2 },
      owner,
      201,
    )
  ).json().products[0];
  await call(
    "POST",
    `onboarding/${shopId}/channels/meta/skip`,
    undefined,
    owner,
  );
  await call(
    "PATCH",
    `onboarding/${shopId}/ai-mode`,
    { aiMode: "suggest" },
    owner,
  );
  await call(
    "POST",
    `onboarding/${shopId}/template`,
    { templateId: state.templates[0].id },
    owner,
  );
  await call("POST", `onboarding/${shopId}/launch`, undefined, owner);
  const catalog = (await call("GET", "storefront/order-studio")).json(),
    variant = catalog.products[0].variants[0];
  const receiptKey = randomBytes(32).toString("hex"),
    phone = "+8801700000000";
  const input = {
    requestId: randomUUID(),
    receiptKey,
    buyer: {
      name: "Guest buyer",
      phone,
      city: "Dhaka",
      address: "Testing only, street 12",
    },
    items: [{ productId: p.id, variantId: variant.id, quantity: 2 }],
    expectedTotal: 1700 + catalog.shop.policyDefaults.deliveryCharge,
  };
  await call(
    "POST",
    "storefront/order-studio/checkout",
    { ...input, expectedTotal: 1 },
    "",
    409,
  );
  const placed = (
    await call("POST", "storefront/order-studio/checkout", input, "", 201)
  ).json().order;
  const id = placed.id;
  assert.equal(placed.status, "new");
  assert.equal(placed.receiptHash, undefined);
  assert.equal(
    (
      await call("POST", "storefront/order-studio/checkout", input, "", 201)
    ).json().order.id,
    id,
  );
  assert.equal(await db.collection("orders").countDocuments({ shopId }), 1);
  await call(
    "POST",
    "storefront/order-studio/checkout",
    { ...input, requestId: randomUUID() },
    "",
    409,
  );
  await call("GET", `orders/${shopId}`, undefined, "", 401);
  await call("GET", `orders/${shopId}`, undefined, other, 404);
  await call(
    "PATCH",
    `orders/${shopId}/${id}`,
    { version: 0, status: "delivered" },
    owner,
    409,
  );
  const review = {
    orderId: id,
    phone,
    receiptKey,
    name: "Guest buyer",
    rating: 5,
    text: "The bag arrived and the seller was helpful.",
  };
  await call("POST", "storefront/order-studio/reviews", review, "", 403);
  await call(
    "PATCH",
    `orders/${shopId}/${id}`,
    { version: 0, status: "confirmed" },
    owner,
  );
  assert.equal(
    (await call("GET", "storefront/order-studio")).json().products[0].stock,
    0,
  );
  await call(
    "POST",
    "storefront/order-studio/checkout",
    {
      ...input,
      requestId: randomUUID(),
      buyer: { ...input.buyer, phone: "+8801700000001" },
    },
    "",
    409,
  );
  await call(
    "PATCH",
    `orders/${shopId}/${id}`,
    { version: 0, status: "packed" },
    owner,
    409,
  );
  await call(
    "PATCH",
    `orders/${shopId}/${id}`,
    { version: 1, status: "packed" },
    owner,
  );
  await call(
    "PATCH",
    `orders/${shopId}/${id}`,
    { version: 2, status: "shipped" },
    owner,
  );
  await call(
    "PATCH",
    `orders/${shopId}/${id}`,
    { version: 3, status: "delivered" },
    owner,
  );
  const bal = await db
    .collection("inventoryBalances")
    .findOne({ _id: variant.id });
  assert.equal(bal.onHand, 0);
  assert.equal(bal.reserved, 0);
  assert.equal(bal.sold, 2);
  await call(
    "POST",
    "storefront/order-studio/orders/track",
    { orderId: id, phone: "+8801700000099" },
    "",
    404,
  );
  const tracked = (
    await call("POST", "storefront/order-studio/orders/track", {
      orderId: id,
      phone,
    })
  ).json().order;
  assert.equal(tracked.status, "delivered");
  assert.equal(tracked.buyer, undefined);
  assert.equal(tracked.receiptHash, undefined);
  await call(
    "POST",
    "storefront/order-studio/reviews",
    { ...review, receiptKey: "0".repeat(64) },
    "",
    403,
  );
  await call(
    "POST",
    "storefront/order-studio/reviews",
    { ...review, productId: randomUUID() },
    "",
    403,
  );
  const storeReview = (
    await call("POST", "storefront/order-studio/reviews", review)
  ).json().review;
  assert.equal(storeReview.purchaseVerified, true);
  await call("POST", "storefront/order-studio/reviews", review);
  await call(
    "POST",
    "storefront/order-studio/reviews",
    { ...review, rating: 1 },
    "",
    409,
  );
  await call("POST", "storefront/order-studio/reviews", {
    ...review,
    productId: p.id,
  });
  assert.equal(
    (await call("GET", "storefront/order-studio/reviews")).json().count,
    1,
  );
  assert.equal(
    (
      await call("GET", `storefront/order-studio/reviews?productId=${p.id}`)
    ).json().count,
    1,
  );
  await call(
    "PATCH",
    `reviews/${shopId}/${storeReview.id}/reply`,
    { text: "Thank you for sharing your experience." },
    other,
    404,
  );
  await call(
    "PATCH",
    `reviews/${shopId}/${storeReview.id}/reply`,
    { text: "Thank you for sharing your experience." },
    owner,
  );
  const pub = (await call("GET", "storefront/order-studio/reviews")).json()
    .reviews[0];
  assert.ok(pub.reply.text);
  assert.equal(pub.orderId, undefined);
  assert.equal(pub.receiptKey, undefined);
  assert.equal(
    (await call("GET", `reviews/${shopId}`, undefined, owner)).json().reviews
      .length,
    2,
  );
  // Stock changes only on seller confirmation; overlapping requests must never
  // reserve twice or leave a partial reservation after one line fails.
  async function createProduct(name, openingStock) {
    return (
      await call(
        "POST",
        `inventory/${shopId}/products`,
        {
          requestId: randomUUID(),
          product: {
            name,
            sku: name.toUpperCase().replaceAll(" ", "-"),
            price: 100,
            status: "active",
            variants: [{ title: "Default", sku: randomUUID(), openingStock }],
            aiFacts: {
              sellingPoints: "",
              audience: "",
              care: "",
              policyExceptions: "",
            },
            seo: { title: "", description: "" },
            delivery: { weightGrams: null, note: "" },
          },
        },
        owner,
        201,
      )
    ).json();
  }
  const raceProduct = await createProduct("Concurrency fixture", 3);
  const scarceProduct = await createProduct("Rollback fixture", 1);
  let phoneSuffix = 10;
  const makeOrderInput = (lines) => ({
    requestId: randomUUID(),
    receiptKey: randomBytes(32).toString("hex"),
    buyer: {
      ...input.buyer,
      phone: `+88017000000${phoneSuffix++}`,
    },
    items: lines.map(([product, quantity]) => ({
      productId: product.id,
      variantId: product.variants[0].id,
      quantity,
    })),
    expectedTotal:
      lines.reduce(
        (sum, [product, quantity]) => sum + product.price * quantity,
        0,
      ) + catalog.shop.policyDefaults.deliveryCharge,
  });
  const place = async (data) =>
    (
      await call("POST", "storefront/order-studio/checkout", data, "", 201)
    ).json().order;
  const transition = (orderId, version, status, expected = 200) =>
    call(
      "PATCH",
      `orders/${shopId}/${orderId}`,
      { version, status },
      owner,
      expected,
    );
  async function raceTransitions(orderId, transitions) {
    const results = await Promise.all(
      transitions.map(({ id: targetId = orderId, version, status }) =>
        app.inject({
          method: "PATCH",
          url: `/api/v1/orders/${shopId}/${targetId}`,
          payload: { version, status },
          headers: { origin: config.appOrigin, cookie: owner },
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    count += results.length;
    return results;
  }
  async function assertAvailable(product, expected) {
    const catalog = (await call("GET", "storefront/order-studio")).json();
    const productView = catalog.products.find((p) => p.id === product.id);
    assert.equal(productView.stock, expected);
    assert.equal(productView.variants[0].stock, expected);
    const detail = (
      await call("GET", `storefront/order-studio/products/${product.slug}`)
    ).json().product;
    assert.equal(detail.variants[0].stock, expected);
  }

  // Same idempotency key, simultaneously: one persisted order and one response ID.
  const simultaneousInput = makeOrderInput([[raceProduct, 2]]);
  const simultaneous = await Promise.all([
    place(simultaneousInput),
    place(simultaneousInput),
  ]);
  assert.equal(simultaneous[0].id, simultaneous[1].id);
  assert.equal(
    await db
      .collection("orders")
      .countDocuments({ shopId, requestId: simultaneousInput.requestId }),
    1,
  );
  const first = simultaneous[0];
  const second = await place(makeOrderInput([[raceProduct, 2]]));

  // Two orders compete for three units. Exactly one reservation can succeed.
  const confirmations = await raceTransitions(first.id, [
    { version: 0, status: "confirmed" },
    { id: second.id, version: 0, status: "confirmed" },
  ]);
  const winner = confirmations[0].statusCode === 200 ? first : second;
  const loser = winner.id === first.id ? second : first;
  assert.equal(
    confirmations.find((r) => r.statusCode === 409).json().code,
    "INVALID_STOCK",
  );
  let balance = await db
    .collection("inventoryBalances")
    .findOne({ _id: raceProduct.variants[0].id });
  assert.equal(balance.onHand, 3);
  assert.equal(balance.reserved, 2);
  await assertAvailable(raceProduct, 1);

  // Concurrent cancellation releases exactly once; a stale retry is harmless.
  await raceTransitions(winner.id, [
    { version: 1, status: "cancelled" },
    { version: 1, status: "cancelled" },
  ]);
  await transition(winner.id, 1, "cancelled", 409);
  assert.equal(
    await db.collection("inventoryLedger").countDocuments({
      shopId,
      requestId: `${winner.id}:${raceProduct.variants[0].id}:release`,
    }),
    1,
  );
  await assertAvailable(raceProduct, 3);
  await transition(loser.id, 0, "confirmed");
  await transition(loser.id, 1, "cancelled");

  // A simultaneous confirm/cancel operates on one version and leaves balanced stock.
  const conflicted = await place(makeOrderInput([[raceProduct, 1]]));
  await raceTransitions(conflicted.id, [
    { version: 0, status: "confirmed" },
    { version: 0, status: "cancelled" },
  ]);
  const afterRace = await db
    .collection("orders")
    .findOne({ _id: conflicted.id });
  assert.equal(afterRace.version, 1);
  if (afterRace.status === "confirmed")
    await transition(conflicted.id, 1, "cancelled");
  else assert.equal(afterRace.status, "cancelled");
  await assertAvailable(raceProduct, 3);

  // Second item becomes unavailable after checkout: roll back first item's write too.
  const twoItems = await place(
    makeOrderInput([
      [raceProduct, 1],
      [scarceProduct, 1],
    ]),
  );
  const onlyScarce = await place(makeOrderInput([[scarceProduct, 1]]));
  await transition(onlyScarce.id, 0, "confirmed");
  await transition(twoItems.id, 0, "confirmed", 409);
  const unchanged = await db.collection("orders").findOne({ _id: twoItems.id });
  assert.equal(unchanged.status, "new");
  assert.equal(unchanged.version, 0);
  balance = await db
    .collection("inventoryBalances")
    .findOne({ _id: raceProduct.variants[0].id });
  assert.equal(balance.reserved, 0);
  assert.equal(
    await db.collection("inventoryLedger").countDocuments({
      shopId,
      requestId: `${twoItems.id}:${raceProduct.variants[0].id}:reserve`,
    }),
    0,
  );
  await transition(onlyScarce.id, 1, "cancelled");
  await transition(twoItems.id, 0, "cancelled");
  await assertAvailable(scarceProduct, 1);
  await assertAvailable(raceProduct, 3);

  console.log(
    `PASS ${count} real Atlas checks: guest orders, stock, transitions, tracking privacy, verified product/store reviews, isolation and seller replies.`,
  );
} finally {
  await app?.close();
  if (db?.databaseName === database) {
    await db.dropDatabase();
    console.log("Removed isolated guest commerce database.");
  }
  await closeDb();
}
