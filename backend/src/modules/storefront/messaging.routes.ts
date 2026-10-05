import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { MongoServerError } from "mongodb";
import { z } from "zod";
import { connectDb, transaction } from "../../shared/db.js";
import { collections } from "../../shared/models.js";
import { config } from "../../shared/config.js";
import {
  AiReplyError,
  type ConversationDocument,
  type MessageDocument,
} from "../ai-replies/ai-replies.service.js";

type BuyerSession = {
  _id: string;
  shopId: string;
  customerId: string;
  conversationId: string;
  expiresAt: Date;
};
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const cookieName = (subdomain: string) => `easy_shop_buyer_${subdomain}`;
function tokenFor(request: FastifyRequest, subdomain: string) {
  const prefix = `${cookieName(subdomain)}=`;
  const token = request.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(prefix))
    ?.slice(prefix.length);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
async function shopFor(subdomain: string) {
  const shop = await collections(await connectDb()).shops.findOne({
    subdomain,
    status: "launched",
  });
  if (!shop)
    throw new AiReplyError(404, "SHOP_NOT_FOUND", "Published shop not found.");
  return shop;
}
async function buyerFor(
  request: FastifyRequest,
  subdomain: string,
  shopId: string,
) {
  const token = tokenFor(request, subdomain);
  const buyer = token
    ? await (
        await connectDb()
      )
        .collection<BuyerSession>("buyerSessions")
        .findOne({ _id: hash(token), shopId, expiresAt: { $gt: new Date() } })
    : null;
  if (!buyer)
    throw new AiReplyError(
      401,
      "BUYER_SESSION_REQUIRED",
      "Start a private chat to continue.",
    );
  return buyer;
}
const paramsSchema = z.object({
  subdomain: z.string().regex(/^[a-z0-9-]{3,40}$/),
});
const messageSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    text: z.string().trim().min(1).max(4000),
    requestId: z.string().uuid(),
  })
  .strict();
const messageView = (message: MessageDocument) => ({
  id: message._id,
  sender: message.sender,
  text: message.text,
  createdAt: message.createdAt,
});

