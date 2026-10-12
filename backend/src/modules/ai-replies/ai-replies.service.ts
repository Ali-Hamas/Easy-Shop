import { inventoryService } from "../inventory/inventory.service.js";
import { currentActor } from "../auth/auth.js";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import type { Db, ClientSession, Filter } from "mongodb";
import { connectDb, transaction } from "../../shared/db.js";
import { publicDocument } from "../../shared/models.js";
import { config } from "../../shared/config.js";
import { fetchWithRetry } from "../../shared/fetch-retry.js";
import {
  GroundedRuleAiProvider,
  OpenAiReplyProvider,
  type AiContextInput,
  type AiContextProduct,
  type AiReplyProvider,
} from "./ai-provider.js";
import { GroqReplyProvider } from "./groq-provider.js";
import {
  activeVisualCandidates,
} from "./product-visual-index.service.js";
import { matchProductImageWithGemini } from "./gemini-vision.service.js";

export class AiReplyError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type ChannelType = "messenger" | "instagram" | "storefront";

export type ConversationStatus = "open" | "needs_attention" | "resolved";

export type AiDraftStatus =
  | "ready"
  | "edited"
  | "approved"
  | "rejected"
  | "sending"
  | "sent"
  | "send_failed";

export type ConversationAiStatus =
  | "idle"
  | "generating"
  | "draft_ready"
  | "approved"
  | "rejected"
  | "sent"
  | "needs_human";

export interface ConversationDocument {
  _id: string;
  shopId: string;
  customerId: string;
  channel: ChannelType;
  channelThreadId?: string;
  status: ConversationStatus;
  aiStatus: ConversationAiStatus;
  unreadCount: number;
  lastMessage?: {
    text: string;
    sender: "customer" | "staff";
    createdAt: string;
  };
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  requestId: string;
  fingerprint: string;
}

export interface MessageDocument {
  _id: string;
  shopId: string;
  conversationId: string;
  customerId: string;
  sender: "customer" | "staff";
  text: string;
  attachmentUrl?: string;
  source: "incoming" | "staff_manual" | "staff_approved_ai";
  externalMessageId?: string;
  draftId?: string;
  createdAt: string;
  requestId: string;
  fingerprint: string;
}

export interface AiDraftDocument {
  _id: string;
  shopId: string;
  conversationId: string;
  customerId: string;
  triggerMessageId?: string;
  originalText: string;
  provider?: "openai" | "groq" | "fallback";
  version: number;
  contextFingerprint: string;
  editedText?: string;
  confidence: "high" | "review" | "missing";
  groundingSummary: string;
  needsHumanAttention: boolean;
  escalationReason?: string;
  contextSources: Array<{
    type: "customer" | "product" | "inventory" | "staff_note" | "policy";
    name: string;
    detail?: string;
  }>;
  status: AiDraftStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  requestId: string;
  fingerprint: string;
}

export interface CustomerTimelineEvent {
  _id: string;
  shopId: string;
  customerId: string;
  type:
    | "customer_created"
    | "customer_updated"
    | "note"
    | "order"
    | "conversation"
    | "return"
    | "complaint";
  text: string;
  source: string;
  author: string;
  reference?: { module: string; id: string };
  createdAt: string;
  requestId?: string;
  fingerprint?: string;
}

const conversations = (db: Db) =>
  db.collection<ConversationDocument>("conversations");
const messages = (db: Db) => db.collection<MessageDocument>("messages");
const drafts = (db: Db) => db.collection<AiDraftDocument>("aiDrafts");
const customerEventsCol = (db: Db) =>
  db.collection<CustomerTimelineEvent>("customerEvents");
const metaStates = (db: Db) =>
  db.collection<{
    _id: string;
    shopId: string;
    actorId: string;
    createdAt: Date;
    expiresAt: Date;
  }>("metaOAuthStates");

const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function checkShop(db: Db, shopId: string, session?: ClientSession) {
  const shop = await db
    .collection<{ _id: string }>("shops")
    .findOne({ _id: shopId }, { session, projection: { _id: 1 } });
  if (!shop) throw new AiReplyError(404, "SHOP_NOT_FOUND", "Shop not found.");
}

async function checkCustomer(
  db: Db,
  shopId: string,
  customerId: string,
  session?: ClientSession,
) {
  const customer = await db
    .collection<{
      _id: string;
      name: string;
      phone?: string;
      email?: string;
      language: string;
      tags: string[];
    }>("customers")
    .findOne({ _id: customerId, shopId }, { session });
  if (!customer)
    throw new AiReplyError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  return customer;
}

async function getConversationRecord(
  db: Db,
  shopId: string,
  conversationId: string,
  session?: ClientSession,
) {
  const conv = await conversations(db).findOne(
    { _id: conversationId, shopId },
    { session },
  );
  if (!conv)
    throw new AiReplyError(
      404,
      "CONVERSATION_NOT_FOUND",
      "Conversation not found.",
    );
  return conv;
}

async function appendAuditEvent(
  db: Db,
  session: ClientSession,
  event: {
    shopId: string;
    action: string;
    entityType: string;
    entityId: string;
    actorId?: string;
    createdAt: string;
  },
) {
  await db
    .collection<{
      _id: string;
      shopId: string;
      actorId: string;
      action: string;
      entityType: string;
      entityId: string;
      createdAt: string;
    }>("auditEvents")
    .insertOne(
      {
        _id: randomUUID(),
        shopId: event.shopId,
        actorId: event.actorId ?? currentActor(),
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        createdAt: event.createdAt,
      },
      { session },
    );
}

type MetaPage = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id: string; username?: string };
};

type StoredMetaPage = {
  id: string;
  name?: string;
  accessToken?: string;
  instagramBusinessAccount?: { id: string; username?: string };
};

type MetaConversation = {
  id: string;
  updated_time?: string;
  senders?: { data?: Array<{ id: string; name?: string }> };
  messages?: {
    data?: Array<{
      id: string;
      message?: string;
      created_time?: string;
      from?: { id: string; name?: string };
    }>;
  };
};

