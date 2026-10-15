import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "../dist/shared/load-env.js";

loadEnvFile(".env");
if (!process.env.MONGODB_URI?.startsWith("mongodb+srv://")) {
  throw new Error("Real Atlas connection required.");
}

const name = `easy_shop_inbox_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
process.env.MONGODB_DB_NAME = name;
process.env.LOG_LEVEL = "silent";

const { buildApp } = await import("../dist/app.js");
const { connectDb, closeDb } = await import("../dist/shared/db.js");
const { ensureIndexes } = await import("../dist/shared/models.js");

let db;
let app;
let checks = 0;

async function call(method, url, payload, status = 200) {
  const r = await app.inject({ method, url, payload });
  assert.equal(
    r.statusCode,
    status,
    `${method} ${url} unexpected status ${r.statusCode}: ${r.body}`,
  );
  checks++;
  return r.json();
}

try {
  db = await connectDb();
  await ensureIndexes(db);
  app = await buildApp();

  // 1. Setup Shop via onboarding
  const setup = await call(
    "POST",
    "/api/v1/onboarding/start",
    {
      ownerName: "Inbox Tester",
      shopName: "Inbox Test Store",
      subdomain: `inbox-${randomUUID().slice(0, 8)}`,
      category: "Fashion",
      country: "Bangladesh",
      currency: "BDT",
      language: "en",
    },
    201,
  );
  const shopId = setup.shop.id;

  // 2. Seed 2 products to test selective context retrieval
  const panjabi = {
    name: "Cotton Panjabi White",
    sku: "CP-WHT",
    category: "Menswear",
    description: "Classic white premium cotton panjabi for formal occasions",
    price: 1850,
    comparePrice: null,
    cost: 1200,
    images: [],
    status: "active",
    aiFacts: {
      sellingPoints: "100% fine cotton, handcrafted buttons",
      audience: "Festive and formal wear",
      care: "Dry clean or gentle hand wash",
      policyExceptions: "",
    },
    seo: { title: "Cotton Panjabi", description: "White cotton panjabi" },
    delivery: { weightGrams: 350, note: "Standard packaging" },
    variants: [
      {
        title: "Medium",
        sku: "CP-WHT-M",
        size: "M",
        color: "White",
        material: "Cotton",
        image: "",
        priceOverride: null,
        openingStock: 8,
        lowStockThreshold: 2,
      },
      {
        title: "Large",
        sku: "CP-WHT-L",
        size: "L",
        color: "White",
        material: "Cotton",
        image: "",
        priceOverride: null,
        openingStock: 7,
        lowStockThreshold: 2,
      },
    ],
  };
  await call(
    "POST",
    `/api/v1/inventory/${shopId}/products`,
    { requestId: randomUUID(), product: panjabi },
    201,
  );

  const wallet = {
    name: "Leather Bifold Wallet",
    sku: "WAL-LTH",
    category: "Accessories",
    description: "Full grain genuine leather bifold wallet with card slots",
    price: 950,
    comparePrice: null,
    cost: 500,
    images: [],
    status: "active",
    aiFacts: {
      sellingPoints: "Genuine leather",
      audience: "Everyday carry",
      care: "Avoid moisture",
      policyExceptions: "",
    },
    seo: { title: "Leather Wallet", description: "Bifold wallet" },
    delivery: { weightGrams: 100, note: "Boxed" },
    variants: [
      {
        title: "Brown",
        sku: "WAL-LTH-BRN",
        size: "Standard",
        color: "Brown",
        material: "Leather",
        image: "",
        priceOverride: null,
        openingStock: 0,
        lowStockThreshold: 1,
      },
    ],
  };
  await call(
    "POST",
    `/api/v1/inventory/${shopId}/products`,
    { requestId: randomUUID(), product: wallet },
    201,
  );

  // 3. Seed a Customer with language preference & notes
  const customer = {
    name: "Tanvir Hasan",
    phone: "+880 1711-223344",
    email: "tanvir@example.test",
    addresses: [
      {
        label: "Home",
        line: "House 24, Road 7, Dhanmondi",
        city: "Dhaka",
        region: "Dhaka",
        postalCode: "1209",
        country: "Bangladesh",
      },
    ],
    language: "bn",
    tags: ["repeat-buyer"],
    source: "facebook",
    status: "active",
  };
  const custRes = await call(
    "POST",
    `/api/v1/customers/${shopId}`,
    { requestId: randomUUID(), customer },
    201,
  );
  const customerId = custRes.id;

  // Add a customer staff note
  await call(
    "POST",
    `/api/v1/customers/${shopId}/${customerId}/notes`,
    { requestId: randomUUID(), text: "Customer prefers evening delivery" },
    201,
  );

  // 4. Create Conversation
  const convReqId = randomUUID();
  const conv = await call(
    "POST",
    `/api/v1/inbox/${shopId}/conversations`,
    {
      requestId: convReqId,
      customerId,
      channel: "messenger",
    },
    201,
  );
  assert.equal(conv.customerId, customerId);
  assert.equal(conv.channel, "messenger");
  assert.equal(conv.status, "open");
  assert.equal(conv.aiStatus, "idle");
  assert.equal(conv.unreadCount, 0);

  // Idempotency check on conversation creation
  const convDupe = await call(
    "POST",
    `/api/v1/inbox/${shopId}/conversations`,
    {
      requestId: convReqId,
      customerId,
      channel: "messenger",
    },
    201,
  );
  assert.equal(convDupe.id, conv.id);

  // 5. Append incoming customer message asking about Cotton Panjabi
  const msgReqId = randomUUID();
  const incomingMsg = await call(
    "POST",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}/messages`,
    {
      requestId: msgReqId,
      sender: "customer",
      text: "আপনার কাছে কটন পাঞ্জাবি আছে কি? স্টক কত পিস?",
    },
    201,
  );
  assert.equal(incomingMsg.sender, "customer");
  assert.equal(incomingMsg.source, "incoming");
  assert.ok(incomingMsg.text.includes("কটন পাঞ্জাবি"));

  // Check conversation list unreadCount before opening
  const convList = await call(
    "GET",
    `/api/v1/inbox/${shopId}/conversations`,
  );
  assert.equal(convList.conversations[0].unreadCount, 1);
  assert.equal(convList.conversations[0].lastMessage.sender, "customer");

  // Check conversation details
  const convDetail = await call(
    "GET",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}`,
  );
  assert.equal(convDetail.conversation.lastMessage.sender, "customer");
  assert.equal(convDetail.customer.id, customerId);
  assert.equal(convDetail.messages.length, 1);

  // 6. Generate AI Draft - verify context retrieval
  const draftReqId = randomUUID();
  const draft = await call(
    "POST",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}/drafts`,
    {
      requestId: draftReqId,
      triggerMessageId: incomingMsg.id,
    },
    201,
  );
  assert.equal(draft.status, "ready");
  assert.equal(draft.conversationId, conv.id);
  assert.equal(draft.confidence, "high");
  assert.ok(
    draft.groundingSummary,
    "Draft must have a groundingSummary explanation",
  );
  // Verify user-facing explanation without chain-of-thought
  assert.ok(
    !draft.groundingSummary.includes("chain-of-thought"),
    "Grounding summary must not contain raw chain-of-thought",
  );
  assert.ok(
    draft.contextSources.length > 0,
    "Context sources must be populated",
  );

  // Verify selective product retrieval: Cotton Panjabi should be in sources, NOT Leather Wallet!
  const productSources = draft.contextSources.filter(
    (s) => s.type === "product",
  );
  assert.ok(
    productSources.some((s) => s.name.includes("Cotton Panjabi")),
    "Should retrieve Cotton Panjabi context",
  );
  assert.ok(
    !productSources.some((s) => s.name.includes("Leather Bifold Wallet")),
    "Should NOT retrieve unrelated Leather Wallet (selective retrieval only)",
  );

  // Response text should be grounded in Bangla (as requested by customer and customer profile)
  assert.ok(
    draft.originalText.length > 10,
    "AI draft should contain response text",
  );

  // 7. Edit Draft text
  const editReqId = randomUUID();
  const editedDraft = await call(
    "PATCH",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}/drafts/${draft.id}`,
    {
      requestId: editReqId,
      text: "জি, আমাদের কাছে কটন পাঞ্জাবি স্টকে আছে (১৫ পিস)। আপনি কি সাইজ M নিতে আগ্রহী?",
    },
    200,
  );
  assert.equal(editedDraft.status, "edited");
  assert.ok(editedDraft.editedText.includes("১৫ পিস"));

  // 8. CRITICAL: Separate Approval from Send
  // Attempt to SEND before approving - MUST FAIL with 400
  const sendEarlyReq = await app.inject({
    method: "POST",
    url: `/api/v1/inbox/${shopId}/conversations/${conv.id}/drafts/${draft.id}/send`,
    payload: { requestId: randomUUID() },
  });
  assert.equal(
    sendEarlyReq.statusCode,
    400,
    "Sending unapproved draft must return 400",
  );
  const earlyErr = sendEarlyReq.json();
  assert.equal(earlyErr.code, "DRAFT_NOT_APPROVED");
  checks++;

  // Verify messages still has only 1 message
  const msgsBeforeApprove = await call(
    "GET",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}/messages`,
  );
  assert.equal(msgsBeforeApprove.messages.length, 1);

  // Now call APPROVE draft (separate step!)
  const approveReqId = randomUUID();
  const approvedDraft = await call(
    "POST",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}/drafts/${draft.id}/review`,
    {
      requestId: approveReqId,
      action: "approve",
    },
    200,
  );
  assert.equal(approvedDraft.status, "approved");
  assert.equal(approvedDraft.reviewedBy, "local-development");
  assert.ok(approvedDraft.reviewedAt);

  // Verify draft is approved, but message is STILL not sent!
  const msgsAfterApprove = await call(
    "GET",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}/messages`,
  );
  assert.equal(
    msgsAfterApprove.messages.length,
    1,
    "Approving must NOT automatically send message",
  );

  // 9. Now call EXPLICIT SEND
  const sendReqId = randomUUID();
  const sendRes = await call(
    "POST",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}/drafts/${draft.id}/send`,
    { requestId: sendReqId },
    200,
  );
  assert.equal(sendRes.draft.status, "sent");
  assert.equal(sendRes.message.sender, "staff");
  assert.equal(sendRes.message.source, "staff_approved_ai");
  assert.equal(sendRes.message.draftId, draft.id);

  // Verify message history now has 2 messages
  const msgsAfterSend = await call(
    "GET",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}/messages`,
  );
  assert.equal(msgsAfterSend.messages.length, 2);

  // Verify conversation aiStatus is "sent"
  const convAfterSend = await call(
    "GET",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}`,
  );
  assert.equal(convAfterSend.conversation.aiStatus, "sent");

  // 10. Check Customer Timeline Integration (customerEvents)
  const timelineEvents = await db
    .collection("customerEvents")
    .find({ shopId, customerId })
    .toArray();
  const convTimelineEvent = timelineEvents.find(
    (e) => e.type === "conversation" && e.source === "ai-inbox",
  );
  assert.ok(
    convTimelineEvent,
    "Approved reply must write a 'conversation' event to customerEvents",
  );
  assert.equal(convTimelineEvent.reference?.module, "inbox");
  assert.equal(convTimelineEvent.reference?.id, conv.id);

  // 11. Check Audit Log (auditEvents)
  const auditLogs = await db
    .collection("auditEvents")
    .find({ shopId, action: "inbox.reply_sent" })
    .toArray();
  assert.equal(auditLogs.length, 1, "Must record inbox.reply_sent audit log");

  // 12. Manual Staff Message
  const manualMsg = await call(
    "POST",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}/messages`,
    {
      requestId: randomUUID(),
      sender: "staff",
      text: "We can also offer free gift wrapping if needed.",
    },
    201,
  );
  assert.equal(manualMsg.sender, "staff");
  assert.equal(manualMsg.source, "staff_manual");

  // 13. Rejection Workflow & Escalation Test
  // Customer complains/wants a return
  const complaintMsg = await call(
    "POST",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}/messages`,
    {
      requestId: randomUUID(),
      sender: "customer",
      text: "I received a damaged shirt last week. I want a refund or exchange immediately!",
    },
    201,
  );

  const escalationDraft = await call(
    "POST",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}/drafts`,
    {
      requestId: randomUUID(),
      triggerMessageId: complaintMsg.id,
    },
    201,
  );
  assert.equal(escalationDraft.confidence, "review");
  assert.equal(escalationDraft.needsHumanAttention, true);
  assert.ok(
    escalationDraft.escalationReason?.includes("complaint") ||
      escalationDraft.escalationReason?.includes("return"),
  );

  // Staff rejects this draft
  const rejectedDraft = await call(
    "POST",
    `/api/v1/inbox/${shopId}/conversations/${conv.id}/drafts/${escalationDraft.id}/review`,
    {
      requestId: randomUUID(),
      action: "reject",
      reason: "Handling via phone support",
    },
    200,
  );
  assert.equal(rejectedDraft.status, "rejected");
  assert.equal(rejectedDraft.rejectionReason, "Handling via phone support");

  // Attempting to send rejected draft must fail
  const sendRejected = await app.inject({
    method: "POST",
    url: `/api/v1/inbox/${shopId}/conversations/${conv.id}/drafts/${escalationDraft.id}/send`,
    payload: { requestId: randomUUID() },
  });
  assert.equal(
    sendRejected.statusCode,
    400,
    "Sending rejected draft must fail",
  );
  checks++;

  // 14. Shop Isolation Verification
  const setup2 = await call(
    "POST",
    "/api/v1/onboarding/start",
    {
      ownerName: "Competitor",
      shopName: "Competitor Store",
      subdomain: `comp-${randomUUID().slice(0, 8)}`,
      category: "Fashion",
      country: "Bangladesh",
      currency: "BDT",
      language: "en",
    },
    201,
  );
  const shop2Id = setup2.shop.id;

  // Try to access shop1's conversation from shop2 -> 404
  const crossShopConv = await app.inject({
    method: "GET",
    url: `/api/v1/inbox/${shop2Id}/conversations/${conv.id}`,
  });
  assert.equal(
    crossShopConv.statusCode,
    404,
    "Cross-shop conversation access must return 404",
  );
  checks++;

  // 15. Verify Production Loopback Guard
  const { config } = await import("../dist/shared/config.js");
  const origEnv = config.nodeEnv;
  config.nodeEnv = "production";
  const blockedReq = await app.inject({
    method: "GET",
    url: `/api/v1/inbox/${shopId}/conversations`,
  });
  assert.equal(
    blockedReq.statusCode,
    503,
    "Production mode must trigger 503 guard",
  );
  checks++;
  config.nodeEnv = origEnv;

  console.log(
    `AI Reply & Inbox Atlas verification passed: ${checks} checks covering lifecycle, selective product retrieval, separate approval from send, audit/customerEvents synchronization, escalation handling, and tenant isolation.`,
  );
} finally {
  await app?.close();
  if (
    db &&
    db.databaseName === name &&
    name.startsWith("easy_shop_inbox_test_")
  ) {
    await db.dropDatabase();
    console.log("Isolated Inbox test database dropped cleanly.");
  }
  await closeDb();
}
