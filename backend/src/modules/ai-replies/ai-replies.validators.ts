import { z } from "zod";

export const paramsSchema = z
  .object({
    shopId: z.string().uuid("Invalid shop ID format."),
    conversationId: z
      .string()
      .uuid("Invalid conversation ID format.")
      .optional(),
    draftId: z.string().uuid("Invalid draft ID format.").optional(),
  })
  .strict();

export const listConversationsSchema = z
  .object({
    status: z
      .enum(["all", "open", "needs_attention", "resolved"])
      .default("all"),
    aiStatus: z
      .enum([
        "all",
        "idle",
        "generating",
        "draft_ready",
        "approved",
        "rejected",
        "sent",
        "needs_human",
      ])
      .default("all"),
    channel: z
      .enum(["all", "messenger", "instagram", "storefront"])
      .default("all"),
    q: z.string().max(120).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const createConversationSchema = z
  .object({
    customerId: z.string().uuid("Invalid customer ID."),
    channel: z.enum(["messenger", "instagram", "storefront"]),
    channelThreadId: z.string().min(1).max(200).optional(),
    initialMessage: z.string().min(1).max(4000).optional(),
    requestId: z.string().uuid("Valid request ID is required."),
  })
  .strict();

export const addMessageSchema = z
  .object({
    sender: z.literal("staff"),
    text: z.string().trim().min(1, "Message text cannot be empty.").max(4000),
    requestId: z.string().uuid("Valid request ID is required."),
  })
  .strict();

export const generateDraftSchema = z
  .object({
    triggerMessageId: z.string().uuid().optional(),
    requestId: z.string().uuid("Valid request ID is required."),
  })
  .strict();

export const editDraftSchema = z
  .object({
    version: z.number().int().min(1),
    editedText: z
      .string()
      .trim()
      .min(1, "Draft text cannot be empty.")
      .max(4000)
      .optional(),
    text: z
      .string()
      .trim()
      .min(1, "Draft text cannot be empty.")
      .max(4000)
      .optional(),
    requestId: z.string().uuid().optional(),
  })
  .refine((data) => data.editedText !== undefined || data.text !== undefined, {
    message: "Either editedText or text must be provided.",
  });

export const approveDraftSchema = z
  .object({
    version: z.number().int().min(1),
    requestId: z.string().uuid("Valid request ID is required."),
  })
  .strict();

export const rejectDraftSchema = z
  .object({
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();

export const reviewDraftSchema = z
  .object({
    version: z.number().int().min(1),
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(1000).optional(),
    requestId: z.string().uuid().optional(),
  })
  .strict();

export const sendDraftSchema = z
  .object({
    requestId: z.string().uuid("Valid request ID is required."),
  })
  .strict();
