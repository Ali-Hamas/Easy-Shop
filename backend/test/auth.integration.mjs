import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { loadEnvFile } from "../dist/shared/load-env.js";
loadEnvFile(process.env.BACKEND_ENV_FILE ?? ".env");
assert.ok(
  process.env.MONGODB_URI?.startsWith("mongodb+srv://"),
  "Real Atlas is required",
);
const databaseName = `easy_shop_auth_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
process.env.MONGODB_DB_NAME = databaseName;
process.env.LOG_LEVEL = "silent";
const { buildApp } = await import("../dist/app.js");
const { connectDb, closeDb } = await import("../dist/shared/db.js");
const { ensureIndexes } = await import("../dist/shared/models.js");
const { config } = await import("../dist/shared/config.js");
let db,
  app,
  checks = 0;
const password = `Test-only-${randomUUID()}`;
async function call(
  method,
  url,
  payload,
  cookie = "",
  status = 200,
  origin = config.appOrigin,
) {
  const response = await app.inject({
    method,
    url: `/api/v1/${url}`,
    payload,
    headers: { cookie, origin },
  });
  assert.equal(
    response.statusCode,
    status,
    `${method} ${url} returned unexpected status ${response.statusCode}`,
  );
  assert.ok(!response.body.includes(password), "Password not returned");
  assert.ok(!response.body.includes("passwordHash"), "Hash not returned");
  checks++;
  return response;
}
try {
  db = await connectDb();
  await ensureIndexes(db);
  app = await buildApp();
  await call("GET", "onboarding/templates", undefined, "", 401);
  await call(
    "POST",
    "auth/register",
    { name: "Test owner", email: "owner@example.test", password },
    "",
    403,
    "https://other.example",
  );
  await call(
    "POST",
    "auth/register",
    { name: "Test owner", email: "owner@example.test", password: "short" },
    "",
    400,
  );
  const registration = await call(
    "POST",
    "auth/register",
    { name: "Test owner", email: "owner@example.test", password },
    "",
    201,
  );
  assert.match(registration.headers["set-cookie"], /HttpOnly/);
  assert.match(registration.headers["set-cookie"], /SameSite=Lax/);
  const cookie = registration.headers["set-cookie"].split(";")[0];
  const stored = await db
    .collection("users")
    .findOne({ email: "owner@example.test" });
  assert.match(stored.passwordHash, /^scrypt\$/);
  assert.ok(!stored.passwordHash.includes(password));
  assert.equal(
    await db
      .collection("authSessions")
      .countDocuments({ _id: cookie.split("=")[1] }),
    0,
    "Raw token not stored",
  );
  await call(
    "POST",
    "auth/register",
    { name: "Test owner", email: "owner@example.test", password },
    "",
    409,
  );
  await call(
    "POST",
    "auth/login",
    { email: "owner@example.test", password: "incorrect-password" },
    "",
    401,
  );
  await call(
    "POST",
    "auth/login",
    { email: "unknown@example.test", password: "incorrect-password" },
    "",
    401,
  );
  const setup = (
    await call(
      "POST",
      "onboarding/start",
      {
        ownerName: "Ignored identity",
        email: "someone-else@example.test",
        shopName: "Auth test shop",
        subdomain: `auth-${randomUUID().slice(0, 8)}`,
        category: "Fashion",
        country: "Bangladesh",
        currency: "BDT",
        language: "en",
      },
      cookie,
      201,
    )
  ).json();
  assert.equal(setup.owner.id, stored._id);
  assert.equal(setup.owner.name, "Test owner");
  const me = (await call("GET", "auth/me", undefined, cookie)).json();
  assert.equal(me.shops[0].id, setup.shop.id);
  const second = await call(
    "POST",
    "auth/register",
    { name: "Other owner", email: "other@example.test", password },
    "",
    201,
  );
  const otherCookie = second.headers["set-cookie"].split(";")[0];
  for (const path of [
    `onboarding/${setup.shop.id}`,
    `inventory/${setup.shop.id}/products`,
    `customers/${setup.shop.id}`,
    `inbox/${setup.shop.id}/conversations`,
  ])
    await call("GET", path, undefined, otherCookie, 404);
  await call(
    "POST",
    `onboarding/${setup.shop.id}/launch`,
    {},
    otherCookie,
    404,
  );
  const login = await call(
    "POST",
    "auth/login",
    { email: "OWNER@example.test", password },
    cookie,
  );
  const newCookie = login.headers["set-cookie"].split(";")[0];
  assert.notEqual(newCookie, cookie);
  await call("GET", "auth/me", undefined, cookie, 401);
  await call("GET", "auth/me", undefined, newCookie);
  await call("POST", "auth/logout", {}, newCookie);
  await call("GET", "auth/me", undefined, newCookie, 401);
  const hash = createHash("sha256")
    .update(otherCookie.split("=")[1])
    .digest("hex");
  await db
    .collection("authSessions")
    .updateOne({ _id: hash }, { $set: { expiresAt: new Date(0) } });
  await call("GET", "auth/me", undefined, otherCookie, 401);
  console.log(
    `Atlas authentication: ${checks} API checks passed; hashing, cookies, ownership, rotation, expiry and logout verified.`,
  );
} finally {
  if (db?.databaseName === databaseName) {
    await db.dropDatabase();
    console.log("Isolated auth test database removed.");
  }
  await app?.close();
  await closeDb();
}