async function metaGraph<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  const url = new URL(
    `https://graph.facebook.com/${config.metaGraphVersion}/${path}`,
  );
  if (token) url.searchParams.set("access_token", token);
  const response = await fetch(url, init);
  const data = (await response.json()) as { error?: { message?: string } };
  if (!response.ok)
    throw new AiReplyError(
      502,
      "META_REQUEST_FAILED",
      data.error?.message ?? "Meta could not complete the request.",
    );
  return data as T;
}

async function sendMetaReply(
  db: Db,
  conv: ConversationDocument,
  text: string,
) {
  if (conv.channel !== "messenger" && conv.channel !== "instagram") return null;
  const channel = await db
    .collection<{ metadata?: { pages?: StoredMetaPage[] } }>("shopChannels")
    .findOne({ shopId: conv.shopId, provider: "meta", status: "connected" });
  const pages = channel?.metadata?.pages ?? [];
  const page =
    conv.channel === "instagram"
      ? pages.find((p) => p.instagramBusinessAccount?.id && p.accessToken)
      : pages.find((p) => p.accessToken);
  const customer = await db
    .collection<{ _id: string; externalRefs?: { metaSenderId?: string } }>("customers")
    .findOne({ _id: conv.customerId, shopId: conv.shopId });
  const recipientId = customer?.externalRefs?.metaSenderId;
  if (!page?.accessToken || !recipientId)
    throw new AiReplyError(
      409,
      "CHANNEL_UNAVAILABLE",
      "Meta recipient or page token is missing.",
    );
  const senderNode =
    conv.channel === "instagram" ? page.instagramBusinessAccount!.id : page.id;
  const response = await fetchWithRetry(
    `https://graph.facebook.com/${config.metaGraphVersion}/${senderNode}/messages`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        access_token: page.accessToken,
      }),
    },
    { maxRetries: 3, timeoutMs: 12000, actionName: "metaSendMessage" },
  );
  const data = (await response.json()) as {
    message_id?: string;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new AiReplyError(
      502,
      "META_SEND_FAILED",
      data.error?.message ?? "Meta could not send the reply.",
    );
  return data.message_id ?? null;
}

async function syncMetaConversations(
  db: Db,
  shopId: string,
  page: MetaPage,
  channel: ChannelType,
) {
  if (!page.access_token) return;
  const response = await metaGraph<{ data?: MetaConversation[] }>(
    `${page.id}/conversations?${new URLSearchParams({
      ...(channel === "instagram" ? { platform: "instagram" } : {}),
      fields:
        "id,updated_time,senders,messages.limit(1){id,message,created_time,from}",
      limit: "25",
    })}`,
    page.access_token,
  );
  for (const item of response.data ?? []) {
    const latest = item.messages?.data?.[0];
    if (!latest?.message) continue;
    const sender =
      item.senders?.data?.find((s) => s.id !== page.id) ?? latest.from;
    const senderId = sender?.id ?? item.id;
    const now = new Date().toISOString();
    const customer = await db
      .collection<{ _id: string }>("customers")
      .findOneAndUpdate(
        { shopId, "externalRefs.metaSenderId": senderId },
        {
          $set: {
            name: sender?.name ?? `${channel} customer`,
            source: channel === "instagram" ? "instagram" : "facebook",
            status: "active",
            lastActivityAt: latest.created_time ?? item.updated_time ?? now,
            updatedAt: now,
          },
          $setOnInsert: {
            _id: randomUUID(),
            shopId,
            phone: "",
            email: "",
            addresses: [],
            language: "unspecified",
            tags: [channel],
            version: 1,
            createdAt: now,
            requestId: randomUUID(),
            fingerprint: digest({ shopId, senderId }),
            externalRefs: { metaSenderId: senderId },
          },
        },
        { upsert: true, returnDocument: "after" },
      );
    if (!customer) continue;
    const customerId = String(customer._id);
    const conversation = await conversations(db).findOneAndUpdate(
      { shopId, channelThreadId: item.id },
      {
        $set: {
          customerId,
          channel,
          status: "open",
          aiStatus: "idle",
          unreadCount: 0,
          lastMessage: {
            text: latest.message,
            sender: "customer",
            createdAt: latest.created_time ?? now,
          },
          lastActivityAt: latest.created_time ?? item.updated_time ?? now,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: randomUUID(),
          shopId,
          channelThreadId: item.id,
          createdAt: now,
          requestId: randomUUID(),
          fingerprint: digest({ shopId, thread: item.id }),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (!conversation) continue;
    await messages(db).updateOne(
      { shopId, requestId: latest.id },
      {
        $setOnInsert: {
          _id: randomUUID(),
          shopId,
          conversationId: String(conversation._id),
          customerId,
          sender: "customer",
          text: latest.message,
          source: "incoming",
          createdAt: latest.created_time ?? now,
          requestId: latest.id,
          fingerprint: digest({ shopId, message: latest.id }),
        },
      },
      { upsert: true },
    );
  }
}

// -------------------------------------------------------------
// Relevant Product Context Retrieval Step
// -------------------------------------------------------------
const banglaToEnglishTerms: Record<string, string[]> = {
  কটন: ["cotton"],
  পাঞ্জাবি: ["panjabi", "punjabi"],
  পাঞ্জাবী: ["panjabi", "punjabi"],
  শার্ট: ["shirt"],
  "টি-শার্ট": ["t-shirt", "tee"],
  প্যান্ট: ["pants", "pant", "trouser"],
  শাড়ি: ["saree", "sari"],
  বোরকা: ["borka", "burqa", "abaya"],
  হিজাব: ["hijab"],
  জুতা: ["shoe", "shoes", "loafers"],
  ব্যাগ: ["bag", "tote"],
  ওয়ালেট: ["wallet"],
  ঘড়ি: ["watch"],
};

async function retrieveRelevantProducts(
  db: Db,
  shopId: string,
  messageText: string,
  attachmentUrl?: string,
): Promise<AiContextProduct[]> {
  if (attachmentUrl) {
    try {
      const candidates = await activeVisualCandidates(shopId);
      const match = await matchProductImageWithGemini(attachmentUrl, candidates);
      if (
        match.productId &&
        match.confidence >= config.aiVisualConfidenceThreshold
      ) {
        const p = await inventoryService.get(shopId, match.productId);
        return [inventoryProductToAiContext(p)];
      }
    } catch (error) {
      console.warn("Visual product match failed:", error);
    }
  }

  const rawWords = messageText
    .toLowerCase()
    .replace(/[^\w\s\u0980-\u09FF-]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 2 &&
        ![
          "the",
          "and",
          "for",
          "are",
          "have",
          "has",
          "you",
          "your",
          "this",
          "that",
          "with",
          "from",
          "what",
          "when",
          "where",
          "how",
          "can",
          "will",
          "please",
          "hello",
          "available",
          "stock",
          "price",
          "cost",
          "size",
          "color",
          "দাম",
          "কত",
          "আছে",
          "কি",
          "পিস",
          "সাইজ",
          "কালার",
        ].includes(w),
    );

  const searchTerms = new Set<string>();
  for (const w of rawWords) {
    searchTerms.add(w);
    if (banglaToEnglishTerms[w]) {
      for (const t of banglaToEnglishTerms[w]) searchTerms.add(t);
    }
  }

  if (searchTerms.size === 0) return [];

  // Match products in active status whose name, description or category matches candidate words
  const regexPatterns = Array.from(searchTerms)
    .slice(0, 20)
    .map((w) => new RegExp(w, "i"));
  const matchedProducts = await db
    .collection<{
      _id: string;
      name: string;
      title?: string;
      description?: string;
      category?: string;
      price: number;
      currency?: string;
      status: string;
    }>("products")
    .find({
      shopId,
      status: "active",
      $or: regexPatterns.flatMap((re) => [
        { name: { $regex: re } },
        { description: { $regex: re } },
        { category: { $regex: re } },
      ]),
    })
    .limit(3)
    .toArray();

  if (!matchedProducts.length) return [];

  return Promise.all(
    matchedProducts.map(async (candidate) => {
      const p = await inventoryService.get(shopId, candidate._id);
      return inventoryProductToAiContext(p);
    }),
  );
}

function inventoryProductToAiContext(p: Awaited<ReturnType<typeof inventoryService.get>>): AiContextProduct {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    currency: p.currency,
    inStock: p.available > 0,
    availableQuantity: p.available,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.title,
      sku: v.sku,
      price: v.price,
      availableQuantity: v.available,
      inStock: v.available > 0,
    })),
  };
}