export async function registerStorefrontMessaging(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (
      request.method === "POST" &&
      request.headers.origin !== config.appOrigin
    )
      return reply
        .code(403)
        .send({
          code: "ORIGIN_REJECTED",
          message: "Send messages from the storefront.",
        });
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError)
      return reply
        .code(400)
        .send({
          code: "VALIDATION_ERROR",
          message: "Enter your name and a message of up to 4,000 characters.",
        });
    if (error instanceof AiReplyError)
      return reply
        .code(error.statusCode)
        .send({ code: error.code, message: error.message });
    throw error;
  });
  app.post(
    "/:subdomain/chat/session",
    { config: { rateLimit: { max: 20, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const { subdomain } = paramsSchema.parse(request.params);
      const shop = await shopFor(subdomain);
      const db = await connectDb();
      const previous = tokenFor(request, subdomain);
      if (
        previous &&
        (await db
          .collection<BuyerSession>("buyerSessions")
          .findOne({
            _id: hash(previous),
            shopId: shop._id,
            expiresAt: { $gt: new Date() },
          }))
      )
        return { ready: true };
      const token = randomBytes(32).toString("hex");
      const maxAge = 30 * 24 * 60 * 60;
      await db
        .collection<BuyerSession>("buyerSessions")
        .insertOne({
          _id: hash(token),
          shopId: shop._id,
          customerId: randomUUID(),
          conversationId: randomUUID(),
          expiresAt: new Date(Date.now() + maxAge * 1000),
        });
      reply.header(
        "Set-Cookie",
        `${cookieName(subdomain)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.appOrigin.startsWith("https:") ? "; Secure" : ""}`,
      );
      return { ready: true };
    },
  );
  app.get("/:subdomain/chat/messages", async (request) => {
    const { subdomain } = paramsSchema.parse(request.params);
    const shop = await shopFor(subdomain);
    const buyer = await buyerFor(request, subdomain, shop._id);
    const db = await connectDb();
    const messages = await db
      .collection<MessageDocument>("messages")
      .find({ shopId: shop._id, conversationId: buyer.conversationId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .toArray();
    return { messages: messages.reverse().map(messageView) };
  });
  app.post(
    "/:subdomain/chat/messages",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { subdomain } = paramsSchema.parse(request.params);
      const input = messageSchema.parse(request.body);
      const shop = await shopFor(subdomain);
      const buyer = await buyerFor(request, subdomain, shop._id);
      const db = await connectDb();
      const fingerprint = hash(
        JSON.stringify({
          conversationId: buyer.conversationId,
          name: input.name,
          text: input.text,
        }),
      );
      const replay = async () => {
        const previous = await db
          .collection<MessageDocument>("messages")
          .findOne({ shopId: shop._id, requestId: input.requestId });
        if (
          previous &&
          (previous.conversationId !== buyer.conversationId ||
            previous.fingerprint !== fingerprint)
        )
          throw new AiReplyError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This message reference was already used.",
          );
        return previous;
      };
      let message = await replay();
      if (!message) {
        try {
          message = await transaction(async (database, session) => {
            const now = new Date().toISOString();
            const conversations =
              database.collection<ConversationDocument>("conversations");
            const conversation = await conversations.findOne(
              { _id: buyer.conversationId, shopId: shop._id },
              { session },
            );
            if (!conversation) {
              // Browser capability creates a new guest identity. Never claim an existing customer by unverified email or phone.
              await database
                .collection<{ _id: string }>("customers")
                .insertOne(
                  {
                    _id: buyer.customerId,
                    shopId: shop._id,
                    name: input.name,
                    email: "",
                    phone: "",
                    addresses: [],
                    language:
                      shop.language === "bn-en"
                        ? "banglish"
                        : shop.language === "ur-roman"
                          ? "roman-urdu"
                          : shop.language,
                    source: "storefront",
                    status: "active",
                    tags: [],
                    version: 1,
                    createdAt: now,
                    updatedAt: now,
                    lastActivityAt: now,
                    requestId: buyer.conversationId,
                    fingerprint,
                  } as never,
                  { session },
                );
              await conversations.insertOne(
                {
                  _id: buyer.conversationId,
                  shopId: shop._id,
                  customerId: buyer.customerId,
                  channel: "storefront",
                  channelThreadId: `buyer:${buyer.conversationId}`,
                  status: "open",
                  aiStatus: "idle",
                  unreadCount: 0,
                  lastActivityAt: now,
                  createdAt: now,
                  updatedAt: now,
                  requestId: buyer.conversationId,
                  fingerprint,
                },
                { session },
              );
            }
            const message: MessageDocument = {
              _id: randomUUID(),
              shopId: shop._id,
              conversationId: buyer.conversationId,
              customerId: buyer.customerId,
              sender: "customer",
              text: input.text,
              source: "incoming",
              createdAt: now,
              requestId: input.requestId,
              fingerprint,
            };
            await database
              .collection<MessageDocument>("messages")
              .insertOne(message, { session });
            await conversations.updateOne(
              { _id: buyer.conversationId, shopId: shop._id },
              {
                $set: {
                  lastMessage: {
                    sender: "customer",
                    text: input.text,
                    createdAt: now,
                  },
                  lastActivityAt: now,
                  updatedAt: now,
                  aiStatus: "idle",
                },
                $inc: { unreadCount: 1 },
              },
              { session },
            );
            await database
              .collection("customers")
              .updateOne(
                { _id: buyer.customerId as never, shopId: shop._id },
                { $set: { lastActivityAt: now } },
                { session },
              );
            await database
              .collection<{ _id: string }>("customerEvents")
              .insertOne(
                {
                  _id: randomUUID(),
                  shopId: shop._id,
                  customerId: buyer.customerId,
                  type: "conversation",
                  text: "Customer sent a storefront message.",
                  source: "storefront",
                  author: "customer",
                  reference: { module: "inbox", id: buyer.conversationId },
                  createdAt: now,
                } as never,
                { session },
              );
            await database
              .collection<{ _id: string }>("auditEvents")
              .insertOne(
                {
                  _id: randomUUID(),
                  shopId: shop._id,
                  actorId: `buyer:${buyer.customerId}`,
                  action: "storefront.message_received",
                  entityType: "message",
                  entityId: message._id,
                  createdAt: now,
                } as never,
                { session },
              );
            return message;
          });
        } catch (error) {
          if (!(error instanceof MongoServerError && error.code === 11000))
            throw error;
          message = await replay();
          if (!message) throw error;
        }
      }
      return reply.code(201).send({ message: messageView(message) });
    },
  );
}
