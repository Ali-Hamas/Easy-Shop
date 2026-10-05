import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "../dist/shared/load-env.js";
loadEnvFile(".env");
if (!process.env.MONGODB_URI?.startsWith("mongodb+srv://"))
  throw Error("Real Atlas connection required.");
const name = `easy_shop_crm_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
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
  assert.equal(
    r.statusCode,
    status,
    `${method} unexpected status ${r.statusCode}: ${r.body}`,
  );
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
      ownerName: "CRM verifier",
      shopName: "CRM test",
      subdomain: `crm-${randomUUID().slice(0, 8)}`,
      category: "Home",
      country: "Bangladesh",
      currency: "BDT",
      language: "en",
    },
    201,
  );
  const base = `/api/v1/customers/${setup.shop.id}`;
  const customer = {
    name: "Nadia Ahmed",
    phone: "+880 1700-123456",
    email: "NADIA@example.test",
    addresses: [
      {
        label: "Home",
        line: "12 Garden Road",
        city: "Dhaka",
        region: "Dhaka",
        postalCode: "1205",
        country: "Bangladesh",
      },
    ],
    language: "bn",
    tags: ["VIP", "vip"],
    source: "instagram",
    status: "active",
  };
  assert.equal((await call("GET", base)).total, 0);
  const requestId = randomUUID();
  let c = await call("POST", base, { requestId, customer }, 201);
  assert.equal(c.phone, "+8801700123456");
  assert.deepEqual(c.tags, ["vip"]);
  assert.equal(c.email, "nadia@example.test");
  assert.equal(c.orderSummary, null);
  assert.equal(c.riskContext, null);
  assert.ok(!("fingerprint" in c));
  assert.equal(
    (await call("POST", base, { requestId, customer }, 201)).id,
    c.id,
  );
  await call(
    "POST",
    base,
    { requestId, customer: { ...customer, name: "Other" } },
    409,
  );
  const count = await db.collection("customerEvents").countDocuments();
  await call("POST", base, { requestId: randomUUID(), customer }, 409);
  assert.equal(await db.collection("customerEvents").countDocuments(), count);
  await call(
    "POST",
    base,
    { requestId: randomUUID(), customer: { ...customer, email: "invalid" } },
    400,
  );
  await call(
    "POST",
    base,
    { requestId: randomUUID(), customer: { ...customer, author: "admin" } },
    400,
  );
  await call(
    "POST",
    base,
    { requestId: randomUUID(), customer: { ...customer, phone: "123" } },
    400,
  );
  await call(
    "POST",
    base,
    {
      requestId: randomUUID(),
      customer: { ...customer, phone: "", tags: Array(21).fill("vip") },
    },
    400,
  );
  assert.equal(
    (
      await call(
        "GET",
        `${base}?q=nadia&tag=VIP&source=instagram&status=active`,
      )
    ).total,
    1,
  );
  assert.equal((await call("GET", `${base}?q=%5B.*`)).total, 0);
  assert.equal((await call("GET", `${base}/${c.id}`)).id, c.id);
  await call("GET", `${base}/${randomUUID()}`, undefined, 404);
  const other = await call(
    "POST",
    "/api/v1/onboarding/start",
    {
      ownerName: "Other verifier",
      shopName: "Other shop",
      subdomain: `crm-${randomUUID().slice(0, 8)}`,
      category: "Home",
      country: "Bangladesh",
      currency: "BDT",
      language: "en",
    },
    201,
  );
  const otherBase = `/api/v1/customers/${other.shop.id}`;
  await call("GET", `${otherBase}/${c.id}`, undefined, 404);
  await call("GET", `${otherBase}/${c.id}/history`, undefined, 404);
  await call("PATCH", `${otherBase}/${c.id}`, { version: 1, customer }, 404);
  await call(
    "POST",
    `${otherBase}/${c.id}/notes`,
    { requestId: randomUUID(), text: "Wrong shop" },
    404,
  );
  await call("POST", otherBase, { requestId: randomUUID(), customer }, 201);
  const variants = [0, 1, 2, 3].map((i) => ({
    ...customer,
    name: `Nadia ${i}`,
    tags: ["repeat customer"],
    status: "inactive",
  }));
  const concurrent = await Promise.all(
    variants.map((input) =>
      app.inject({
        headers: { cookie, origin: process.env.APP_ORIGIN ?? "http://localhost:3000" },
        method: "PATCH",
        url: `${base}/${c.id}`,
        payload: { version: 1, customer: input },
      }),
    ),
  );
  assert.equal(concurrent.filter((r) => r.statusCode === 200).length, 1);
  assert.equal(concurrent.filter((r) => r.statusCode === 409).length, 3);
  checks += 4;
  c = await call("GET", `${base}/${c.id}`);
  assert.equal(c.version, 2);
  assert.equal(c.status, "inactive");
  const noteId = randomUUID();
  const notes = await Promise.all(
    Array.from({ length: 3 }, () =>
      call(
        "POST",
        `${base}/${c.id}/notes`,
        {
          requestId: noteId,
          text: "Prefers earthy colours. Ask about sizing.",
        },
        201,
      ),
    ),
  );
  assert.equal(new Set(notes.map((n) => n.id)).size, 1);
  await call(
    "POST",
    `${base}/${c.id}/notes`,
    { requestId: noteId, text: "Different" },
    409,
  );
  await call(
    "POST",
    `${base}/${c.id}/notes`,
    { requestId: randomUUID(), text: "" },
    400,
  );
  await call(
    "POST",
    `${base}/${c.id}/notes`,
    { requestId: randomUUID(), text: "Note", author: "forged" },
    400,
  );
  const timeline = await call("GET", `${base}/${c.id}/history`);
  assert.equal(timeline.total, 3);
  assert.deepEqual(
    new Set(timeline.entries.map((e) => e.type)),
    new Set(["customer_created", "customer_updated", "note"]),
  );
  assert.ok(timeline.entries.every((e) => e.author === account.json().user.id));
  assert.equal((await call("GET", `${base}/${c.id}`)).version, 2);
  assert.equal((await call("GET", `${base}?status=inactive`)).total, 1);
  const partial = {
    ...customer,
    name: "Partial contact",
    phone: "",
    email: "",
    addresses: [],
    tags: [],
  };
  await call("POST", base, { requestId: randomUUID(), customer: partial }, 201);
  await call(
    "POST",
    base,
    {
      requestId: randomUUID(),
      customer: { ...partial, name: "Second partial" },
    },
    201,
  );
  assert.equal(
    (await call("GET", `${base}?limit=1&page=2`)).customers.length,
    1,
  );
  const indexes = await db.collection("customers").indexes();
  assert.ok(indexes.some((i) => i.unique && i.key.phoneKey));
  assert.ok(indexes.some((i) => i.key.tags));
  assert.equal(
    await db
      .collection("customerEvents")
      .countDocuments({ shopId: setup.shop.id }),
    await db
      .collection("auditEvents")
      .countDocuments({ shopId: setup.shop.id, entityType: "customer" }),
  );
  const { config } = await import("../dist/shared/config.js");
  const previous = config.nodeEnv;
  config.nodeEnv = "production";
  await call("GET", base);
  cookie = "";
  await call("POST", base, { requestId: randomUUID(), customer }, 401);
  config.nodeEnv = previous;
  console.log(
    `Customer Atlas verification passed: ${checks} API checks, scoped indexes, validation, duplicate rollback, optimistic concurrency, note idempotency and timeline/audit consistency.`,
  );
} finally {
  await app?.close();
  if (
    db &&
    db.databaseName === name &&
    name.startsWith("easy_shop_crm_test_")
  ) {
    await db.dropDatabase();
    console.log("Isolated Customer test database removed.");
  }
  await closeDb();
}