async function verifyDraftContext(
  db: Db,
  shopId: string,
  conversationId: string,
  draft: AiDraftDocument,
  session?: ClientSession,
) {
  const latest = await messages(db)
    .find({ shopId, conversationId, sender: "customer" }, { session })
    .sort({ createdAt: -1, _id: -1 })
    .limit(1)
    .next();
  if (!latest || latest._id !== draft.triggerMessageId)
    throw new AiReplyError(
      409,
      "DRAFT_STALE",
      "The customer sent a newer message. Generate and review a new draft.",
    );
  const currentProducts = await retrieveRelevantProducts(
    db,
    shopId,
    latest.text,
    latest.attachmentUrl,
  );
  if (
    !draft.contextFingerprint ||
    digest(currentProducts) !== draft.contextFingerprint
  )
    throw new AiReplyError(
      409,
      "DRAFT_STALE",
      "Product or stock facts changed. Generate and review a new draft.",
    );
}

// -------------------------------------------------------------
// AI Reply Service
// -------------------------------------------------------------
export function createConfiguredAiProvider(): AiReplyProvider {
  if (config.aiReplyProvider === "groq" && config.groqApiKey) {
    return new GroqReplyProvider();
  }
  if (config.aiReplyProvider === "openai" && config.openaiApiKey) {
    return new OpenAiReplyProvider({
      apiKey: config.openaiApiKey,
      model: config.openaiModel,
      fallbackProvider: new GroundedRuleAiProvider(),
    });
  }
  return new GroundedRuleAiProvider();
}

