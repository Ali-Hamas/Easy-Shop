import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AiReplyError, aiReplyService } from "./ai-replies.service.js";
import {
  paramsSchema,
  listConversationsSchema,
  createConversationSchema,
  addMessageSchema,
  generateDraftSchema,
  editDraftSchema,
  approveDraftSchema,
  rejectDraftSchema,
  reviewDraftSchema,
  sendDraftSchema,
} from "./ai-replies.validators.js";

export async function registerAiReplyRoutes(app: FastifyInstance) {
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "Check the submitted fields.",
        issues: error.issues,
      });
    if (error instanceof AiReplyError)
      return reply
        .code(error.statusCode)
        .send({ code: error.code, message: error.message });
    throw error;
  });

  // 1. List conversations
  app.get("/:shopId/conversations", async (req) => {
    const { shopId } = paramsSchema.parse(req.params);
    return aiReplyService.listConversations(
      shopId,
      listConversationsSchema.parse(req.query),
    );
  });

  // 2. Create conversation
  app.post("/:shopId/conversations", async (req, reply) => {
    const { shopId } = paramsSchema.parse(req.params);
    const { requestId, ...input } = createConversationSchema.parse(req.body);
    return reply
      .code(201)
      .send(await aiReplyService.createConversation(shopId, input, requestId));
  });

  // 3. Get single conversation
  app.get("/:shopId/conversations/:conversationId", async (req) => {
    const { shopId, conversationId } = paramsSchema.parse(req.params);
    return aiReplyService.getConversation(shopId, conversationId!);
  });

  // 4. Get messages for a conversation
  app.get("/:shopId/conversations/:conversationId/messages", async (req) => {
    const { shopId, conversationId } = paramsSchema.parse(req.params);
    const conv = await aiReplyService.getConversation(shopId, conversationId!);
    return { messages: conv.messages };
  });

  // 5. Add message (incoming or manual staff)
  app.post(
    "/:shopId/conversations/:conversationId/messages",
    async (req, reply) => {
      const { shopId, conversationId } = paramsSchema.parse(req.params);
      const { requestId, ...input } = addMessageSchema.parse(req.body);
      return reply
        .code(201)
        .send(
          await aiReplyService.addMessage(
            shopId,
            conversationId!,
            input,
            requestId,
          ),
        );
    },
  );

  // 6. Generate AI reply draft (supports both /drafts and /drafts/generate)
  const handleGenerateDraft = async (
    req: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const { shopId, conversationId } = paramsSchema.parse(req.params);
    const { triggerMessageId, requestId } = generateDraftSchema.parse(req.body);
    return reply
      .code(201)
      .send(
        await aiReplyService.generateDraft(
          shopId,
          conversationId!,
          triggerMessageId,
          requestId,
        ),
      );
  };
  app.post(
    "/:shopId/conversations/:conversationId/drafts",
    handleGenerateDraft,
  );
  app.post(
    "/:shopId/conversations/:conversationId/drafts/generate",
    handleGenerateDraft,
  );

  // 7. Edit AI reply draft
  app.patch(
    "/:shopId/conversations/:conversationId/drafts/:draftId",
    async (req) => {
      const { shopId, conversationId, draftId } = paramsSchema.parse(
        req.params,
      );
      const body = editDraftSchema.parse(req.body);
      const text = body.editedText ?? body.text!;
      return aiReplyService.editDraft(
        shopId,
        conversationId!,
        draftId!,
        text,
        body.version,
      );
    },
  );

  // 8. Review AI reply draft (unified review endpoint)
  app.post(
    "/:shopId/conversations/:conversationId/drafts/:draftId/review",
    async (req) => {
      const { shopId, conversationId, draftId } = paramsSchema.parse(
        req.params,
      );
      const { action, reason, requestId, version } = reviewDraftSchema.parse(
        req.body,
      );
      if (action === "approve") {
        return aiReplyService.approveDraft(
          shopId,
          conversationId!,
          draftId!,
          requestId ?? randomUUID(),
          version,
        );
      } else {
        return aiReplyService.rejectDraft(
          shopId,
          conversationId!,
          draftId!,
          reason,
        );
      }
    },
  );

  // 9. Approve AI reply draft (direct endpoint)
  app.post(
    "/:shopId/conversations/:conversationId/drafts/:draftId/approve",
    async (req) => {
      const { shopId, conversationId, draftId } = paramsSchema.parse(
        req.params,
      );
      const { requestId, version } = approveDraftSchema.parse(req.body);
      return aiReplyService.approveDraft(
        shopId,
        conversationId!,
        draftId!,
        requestId,
        version,
      );
    },
  );

  // 10. Reject AI reply draft (direct endpoint)
  app.post(
    "/:shopId/conversations/:conversationId/drafts/:draftId/reject",
    async (req) => {
      const { shopId, conversationId, draftId } = paramsSchema.parse(
        req.params,
      );
      const { reason } = rejectDraftSchema.parse(req.body);
      return aiReplyService.rejectDraft(
        shopId,
        conversationId!,
        draftId!,
        reason,
      );
    },
  );

  // 11. Send approved AI reply draft (separate step from approve)
  app.post(
    "/:shopId/conversations/:conversationId/drafts/:draftId/send",
    async (req, reply) => {
      const { shopId, conversationId, draftId } = paramsSchema.parse(
        req.params,
      );
      const { requestId } = sendDraftSchema.parse(req.body);
      return reply
        .code(200)
        .send(
          await aiReplyService.sendApprovedDraft(
            shopId,
            conversationId!,
            draftId!,
            requestId,
          ),
        );
    },
  );

  // 12. History
  app.get("/:shopId/conversations/:conversationId/history", async (req) => {
    const { shopId, conversationId } = paramsSchema.parse(req.params);
    return aiReplyService.getConversationHistory(shopId, conversationId!);
  });
}
