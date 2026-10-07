import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "../dist/shared/load-env.js";
loadEnvFile(process.env.BACKEND_ENV_FILE ?? ".env");
assert.ok(
  process.env.MONGODB_URI?.startsWith("mongodb+srv://"),
  "Atlas required",
);
const databaseName = `easy_shop_chat_${randomUUID().slice(0, 8)}`;
process.env.MONGODB_DB_NAME = databaseName;
process.env.LOG_LEVEL = "silent";
const { buildApp } = await import("../dist/app.js");
const { connectDb, closeDb } = await import("../dist/shared/db.js");
const { ensureIndexes, money } = await import("../dist/shared/models.js");
const { config } = await import("../dist/shared/config.js");
let app,
  db,
  checks = 0;
async function call(method, path, payload, cookie = "", expected = 200) {
  const response = await app.inject({
    method,
    url: `/api/v1/${path}`,
    payload,
    headers: { cookie, origin: config.appOrigin },
  });
  assert.equal(
    response.statusCode,
    expected,
    `${method} ${path} status ${response.statusCode}`,
  );
  checks++;
  return response;
}
try {
  db = await connectDb();
  await ensureIndexes(db);
  app = await buildApp();
  const registration = await call(
    "POST",
    "auth/register",
    {
      name: "Chat merchant",
      email: "merchant@example.test",
      password: `Test-only-${randomUUID()}`,
    },
    "",
    201,
  );
  const ownerCookie = registration.headers["set-cookie"].split(";")[0];
  const subdomain = `chat-${randomUUID().slice(0, 8)}`;
  const setup = (
    await call(
      "POST",
      "onboarding/start",
      {
        ownerName: "Chat merchant",
        shopName: "Chat verification",
        subdomain,
        category: "Fashion",
        country: "Bangladesh",
        currency: "BDT",
        language: "en",
      },
      ownerCookie,
      201,
    )
  ).json();
  const shopId = setup.shop.id;
  await call(
    "POST",
    `onboarding/${shopId}/products`,
    { name: "Olive canvas tote", price: 1250, stock: 8 },
    ownerCookie,
    201,
  );
  await call("POST", `onboarding/${shopId}/launch`, {}, ownerCookie);
  await call(
    "GET",
    `storefront/${subdomain}/chat/messages`,
    undefined,
    "",
    401,
  );
  const buyer = await call("POST", `storefront/${subdomain}/chat/session`, {});
  const buyerCookie = buyer.headers["set-cookie"].split(";")[0];
  assert.match(buyer.headers["set-cookie"], /HttpOnly/);
  const incoming = {
    name: "Test buyer",
    text: "Is the Olive canvas tote in stock and what is the price?",
    requestId: randomUUID(),
  };
  const receipt = (
    await call(
      "POST",
      `storefront/${subdomain}/chat/messages`,
      incoming,
      buyerCookie,
      201,
    )
  ).json();
  const again = (
    await call(
      "POST",
      `storefront/${subdomain}/chat/messages`,
      incoming,
      buyerCookie,
      201,
    )
  ).json();
  assert.equal(again.message.id, receipt.message.id);
  const secondBuyer = await call(
    "POST",
    `storefront/${subdomain}/chat/session`,
    {},
  );
  const secondCookie = secondBuyer.headers["set-cookie"].split(";")[0];
  assert.equal(
    (
      await call(
        "GET",
        `storefront/${subdomain}/chat/messages`,
        undefined,
        secondCookie,
      )
    ).json().messages.length,
    0,
  );
  const list = (
    await call("GET", `inbox/${shopId}/conversations`, undefined, ownerCookie)
  ).json();
  assert.equal(list.total, 1);
  const conversationId = list.conversations[0].id;
  const base = `inbox/${shopId}/conversations/${conversationId}`;
  const draft = (
    await call(
      "POST",
      `${base}/drafts`,
      { requestId: randomUUID() },
      ownerCookie,
      201,
    )
  ).json();
  assert.ok(
    draft.contextSources.some((s) => s.detail?.includes("1250")),
    "Decimal128 price grounded",
  );
  assert.ok(
    draft.contextSources.some(
      (s) => s.type === "inventory" && s.detail.includes("8"),
    ),
    "Legacy stock grounded",
  );
  console.log(`Live draft provider: ${draft.provider}.`);
  await call(
    "POST",
    `${base}/drafts/${draft.id}/send`,
    { requestId: randomUUID() },
    ownerCookie,
    400,
  );
  const editedText =
    "The Olive canvas tote is BDT 1250 and currently in stock.";
  const edited = (
    await call(
      "PATCH",
      `${base}/drafts/${draft.id}`,
      { editedText, version: draft.version },
      ownerCookie,
    )
  ).json();
  await call(
    "POST",
    `${base}/drafts/${draft.id}/approve`,
    { requestId: randomUUID(), version: draft.version },
    ownerCookie,
    409,
  );
  await call(
    "POST",
    `${base}/drafts/${draft.id}/approve`,
    { requestId: randomUUID(), version: edited.version },
    ownerCookie,
  );
  assert.equal(
    (
      await call(
        "GET",
        `storefront/${subdomain}/chat/messages`,
        undefined,
        buyerCookie,
      )
    ).json().messages.length,
    1,
    "Approval does not send",
  );
  const sendRequest = { requestId: randomUUID() };
  const sent = (
    await call(
      "POST",
      `${base}/drafts/${draft.id}/send`,
      sendRequest,
      ownerCookie,
    )
  ).json();
  const replay = (
    await call(
      "POST",
      `${base}/drafts/${draft.id}/send`,
      sendRequest,
      ownerCookie,
    )
  ).json();
  assert.equal(sent.message.id, replay.message.id);
  const received = (
    await call(
      "GET",
      `storefront/${subdomain}/chat/messages`,
      undefined,
      buyerCookie,
    )
  ).json();
  assert.equal(received.messages.at(-1).text, editedText);
  assert.equal(received.messages.at(-1).sender, "staff");
  assert.ok(!JSON.stringify(received).includes("groundingSummary"));
  const customer = (
    await call(
      "GET",
      `customers/${shopId}/${list.conversations[0].customerId}`,
      undefined,
      ownerCookie,
    )
  ).json();
  assert.ok(customer);
  assert.ok(
    await db
      .collection("customerEvents")
      .findOne({ shopId, source: "ai-inbox" }),
  );
  assert.ok(
    await db
      .collection("auditEvents")
      .findOne({
        shopId,
        action: "inbox.reply_sent",
        actorId: registration.json().user.id,
      }),
  );
  const stale = (
    await call(
      "POST",
      `${base}/drafts`,
      { requestId: randomUUID() },
      ownerCookie,
      201,
    )
  ).json();
  await call(
    "POST",
    `storefront/${subdomain}/chat/messages`,
    {
      name: "Test buyer",
      text: "Actually, I need another size.",
      requestId: randomUUID(),
    },
    buyerCookie,
    201,
  );
  await call(
    "POST",
    `${base}/drafts/${stale.id}/approve`,
    { requestId: randomUUID(), version: stale.version },
    ownerCookie,
    409,
  );
  // Disconnected external channels cannot claim delivery.
  const meta = (
    await call(
      "POST",
      `inbox/${shopId}/conversations`,
      {
        customerId: list.conversations[0].customerId,
        channel: "messenger",
        requestId: randomUUID(),
      },
      ownerCookie,
      201,
    )
  ).json();
  await call(
    "POST",
    `inbox/${shopId}/conversations/${meta.id}/messages`,
    { sender: "staff", text: "Do not send", requestId: randomUUID() },
    ownerCookie,
    409,
  );
  console.log(
    `Atlas storefront messaging: ${checks} API checks passed; buyer isolation, grounded draft, edit, approval, actual buyer delivery, timeline, audit, replay and stale-message checks verified.`,
  );
  if (draft.provider !== "openai") {
    console.error("Real OpenAI draft was not verified; fallback was used.");
    process.exitCode = 2;
  }
} finally {
  if (db?.databaseName === databaseName) {
    await db.dropDatabase();
    console.log("Isolated chat test database removed.");
  }
  await app?.close();
  await closeDb();
}
