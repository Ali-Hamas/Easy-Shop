import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "../dist/shared/load-env.js";
loadEnvFile(".env");
assert.ok(process.env.MONGODB_URI?.startsWith("mongodb+srv://"));
const name = `easy_shop_web_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
process.env.MONGODB_DB_NAME = name;
process.env.LOG_LEVEL = "silent";
const { buildApp } = await import("../dist/app.js");
const { connectDb, closeDb } = await import("../dist/shared/db.js");
const { ensureIndexes } = await import("../dist/shared/models.js");
const { config } = await import("../dist/shared/config.js");
let db,
  app,
  checks = 0;
async function call(method, path, payload, cookie = "", status = 200) {
  const r = await app.inject({
    method,
    url: "/api/v1/" + path,
    payload,
    headers: { origin: config.appOrigin, cookie },
  });
  assert.equal(r.statusCode, status, `${method} ${path}: ${r.statusCode}`);
  checks++;
  return r;
}
try {
  db = await connectDb();
  await ensureIndexes(db);
  app = await buildApp();
  const register = async (email) =>
    (
      await call(
        "POST",
        "auth/register",
        {
          name: "Content tester",
          email,
          password: "Isolated-Test-Password-123",
        },
        "",
        201,
      )
    ).headers["set-cookie"].split(";")[0];
  const owner = await register("owner@example.test"),
    other = await register("other@example.test");
  const state = (
    await call(
      "POST",
      "onboarding/start",
      {
        ownerName: "Content tester",
        shopName: "Content Studio",
        subdomain: "content-studio",
        category: "Accessories",
        country: "Bangladesh",
        currency: "BDT",
        language: "en",
      },
      owner,
      201,
    )
  ).json();
  const id = state.shop.id,
    path = `onboarding/${id}/storefront-content`;
  await call("GET", path, undefined, "", 401);
  await call("GET", path, undefined, other, 404);
  await call(
    "GET",
    "storefront/content-studio?preview=true",
    undefined,
    "",
    404,
  );
  await call(
    "GET",
    "storefront/content-studio?preview=true",
    undefined,
    other,
    404,
  );
  await call("GET", "storefront/content-studio?preview=true", undefined, owner);
  const initial = (await call("GET", path, undefined, owner)).json();
  assert.equal(initial.version, 0);
  const productState = (
    await call(
      "POST",
      `onboarding/${id}/products`,
      { name: "Canvas tote", price: 850, stock: 12 },
      owner,
      201,
    )
  ).json();
  const productId = productState.products[0].id;
  const content = {
    ...initial.content,
    headline: "Made for everyday journeys",
    description: "Canvas bags from our studio.",
    storyTitle: "A small studio",
    story: "We select practical pieces.",
    email: "hello@example.test",
    whatsappNumber: "+880 1700 000000",
    messengerUrl: "https://m.me/example.test.page",
    contactMessage:
      "Hi {shop_name}! I’m interested in {product_name} ({product_price}).\n{product_url}",
    featuredProductIds: [productId],
    collections: [
      {
        title: "Everyday carry",
        description: "Canvas collection",
        productIds: [productId],
      },
    ],
    faqs: [
      {
        question: "How do I contact you?",
        answer: "Email hello@example.test.",
      },
    ],
  };
  await call(
    "PATCH",
    path,
    { version: 0, content: { ...content, instagram: "javascript:alert(1)" } },
    owner,
    400,
  );
  await call(
    "PATCH",
    path,
    { version: 0, content: { ...content, featuredProductIds: [randomUUID()] } },
    owner,
    409,
  );
  await call("PATCH", path, { version: 0, content }, other, 404);
  for (const invalid of [
    { contactMessage: Array(501).fill("word").join(" ") },
    { contactMessage: "   " },
    { whatsappNumber: "01700000000" },
    { messengerUrl: "https://m.me.evil.test/page" },
    { messengerUrl: "https://evil.test@m.me/page" },
    { messengerUrl: "javascript:alert(1)" },
  ])
    await call(
      "PATCH",
      path,
      { version: 0, content: { ...content, ...invalid } },
      owner,
      400,
    );
  await call("PATCH", path, { version: 0, content }, owner);
  await call("PATCH", path, { version: 0, content }, owner, 409);
  const saved = (await call("GET", path, undefined, owner)).json();
  assert.equal(saved.content.headline, content.headline);
  assert.equal(saved.version, 1);
  const race = await Promise.all(
    [1, 2].map((n) =>
      app.inject({
        method: "PATCH",
        url: "/api/v1/" + path,
        payload: {
          version: 1,
          content: { ...content, announcement: `Update ${n}` },
        },
        headers: { origin: config.appOrigin, cookie: owner },
      }),
    ),
  );
  assert.deepEqual(race.map((r) => r.statusCode).sort(), [200, 409]);
  checks += 2;
  await call("POST", `onboarding/${id}/channels/meta/skip`, undefined, owner);
  await call("PATCH", `onboarding/${id}/ai-mode`, { aiMode: "suggest" }, owner);
  await call(
    "POST",
    `onboarding/${id}/template`,
    { templateId: state.templates[0].id },
    owner,
  );
  await call("POST", `onboarding/${id}/launch`, undefined, owner);
  const published = (await call("GET", "storefront/content-studio")).json();
  assert.equal(published.shop.content.headline, content.headline);
  assert.equal(published.shop.content.contactMessage, content.contactMessage);
  assert.equal(published.shop.content.whatsappNumber, content.whatsappNumber);
  assert.equal(published.shop.content.messengerUrl, content.messengerUrl);
  assert.equal(published.shop.config, undefined);
  await call(
    "PATCH",
    path,
    { version: 2, content: { ...content, story: "Updated after launch." } },
    owner,
  );
  assert.equal(
    (await call("GET", "storefront/content-studio")).json().shop.content.story,
    "Updated after launch.",
  );
  assert.equal(
    await db
      .collection("auditEvents")
      .countDocuments({ shopId: id, action: "storefront.content_updated" }),
    3,
  );
  const publishedBefore = (
    await call("GET", "storefront/content-studio")
  ).json();
  let version = 3;
  for (const template of state.templates) {
    const current = (await call("GET", path, undefined, owner)).json();
    const next = {
      ...current.content,
      design: { ...current.content.design, themeId: template.id },
      storeName: "Theme Studio",
    };
    await call(
      "PATCH",
      path,
      { version, content: next, publish: false },
      owner,
    );
    version++;
    const publicDraft = (await call("GET", "storefront/content-studio")).json();
    assert.notEqual(publicDraft.shop.displayName, "Theme Studio");
    const preview = (
      await call(
        "GET",
        "storefront/content-studio?preview=true",
        undefined,
        owner,
      )
    ).json();
    assert.equal(preview.shop.content.design.themeId, template.id);
    assert.equal(preview.shop.displayName, "Theme Studio");
    await call("PATCH", path, { version, content: next, publish: true }, owner);
    version++;
    const live = (await call("GET", "storefront/content-studio")).json();
    assert.equal(live.shop.content.design.themeId, template.id);
    assert.equal(live.shop.selectedTemplateId, template.id);
    assert.equal(live.products[0].id, publishedBefore.products[0].id);
    await call(
      "PATCH",
      path,
      { version, content: { ...next, storeName: "" }, publish: true },
      owner,
    );
    version++;
  }
  const current = (await call("GET", path, undefined, owner)).json();
  await call(
    "PATCH",
    path,
    {
      version,
      content: {
        ...current.content,
        design: { ...current.content.design, themeId: "arbitrary-html" },
      },
    },
    owner,
    400,
  );
  assert.equal(state.templates.length, 5);
  const boundary = {
    ...current.content,
    contactMessage: Array(500).fill("word").join(" "),
  };
  await call(
    "PATCH",
    path,
    { version, content: boundary, publish: false },
    owner,
  );
  assert.equal(
    (await call("GET", path, undefined, owner)).json().content.contactMessage,
    boundary.contactMessage,
  );
  assert.notEqual(
    (await call("GET", "storefront/content-studio")).json().shop.content
      .contactMessage,
    boundary.contactMessage,
  );
  await call(
    "PATCH",
    path,
    { version: version + 1, content: boundary, publish: true },
    owner,
  );
  assert.equal(
    (await call("GET", "storefront/content-studio")).json().shop.content
      .contactMessage,
    boundary.contactMessage,
  );
  console.log(
    `PASS ${checks} Atlas checks: ownership, validation, preview privacy, persistence, concurrent writes, publication and audit.`,
  );
} finally {
  await app?.close();
  if (db?.databaseName === name) {
    await db.dropDatabase();
    console.log("Removed isolated editor test database.");
  }
  await closeDb();
}
