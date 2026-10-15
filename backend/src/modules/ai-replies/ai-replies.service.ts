import { inventoryService } from "../inventory/inventory.service.js";
import { currentActor } from "../auth/auth.js";
import { randomUUID, createHash } from "node:crypto";
import type { Db, ClientSession, Filter } from "mongodb";
import { connectDb, transaction } from "../../shared/db.js";
import { publicDocument } from "../../shared/models.js";
import { config } from "../../shared/config.js";
import {
  GroundedRuleAiProvider,
  OpenAiReplyProvider,
  type AiContextInput,
  type AiContextProduct,
  type AiReplyProvider,
} from "./ai-provider.js";

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
  source: "incoming" | "staff_manual" | "staff_approved_ai";
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
  provider?: "openai" | "fallback";
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
): Promise<AiContextProduct[]> {
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
    }),
  );
}

async function verifyDraftContext(
  db: Db,
  shopId: string,
  conversationId: string,
  draft: AiDraftDocument,
  session: ClientSession,
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

    return await transaction(async (db, session) => {
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

    return await transaction(async (db, session) => {
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

      const msgDoc: MessageDocument = {
        _id: messageId,
        shopId,
        conversationId,
        customerId: conv.customerId,
        sender: input.sender,
        text: input.text,
        source: input.sender === "staff" ? "staff_manual" : "incoming",
        createdAt: now,
        requestId,
        fingerprint,
      };

      await messages(db).insertOne(msgDoc, { session });

      const convUpdates: Partial<ConversationDocument> = {
        lastMessage: {
          text: input.text,
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

    return await transaction(async (db, session) => {
      const conv = await getConversationRecord(
        db,
        shopId,
        conversationId,
        session,
      );
      const draft = await drafts(db).findOne(
        { _id: draftId, shopId, conversationId },
        { session },
      );

      if (!draft)
        throw new AiReplyError(404, "DRAFT_NOT_FOUND", "AI draft not found.");

      if (draft.status !== "approved" && draft.status !== "send_failed")
        throw new AiReplyError(
          400,
          "DRAFT_NOT_APPROVED",
          `Only approved drafts can be sent. Current status is "${draft.status}".`,
        );

      if (
        conv.channel !== "storefront" ||
        !conv.channelThreadId?.startsWith("buyer:")
      )
        throw new AiReplyError(
          409,
          "CHANNEL_UNAVAILABLE",
          "This customer channel is not connected. Nothing was sent.",
        );
      await verifyDraftContext(db, shopId, conversationId, draft, session);
      const replyText = draft.editedText ?? draft.originalText;
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
