import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "../dist/shared/load-env.js";
loadEnvFile(process.env.BACKEND_ENV_FILE ?? ".env");
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI required: database tests must not silently skip.");
  process.exit(1);
}
const testDb = `easy_shop_test_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
process.env.MONGODB_DB_NAME = testDb;
process.env.LOG_LEVEL = "silent";
const { buildApp } = await import("../dist/app.js");
const { connectDb, closeDb } = await import("../dist/shared/db.js");
const { ensureIndexes, collections, money, amount } =
  await import("../dist/shared/models.js");
assert.equal(amount(money(10.075)), 10.08);
assert.equal(amount(money(1.005)), 1.01);
assert.equal(amount(money(1e-7)), 0);
let cookie = "";
let app, db, httpBase;
let checks = 0;
async function request(method, url, payload) {
  if (process.env.VERIFY_HTTP !== "1")
    return app.inject({ method, url, payload, headers: { cookie, origin: process.env.APP_ORIGIN ?? "http://localhost:3000" } });
  const response = await fetch(`${httpBase}${url}`, {
    method,
    headers: { cookie, origin: process.env.APP_ORIGIN ?? "http://localhost:3000", ...(payload === undefined ? {} : { "content-type": "application/json" }) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = await response.text();
  return { statusCode: response.status, body, json: () => JSON.parse(body) };
}
async function call(method, url, payload, expected = 200) {
  const r = await request(method, url, payload);
  assert.equal(
    r.statusCode,
    expected,
    `${method} ${url}: expected ${expected}, got ${r.statusCode}`,
  );
  checks++;
  return r.json();
}
try {
  db = await connectDb();
  await ensureIndexes(db);
  await ensureIndexes(db);
  app = await buildApp();
  const account = await app.inject({ method: "POST", url: "/api/v1/auth/register", headers: { origin: process.env.APP_ORIGIN ?? "http://localhost:3000" }, payload: { name: "Test owner", email: "owner@example.test", password: `Test-only-${randomUUID()}` } });
  assert.equal(account.statusCode, 201);
  cookie = account.headers["set-cookie"].split(";")[0];
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  assert.ok(address && typeof address !== "string");
  httpBase = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${httpBase}/api/v1/health`)).status, 200);
  assert.deepEqual(await call("GET", "/api/v1/health"), { status: "ok" });
  await call("GET", "/api/v1/health/ready");
  await call("GET", "/api/v1/system/modules");
  const templates = await call("GET", "/api/v1/onboarding/templates");
  assert.equal(templates.templates.length, 2);
  const base = {
    ownerName: "Migration Test",
    language: "en",
    shopName: "Migration Store",
    category: "fashion",
    country: "Bangladesh",
    currency: "BDT",
  };
  let state = await call(
    "POST",
    "/api/v1/onboarding/start",
    { ...base, subdomain: "migration-store", email: "migration@example.test" },
    201,
  );
  const id = state.shop.id,
    prefix = `/api/v1/onboarding/${id}`;
  assert.match(id, /^[a-f0-9-]{36}$/);
  assert.equal(state.shop.aiMode, "suggest");
  assert.equal(state.shop.status, "draft");
  await call("GET", prefix);
  await call("GET", "/api/v1/storefront/migration-store", undefined, 404);
  await call("POST", `${prefix}/launch`, undefined, 409);
  const taken = await call("POST", "/api/v1/onboarding/subdomain/check", {
    subdomain: "Migration Store",
  });
  assert.equal(taken.available, false);
  assert.ok(taken.suggestions.length);
  const duplicate = await call(
    "POST",
    "/api/v1/onboarding/start",
    { ...base, subdomain: "migration-store" },
    409,
  );
  assert.equal(duplicate.code, "SUBDOMAIN_TAKEN");
  state = await call("PATCH", `${prefix}/shop`, {
    displayName: "Updated Store",
    policyDefaults: { deliveryCharge: 80 },
  });
  assert.equal(state.shop.displayName, "Updated Store");
  assert.equal(state.shop.policyDefaults.codAllowed, true);
  await call(
    "POST",
    `${prefix}/products`,
    { name: "Black Panjabi", price: 1200, stock: 10 },
    201,
  );
  await call(
    "POST",
    `${prefix}/products`,
    { name: "Black Panjabi", price: 1200, stock: 10 },
    409,
  );
  await call(
    "POST",
    `${prefix}/products`,
    { name: "Invalid", price: -1, stock: 0 },
    400,
  );
  await call("POST", `${prefix}/channels/meta/skip`);
  state = await call("POST", `${prefix}/channels/meta/skip`);
  assert.equal(state.channels.length, 1);
  state = await call("PATCH", `${prefix}/ai-mode`, { aiMode: "off" });
  assert.equal(state.shop.aiMode, "off");
  await call("PATCH", `${prefix}/ai-mode`, { aiMode: "invented" }, 400);
  await call("POST", `${prefix}/template`, { templateId: "missing" }, 404);
  state = await call("POST", `${prefix}/template`, {
    templateId: templates.templates[0].id,
  });
  assert.equal(state.launchChecklist.hasTemplate, true);
  state = await call("POST", `${prefix}/launch`);
  assert.equal(state.shop.status, "launched");
  const front = await call("GET", "/api/v1/storefront/migration-store");
  assert.equal(
    (await fetch(`${httpBase}/api/v1/storefront/migration-store`)).status,
    200,
  );
  assert.equal(front.products.length, 1);
  assert.equal(front.products[0].stock, 10);
  assert.equal(front.products[0].price, 1200);
  const detail = await call(
    "GET",
    "/api/v1/storefront/migration-store/products/black-panjabi",
  );
  assert.equal(detail.product.variants[0].stock, 10);
  assert.equal(detail.product.price, 1200);
  assert.ok(!JSON.stringify(front).includes("migration@example.test"));
  assert.ok(!JSON.stringify(front).includes('"_id"'));
  await call("PATCH", `${prefix}/shop`, { displayName: "Locked" }, 409);
  await call(
    "POST",
    `${prefix}/products`,
    { name: "Locked", price: 10, stock: 1 },
    409,
  );
  await call(
    "POST",
    `${prefix}/template`,
    { templateId: templates.templates[0].id },
    409,
  );
  await call("GET", "/api/v1/onboarding/not-a-uuid", undefined, 400);
  await call("GET", `/api/v1/onboarding/${randomUUID()}`, undefined, 404);
  await call("GET", "/api/v1/storefront/missing", undefined, 404);
  await call(
    "GET",
    "/api/v1/storefront/migration-store/products/missing",
    undefined,
    404,
  );
  const second = await call(
    "POST",
    "/api/v1/onboarding/start",
    { ...base, subdomain: "second-store" },
    201,
  );
  await call(
    "PATCH",
    `/api/v1/onboarding/${second.shop.id}/shop`,
    { subdomain: "migration-store" },
    409,
  );
  await call("POST", `/api/v1/onboarding/${second.shop.id}/template`, {
    templateId: templates.templates[0].id,
  });
  await call("POST", `/api/v1/onboarding/${second.shop.id}/launch`);
  assert.equal(
    (await call("GET", "/api/v1/storefront/second-store")).products.length,
    0,
  );
  const concurrent = await Promise.all(
    [1, 2].map(() =>
      request("POST", "/api/v1/onboarding/start", {
        ...base,
        subdomain: "concurrent-store",
      }),
    ),
  );
  assert.deepEqual(concurrent.map((r) => r.statusCode).sort(), [201, 409]);
  const c = collections(db);
  assert.equal(
    await c.shops.countDocuments({ subdomain: "concurrent-store" }),
    1,
  );
  assert.equal(await c.users.countDocuments(), 1, "Shops belong to the signed-in owner; onboarding creates no unauthenticated users.");
  assert.equal(await c.products.countDocuments({ shopId: id }), 1);
  assert.equal(await c.variants.countDocuments({ shopId: id }), 1);
  assert.equal(await c.ledger.countDocuments({ shopId: id }), 1);
  await closeDb();
  db = await connectDb();
  assert.equal((await call("GET", prefix)).shop.status, "launched");
  console.log(
    `PASS: ${checks} API checks, unique-index race, rollback, reconnect and isolation assertions.`,
  );
} catch (error) {
  console.error(
    JSON.stringify({
      completedApiChecks: checks,
      errorType: error.name,
      code: typeof error.code === "number" ? error.code : undefined,
      codeName: typeof error.codeName === "string" ? error.codeName : undefined,
    }),
  );
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "MongoDB integration could not complete. Check Atlas access and server-side configuration; connection details suppressed.",
  );
  process.exitCode = 1;
} finally {
  await app?.close();
  if (db) {
    assert.match(testDb, /^easy_shop_test_[a-f0-9]{20}$/);
    assert.equal(db.databaseName, testDb);
    await db.dropDatabase().catch(() => {
      console.error("Test database cleanup failed.");
      process.exitCode = 1;
    });
  }
  await closeDb();
}