export const aiReplyService = {
  provider: createConfiguredAiProvider(),

  setProvider(newProvider: AiReplyProvider) {
    this.provider = newProvider;
  },

  async listChannels(shopId: string) {
    const db = await connectDb();
    await checkShop(db, shopId);
    const channels = await db
      .collection<{
        _id: string;
        shopId: string;
        provider: string;
        status: string;
        reason?: string;
        createdAt: string;
        updatedAt?: string;
      }>("shopChannels")
      .find({ shopId })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    return { channels: channels.map(publicDocument) };
  },

  async requestMetaConnection(shopId: string) {
    if (!config.metaAppId || !config.metaAppSecret)
      throw new AiReplyError(
        503,
        "META_NOT_CONFIGURED",
        "Meta app credentials are not configured.",
      );
    const db = await connectDb();
    await checkShop(db, shopId);
    const state = randomBytes(24).toString("hex");
    const now = new Date();
    await metaStates(db).insertOne({
      _id: state,
      shopId,
      actorId: currentActor(),
      createdAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    });
    await transaction(async (db, session) => {
      await checkShop(db, shopId, session);
      const timestamp = now.toISOString();
      await db.collection("shopChannels").updateOne(
        { shopId, provider: "meta" },
        {
          $set: {
            status: "pending",
            reason: "waiting-for-meta-oauth",
            updatedAt: timestamp,
          },
          $setOnInsert: {
            _id: randomUUID(),
            shopId,
            provider: "meta",
            createdAt: timestamp,
          },
        },
        { upsert: true, session },
      );
      await appendAuditEvent(db, session, {
        shopId,
        action: "channel.meta_connection_requested",
        entityType: "channel",
        entityId: "meta",
        createdAt: timestamp,
      });
    });
    const redirectUri = `${config.appOrigin}/api/meta/oauth/callback`;
    const url = new URL(
      `https://www.facebook.com/${config.metaGraphVersion}/dialog/oauth`,
    );
    url.searchParams.set("client_id", config.metaAppId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.metaOAuthScopes);
    return { ...(await this.listChannels(shopId)), authUrl: url.toString() };
  },

  async completeMetaConnection(code: string, state: string) {
    const db = await connectDb();
    const saved = await metaStates(db).findOneAndDelete({
      _id: state,
      expiresAt: { $gt: new Date() },
    });
    if (!saved)
      throw new AiReplyError(
        400,
        "META_STATE_INVALID",
        "Meta connection expired. Start again from the inbox.",
      );
    if (saved.actorId !== currentActor())
      throw new AiReplyError(
        403,
        "META_STATE_INVALID",
        "Meta connection expired. Start again from the inbox.",
      );
    await checkShop(db, saved.shopId);
    const redirectUri = `${config.appOrigin}/api/meta/oauth/callback`;
    const tokenUrl = new URL(
      `https://graph.facebook.com/${config.metaGraphVersion}/oauth/access_token`,
    );
    tokenUrl.searchParams.set("client_id", config.metaAppId);
    tokenUrl.searchParams.set("client_secret", config.metaAppSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const shortToken = await fetch(tokenUrl);
    const shortData = (await shortToken.json()) as {
      access_token?: string;
      error?: { message?: string };
    };
    if (!shortToken.ok || !shortData.access_token)
      throw new AiReplyError(
        502,
        "META_TOKEN_FAILED",
        shortData.error?.message ?? "Meta did not return an access token.",
      );
    const longToken = await metaGraph<{ access_token?: string }>(
      `oauth/access_token?${new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: config.metaAppId,
        client_secret: config.metaAppSecret,
        fb_exchange_token: shortData.access_token,
      })}`,
    );
    const userToken = longToken.access_token ?? shortData.access_token;
    const pages = await metaGraph<{ data?: MetaPage[] }>(
      `me/accounts?${new URLSearchParams({
        fields: "id,name,access_token,instagram_business_account{id,username}",
        limit: "25",
      })}`,
      userToken,
    );
    const connectedPages = (pages.data ?? []).filter((p) => p.access_token);
    if (!connectedPages.length)
      throw new AiReplyError(
        422,
        "META_NO_PAGES",
        "No Facebook Page was granted. Choose a Page during Meta authorization.",
      );
    const now = new Date().toISOString();
    for (const page of connectedPages) {
      if (page.access_token) {
        await metaGraph(
          `${page.id}/subscribed_apps?${new URLSearchParams({
            subscribed_fields: "messages,messaging_postbacks",
          })}`,
          page.access_token,
          { method: "POST" },
        ).catch(() => undefined);
        await syncMetaConversations(db, saved.shopId, page, "messenger");
        if (page.instagram_business_account)
          await syncMetaConversations(db, saved.shopId, page, "instagram").catch(
            () => undefined,
          );
      }
    }
    await db.collection("shopChannels").updateOne(
      { shopId: saved.shopId, provider: "meta" },
      {
        $set: {
          status: "connected",
          reason: "facebook-instagram-connected",
          updatedAt: now,
          metadata: {
            pages: connectedPages.map((p) => ({
              id: p.id,
              name: p.name,
              accessToken: p.access_token,
              instagramBusinessAccount: p.instagram_business_account,
            })),
          },
        },
        $setOnInsert: {
          _id: randomUUID(),
          shopId: saved.shopId,
          provider: "meta",
          createdAt: now,
        },
      },
      { upsert: true },
    );
    return { shopId: saved.shopId };
  },

  async listConversations(
    shopId: string,
    query: {
      status: string;
      aiStatus: string;
      channel: string;
      q: string;
      page: number;
      limit: number;
    },
  ) {
    const db = await connectDb();
    await checkShop(db, shopId);

    const filter: Filter<ConversationDocument> = { shopId };
    if (query.status !== "all")
      filter.status = query.status as ConversationStatus;
    if (query.aiStatus !== "all")
      filter.aiStatus = query.aiStatus as ConversationAiStatus;
    if (query.channel !== "all") filter.channel = query.channel as ChannelType;

    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const customerMatches = await db
        .collection<{ _id: string }>("customers")
        .find(
          {
            shopId,
            $or: [
              { name: { $regex: escaped, $options: "i" } },
              { phone: { $regex: escaped, $options: "i" } },
              { email: { $regex: escaped, $options: "i" } },
            ],
          },
          { projection: { _id: 1 } },
        )
        .toArray();

      const matchedCustomerIds = customerMatches.map((c) => c._id);
      filter.$or = [
        { "lastMessage.text": { $regex: escaped, $options: "i" } },
        ...(matchedCustomerIds.length
          ? [{ customerId: { $in: matchedCustomerIds } }]
          : []),
      ];
    }

    const [rows, total] = await Promise.all([
      conversations(db)
        .find(filter)
        .sort({ lastActivityAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .toArray(),
      conversations(db).countDocuments(filter),
    ]);

    // Attach customer names and languages for directory rendering
    const customerIds = Array.from(new Set(rows.map((r) => r.customerId)));
    const customerDocs = await db
      .collection<{
        _id: string;
        name: string;
        language: string;
        phone?: string;
        tags: string[];
      }>("customers")
      .find({ shopId, _id: { $in: customerIds } })
      .toArray();

    const customerMap = new Map(customerDocs.map((c) => [c._id, c]));

    const enriched = rows.map((c) => {
      const cust = customerMap.get(c.customerId);
      return {
        ...publicDocument(c),
        customerName: cust?.name ?? "Unknown customer",
        customerLanguage: cust?.language ?? "en",
        customerPhone: cust?.phone,
        customerTags: cust?.tags ?? [],
      };
    });

    return {
      conversations: enriched,
      total,
      page: query.page,
      limit: query.limit,
    };
  },

  async createConversation(
    shopId: string,
    input: {
      customerId: string;
      channel: ChannelType;
      channelThreadId?: string;
      initialMessage?: string;
    },
    requestId: string,
  ) {
    const fingerprint = digest({ shopId, customerId: input.customerId, input });
    const db = await connectDb();

    const replay = async () => {
      const prior = await conversations(db).findOne({ shopId, requestId });
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new AiReplyError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Request already processed with different parameters.",
          );
        return publicDocument(prior);
      }
      return null;
    };

    const prior = await replay();
    if (prior) return prior;

    const created = await transaction(async (db, session) => {
      await checkShop(db, shopId, session);
      await checkCustomer(db, shopId, input.customerId, session);

      const now = new Date().toISOString();
      const conversationId = randomUUID();

      const doc: ConversationDocument = {
        _id: conversationId,
        shopId,
        customerId: input.customerId,
        channel: input.channel,
        ...(input.channelThreadId
          ? { channelThreadId: input.channelThreadId }
          : {}),
        status: "open",
        aiStatus: "idle",
        unreadCount: input.initialMessage ? 1 : 0,
        ...(input.initialMessage
          ? {
              lastMessage: {
                text: input.initialMessage,
                sender: "customer",
                createdAt: now,
              },
            }
          : {}),
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
        requestId,
        fingerprint,
      };

      await conversations(db).insertOne(doc, { session });

      if (input.initialMessage) {
        const msgDoc: MessageDocument = {
          _id: randomUUID(),
          shopId,
          conversationId,
          customerId: input.customerId,
          sender: "customer",
          text: input.initialMessage,
          source: "incoming",
          createdAt: now,
          requestId: randomUUID(),
          fingerprint: digest({ conversationId, text: input.initialMessage }),
        };
        await messages(db).insertOne(msgDoc, { session });
      }

      await appendAuditEvent(db, session, {
        shopId,
        action: "inbox.conversation_created",
        entityType: "conversation",
        entityId: conversationId,
        createdAt: now,
      });

      return publicDocument(doc);
    }).catch(async (error) => {
      const completed = await replay();
      if (completed) return completed;
      throw error;
    });
    if (input.initialMessage) {
      await this.processAutoReply(shopId, created.id).catch((error) =>
        console.warn("Auto reply failed:", error),
      );
    }
    return created;
  },

  async getConversation(shopId: string, conversationId: string) {
    const db = await connectDb();
    const conv = await getConversationRecord(db, shopId, conversationId);
    const customer = await checkCustomer(db, shopId, conv.customerId);

    // Retrieve notes from customerEvents
    const staffNotes = await db
      .collection<{ text: string; createdAt: string }>("customerEvents")
      .find({ shopId, customerId: conv.customerId, type: "note" })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    const [messageList, latestDraft] = await Promise.all([
      messages(db)
        .find({ shopId, conversationId })
        .sort({ createdAt: 1, _id: 1 })
        .toArray(),
      drafts(db)
        .find({ shopId, conversationId })
        .sort({ createdAt: -1 })
        .limit(1)
        .next(),
    ]);

    return {
      conversation: publicDocument(conv),
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        language: customer.language,
        tags: customer.tags,
        staffNotes: staffNotes.map((n) => n.text),
      },
      messages: messageList.map(publicDocument),
      latestDraft: latestDraft ? publicDocument(latestDraft) : null,
    };
  },

  async addMessage(
    shopId: string,
    conversationId: string,
    input: {
      sender: "customer" | "staff";
      text: string;
      attachmentUrl?: string;
    },
    requestId: string,
  ) {
    const fingerprint = digest({ shopId, conversationId, input });
    const db = await connectDb();

    const replay = async () => {
      const prior = await messages(db).findOne({ shopId, requestId });
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new AiReplyError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Message reference already used.",
          );
        return publicDocument(prior);
      }
      return null;
    };

    const prior = await replay();
    if (prior) return prior;

    const saved = await transaction(async (db, session) => {
      const conv = await getConversationRecord(
        db,
        shopId,
        conversationId,
        session,
      );
      const now = new Date().toISOString();
      if (
        input.sender === "staff" &&
        (conv.channel !== "storefront" ||
          !conv.channelThreadId?.startsWith("buyer:"))
      )
        throw new AiReplyError(
          409,
          "CHANNEL_UNAVAILABLE",
          "This customer channel is not connected. Nothing was sent.",
        );
      const messageId = randomUUID();
      const messageText = input.text || (input.attachmentUrl ? "[Image]" : "");

      const msgDoc: MessageDocument = {
        _id: messageId,
        shopId,
        conversationId,
        customerId: conv.customerId,
        sender: input.sender,
        text: messageText,
        ...(input.attachmentUrl ? { attachmentUrl: input.attachmentUrl } : {}),
        source: input.sender === "staff" ? "staff_manual" : "incoming",
        createdAt: now,
        requestId,
        fingerprint,
      };

      await messages(db).insertOne(msgDoc, { session });

      const convUpdates: Partial<ConversationDocument> = {
        lastMessage: {
          text: messageText,
          sender: input.sender,
          createdAt: now,
        },
        lastActivityAt: now,
        updatedAt: now,
      };

      if (input.sender === "customer") {
        convUpdates.unreadCount = (conv.unreadCount || 0) + 1;
        // When customer writes back, transition aiStatus to idle ready for fresh draft
        convUpdates.aiStatus = "idle";
      }

      await conversations(db).updateOne(
        { _id: conversationId, shopId },
        { $set: convUpdates },
        { session },
      );

      await db
        .collection("customers")
        .updateOne(
          { _id: conv.customerId as never, shopId },
          { $set: { lastActivityAt: now } },
          { session },
        );
      // Staff replies append to customer timeline
      if (input.sender === "staff") {
        await customerEventsCol(db).insertOne(
          {
            _id: randomUUID(),
            shopId,
            customerId: conv.customerId,
            type: "conversation",
            text: `Manual message sent: "${input.text.slice(0, 60)}${input.text.length > 60 ? "…" : ""}"`,
            source: "inbox",
            author: currentActor(),
            reference: { module: "inbox", id: conversationId },
            createdAt: now,
          },
          { session },
        );
      }

      await appendAuditEvent(db, session, {
        shopId,
        action: `inbox.message_${input.sender}`,
        entityType: "message",
        entityId: messageId,
        createdAt: now,
      });

      return publicDocument(msgDoc);
    }).catch(async (error) => {
      const completed = await replay();
      if (completed) return completed;
      throw error;
    });
    if (input.sender === "customer") {
      await this.processAutoReply(shopId, conversationId, saved.id).catch(
        (error) => console.warn("Auto reply failed:", error),
      );
    }
    return saved;
  },

  async processAutoReply(
    shopId: string,
    conversationId: string,
    triggerMessageId?: string,
  ) {
    if (!config.aiAutoReplyEnabled) return { skipped: true, reason: "disabled" };
    const db = await connectDb();
    const shop = await db
      .collection<{ _id: string; aiMode: string }>("shops")
      .findOne({ _id: shopId });
    if (!shop || shop.aiMode === "off")
      return { skipped: true, reason: "shop_ai_disabled" };
    const draft = await this.generateDraft(
      shopId,
      conversationId,
      triggerMessageId,
      randomUUID(),
    );
    if (
      shop.aiMode !== "auto_low_risk" ||
      draft.confidence !== "high" ||
      draft.needsHumanAttention
    )
      return { draft, sent: false };
    const approved = await this.approveDraft(
      shopId,
      conversationId,
      draft.id,
      randomUUID(),
      draft.version,
    );
    return {
      draft: approved,
      sent: await this.sendApprovedDraft(
        shopId,
        conversationId,
        draft.id,
        randomUUID(),
      ),
    };
  },

  async handleMetaWebhook(payload: unknown) {
    const body = payload as {
      object?: string;
      entry?: Array<{
        id?: string;
        messaging?: Array<{
          sender?: { id?: string };
          recipient?: { id?: string };
          message?: {
            mid?: string;
            text?: string;
            attachments?: Array<{ type?: string; payload?: { url?: string } }>;
          };
        }>;
      }>;
    };
    const db = await connectDb();
    let processed = 0;
    for (const entry of body.entry ?? []) {
      const pageId = entry.id;
      if (!pageId) continue;
      const channel = await db.collection<{
        shopId: string;
        metadata?: { pages?: StoredMetaPage[] };
      }>("shopChannels").findOne({
        provider: "meta",
        status: "connected",
        $or: [
          { "metadata.pages.id": pageId },
          { "metadata.pages.instagramBusinessAccount.id": pageId },
        ],
      });
      if (!channel) continue;
      for (const event of entry.messaging ?? []) {
        const senderId = event.sender?.id;
        const mid = event.message?.mid;
        if (!senderId || !mid) continue;
        const attachmentUrl = event.message?.attachments?.find((a) =>
          a.payload?.url,
        )?.payload?.url;
        const text = event.message?.text?.trim() || "";
        const now = new Date().toISOString();
        const customer = await db.collection<{ _id: string }>("customers").findOneAndUpdate(
          { shopId: channel.shopId, "externalRefs.metaSenderId": senderId },
          {
            $set: {
              name: "Meta customer",
              source: body.object === "instagram" ? "instagram" : "facebook",
              status: "active",
              lastActivityAt: now,
              updatedAt: now,
            },
            $setOnInsert: {
              _id: randomUUID(),
              shopId: channel.shopId,
              phone: "",
              email: "",
              addresses: [],
              language: "unspecified",
              tags: [body.object === "instagram" ? "instagram" : "messenger"],
              version: 1,
              createdAt: now,
              requestId: randomUUID(),
              fingerprint: digest({ shopId: channel.shopId, senderId }),
              externalRefs: { metaSenderId: senderId },
            },
          },
          { upsert: true, returnDocument: "after" },
        );
        if (!customer) continue;
        const conversation = await conversations(db).findOneAndUpdate(
          { shopId: channel.shopId, channelThreadId: `${pageId}:${senderId}` },
          {
            $set: {
              customerId: String(customer._id),
              channel: body.object === "instagram" ? "instagram" : "messenger",
              status: "open",
              lastActivityAt: now,
              updatedAt: now,
            },
            $setOnInsert: {
              _id: randomUUID(),
              shopId: channel.shopId,
              channelThreadId: `${pageId}:${senderId}`,
              aiStatus: "idle",
              unreadCount: 0,
              createdAt: now,
              requestId: randomUUID(),
              fingerprint: digest({ pageId, senderId }),
            },
          },
          { upsert: true, returnDocument: "after" },
        );
        if (!conversation) continue;
        await this.addMessage(
          channel.shopId,
          String(conversation._id),
          { sender: "customer", text, ...(attachmentUrl ? { attachmentUrl } : {}) },
          mid,
        );
        processed += 1;
      }
    }
    return { ok: true, processed };
  },

  async generateDraft(
    shopId: string,
    conversationId: string,
    triggerMessageId: string | undefined,
    requestId: string,
  ) {
    const fingerprint = digest({ shopId, conversationId, triggerMessageId });
    const db = await connectDb();

    const replay = async () => {
      const prior = await drafts(db).findOne({ shopId, requestId });
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new AiReplyError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Draft request already processed.",
          );
        return publicDocument(prior);
      }
      return null;
    };

    const prior = await replay();
    if (prior) return prior;

    const conv = await getConversationRecord(db, shopId, conversationId);
    const shop = await db
      .collection<{ _id: string; aiMode: string }>("shops")
      .findOne({ _id: shopId });
    if (shop?.aiMode === "off")
      throw new AiReplyError(
        409,
        "AI_DISABLED",
        "AI is turned off for this shop.",
      );
    const customer = await checkCustomer(db, shopId, conv.customerId);

    // Retrieve staff notes
    const staffNotes = await db
      .collection<{ text: string }>("customerEvents")
      .find({ shopId, customerId: conv.customerId, type: "note" })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    // Retrieve conversation history
    const history = await messages(db)
      .find({ shopId, conversationId })
      .sort({ createdAt: 1 })
      .toArray();

    // Determine latest customer message
    const latestCustomerMsg =
      (triggerMessageId
        ? history.find(
            (m) => m._id === triggerMessageId && m.sender === "customer",
          )
        : undefined) ??
      [...history].reverse().find((m) => m.sender === "customer");

    if (
      !latestCustomerMsg ||
      (triggerMessageId && latestCustomerMsg._id !== triggerMessageId)
    )
      throw new AiReplyError(
        400,
        "MESSAGE_REQUIRED",
        "Choose a current customer message before generating a draft.",
      );
    const messageText = latestCustomerMsg.text;

    // 1. Context retrieval step: query only relevant products
    const relevantProducts = await retrieveRelevantProducts(
      db,
      shopId,
      messageText,
      latestCustomerMsg.attachmentUrl,
    );

    // 2. Build structured provider input
    const aiContext: AiContextInput = {
      shopId,
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        language: customer.language,
        tags: customer.tags,
        staffNotes: staffNotes.map((n) => n.text),
      },
      latestCustomerMessage: messageText,
      conversationHistory: history.map((m) => ({
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt,
      })),
      relevantProducts,
      channel: conv.channel,
    };

    // 3. Generate structured draft
    const aiOutput = await this.provider.generateReply(aiContext);

    return await transaction(async (db, session) => {
      const now = new Date().toISOString();
      const draftId = randomUUID();

      const draftDoc: AiDraftDocument = {
        _id: draftId,
        shopId,
        conversationId,
        customerId: conv.customerId,
        ...(latestCustomerMsg
          ? { triggerMessageId: latestCustomerMsg._id }
          : {}),
        originalText: aiOutput.replyText,
        provider: aiOutput.provider,
        version: 1,
        contextFingerprint: digest(relevantProducts),
        confidence: aiOutput.confidence,
        groundingSummary: aiOutput.groundingSummary,
        needsHumanAttention: aiOutput.needsHumanAttention,
        ...(aiOutput.escalationReason
          ? { escalationReason: aiOutput.escalationReason }
          : {}),
        contextSources: aiOutput.contextSources,
        status: "ready",
        createdAt: now,
        updatedAt: now,
        requestId,
        fingerprint,
      };

      await drafts(db).insertOne(draftDoc, { session });

      const nextAiStatus: ConversationAiStatus = aiOutput.needsHumanAttention
        ? "needs_human"
        : "draft_ready";

      await conversations(db).updateOne(
        { _id: conversationId, shopId },
        { $set: { aiStatus: nextAiStatus, updatedAt: now } },
        { session },
      );

      await appendAuditEvent(db, session, {
        shopId,
        action: "inbox.draft_generated",
        entityType: "aiDraft",
        entityId: draftId,
        createdAt: now,
      });

      return publicDocument(draftDoc);
    }).catch(async (error) => {
      const completed = await replay();
      if (completed) return completed;
      throw error;
    });
  },

  async editDraft(
    shopId: string,
    conversationId: string,
    draftId: string,
    editedText: string,
    version: number,
  ) {
    const db = await connectDb();
    return await transaction(async (db, session) => {
      await getConversationRecord(db, shopId, conversationId, session);
      const draft = await drafts(db).findOne(
        { _id: draftId, shopId, conversationId },
        { session },
      );

      if (!draft)
        throw new AiReplyError(404, "DRAFT_NOT_FOUND", "AI draft not found.");

      if (draft.version !== version)
        throw new AiReplyError(
          409,
          "VERSION_CONFLICT",
          "The draft changed. Reload before editing.",
        );
      if (!["ready", "edited"].includes(draft.status))
        throw new AiReplyError(
          400,
          "DRAFT_LOCKED",
          `Cannot edit a draft that has already been ${draft.status}.`,
        );

      const now = new Date().toISOString();
      await drafts(db).updateOne(
        { _id: draftId },
        {
          $set: {
            editedText,
            version: version + 1,
            status: "edited",
            updatedAt: now,
          },
        },
        { session },
      );

      await appendAuditEvent(db, session, {
        shopId,
        action: "inbox.draft_edited",
        entityType: "aiDraft",
        entityId: draftId,
        createdAt: now,
      });

      return publicDocument({
        ...draft,
        version: version + 1,
        editedText,
        status: "edited" as AiDraftStatus,
        updatedAt: now,
      });
    });
  },

  async approveDraft(
    shopId: string,
    conversationId: string,
    draftId: string,
    requestId: string,
    version: number,
  ) {
    const fingerprint = digest({
      shopId,
      conversationId,
      draftId,
      action: "approve",
    });
    const db = await connectDb();

    return await transaction(async (db, session) => {
      await getConversationRecord(db, shopId, conversationId, session);
      const draft = await drafts(db).findOne(
        { _id: draftId, shopId, conversationId },
        { session },
      );

      if (!draft)
        throw new AiReplyError(404, "DRAFT_NOT_FOUND", "AI draft not found.");

      if (draft.version !== version)
        throw new AiReplyError(
          409,
          "VERSION_CONFLICT",
          "The draft changed. Review the latest text before approving.",
        );
      await verifyDraftContext(db, shopId, conversationId, draft, session);
      if (draft.status === "approved") {
        return publicDocument(draft);
      }

      if (draft.status !== "ready" && draft.status !== "edited")
        throw new AiReplyError(
          400,
          "INVALID_DRAFT_STATE",
          `Cannot approve draft with status "${draft.status}".`,
        );

      const now = new Date().toISOString();
      await drafts(db).updateOne(
        { _id: draftId },
        {
          $set: {
            status: "approved",
            reviewedBy: currentActor(),
            reviewedAt: now,
            updatedAt: now,
          },
        },
        { session },
      );

      await conversations(db).updateOne(
        { _id: conversationId, shopId },
        { $set: { aiStatus: "approved", updatedAt: now } },
        { session },
      );

      await appendAuditEvent(db, session, {
        shopId,
        action: "inbox.draft_approved",
        entityType: "aiDraft",
        entityId: draftId,
        createdAt: now,
      });

      return publicDocument({
        ...draft,
        status: "approved" as AiDraftStatus,
        reviewedBy: currentActor(),
        reviewedAt: now,
        updatedAt: now,
      });
    });
  },

  async rejectDraft(
    shopId: string,
    conversationId: string,
    draftId: string,
    reason?: string,
  ) {
    const db = await connectDb();
    return await transaction(async (db, session) => {
      await getConversationRecord(db, shopId, conversationId, session);
      const draft = await drafts(db).findOne(
        { _id: draftId, shopId, conversationId },
        { session },
      );

      if (!draft)
        throw new AiReplyError(404, "DRAFT_NOT_FOUND", "AI draft not found.");

      if (draft.status === "sent")
        throw new AiReplyError(
          400,
          "DRAFT_ALREADY_SENT",
          "Cannot reject a draft that has already been sent.",
        );

      const now = new Date().toISOString();
      await drafts(db).updateOne(
        { _id: draftId },
        {
          $set: {
            status: "rejected",
            rejectionReason: reason ?? "Rejected by staff.",
            updatedAt: now,
          },
        },
        { session },
      );

      await conversations(db).updateOne(
        { _id: conversationId, shopId },
        { $set: { aiStatus: "rejected", updatedAt: now } },
        { session },
      );

      await appendAuditEvent(db, session, {
        shopId,
        action: "inbox.draft_rejected",
        entityType: "aiDraft",
        entityId: draftId,
        createdAt: now,
      });

      return publicDocument({
        ...draft,
        status: "rejected" as AiDraftStatus,
        rejectionReason: reason ?? "Rejected by staff.",
        updatedAt: now,
      });
    });
  },

  async sendApprovedDraft(
    shopId: string,
    conversationId: string,
    draftId: string,
    requestId: string,
  ) {
    const fingerprint = digest({
      shopId,
      conversationId,
      draftId,
      action: "send",
    });
    const db = await connectDb();

    const replay = async () => {
      const prior = await messages(db).findOne({ shopId, requestId });
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new AiReplyError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Send request already processed.",
          );
        return {
          message: publicDocument(prior),
          draft: { id: draftId, status: "sent" as const },
        };
      }
      return null;
    };

    const prior = await replay();
    if (prior) return prior;

    const conv = await getConversationRecord(db, shopId, conversationId);
    const draft = await drafts(db).findOne({
      _id: draftId,
      shopId,
      conversationId,
    });

    if (!draft)
      throw new AiReplyError(404, "DRAFT_NOT_FOUND", "AI draft not found.");

    if (draft.status !== "approved" && draft.status !== "send_failed")
      throw new AiReplyError(
        400,
        "DRAFT_NOT_APPROVED",
        `Only approved drafts can be sent. Current status is "${draft.status}".`,
      );

    if (
      conv.channel === "storefront" &&
      !conv.channelThreadId?.startsWith("buyer:")
    )
      throw new AiReplyError(
        409,
        "CHANNEL_UNAVAILABLE",
        "This customer channel is not connected. Nothing was sent.",
      );
    await verifyDraftContext(db, shopId, conversationId, draft);
    const replyText = draft.editedText ?? draft.originalText;
    const externalMessageId =
      conv.channel === "storefront" ? null : await sendMetaReply(db, conv, replyText);

    return await transaction(async (db, session) => {
      const completed = await replay();
      if (completed) return completed;
      const now = new Date().toISOString();
      const messageId = randomUUID();

      const messageDoc: MessageDocument = {
        _id: messageId,
        shopId,
        conversationId,
        customerId: conv.customerId,
        sender: "staff",
        text: replyText,
        source: "staff_approved_ai",
        ...(externalMessageId ? { externalMessageId } : {}),
        draftId: draft._id,
        createdAt: now,
        requestId,
        fingerprint,
      };

      await messages(db).insertOne(messageDoc, { session });

      await drafts(db).updateOne(
        { _id: draftId },
        {
          $set: {
            status: "sent",
            sentAt: now,
            updatedAt: now,
          },
        },
        { session },
      );

      await conversations(db).updateOne(
        { _id: conversationId, shopId },
        {
          $set: {
            aiStatus: "sent",
            lastMessage: {
              text: replyText,
              sender: "staff",
              createdAt: now,
            },
            lastActivityAt: now,
            updatedAt: now,
          },
        },
        { session },
      );

      await db
        .collection("customers")
        .updateOne(
          { _id: conv.customerId as never, shopId },
          { $set: { lastActivityAt: now } },
          { session },
        );
      // Customer timeline record
      await customerEventsCol(db).insertOne(
        {
          _id: randomUUID(),
          shopId,
          customerId: conv.customerId,
          type: "conversation",
          text: `AI reply sent: "${replyText.slice(0, 60)}${replyText.length > 60 ? "…" : ""}"`,
          source: "ai-inbox",
          author: currentActor(),
          reference: { module: "inbox", id: conversationId },
          createdAt: now,
        },
        { session },
      );

      await appendAuditEvent(db, session, {
        shopId,
        action: "inbox.reply_sent",
        entityType: "message",
        entityId: messageId,
        createdAt: now,
      });

      return {
        message: publicDocument(messageDoc),
        draft: {
          id: draftId,
          status: "sent" as const,
          sentAt: now,
        },
      };
    }).catch(async (error) => {
      const completed = await replay();
      if (completed) return completed;
      throw error;
    });
  },

  async getConversationHistory(shopId: string, conversationId: string) {
    const db = await connectDb();
    await getConversationRecord(db, shopId, conversationId);

    const [allMessages, allDrafts] = await Promise.all([
      messages(db)
        .find({ shopId, conversationId })
        .sort({ createdAt: 1 })
        .toArray(),
      drafts(db)
        .find({ shopId, conversationId })
        .sort({ createdAt: 1 })
        .toArray(),
    ]);

    return {
      messages: allMessages.map(publicDocument),
      drafts: allDrafts.map(publicDocument),
    };
  },
};
