import { apiRequest } from "@/lib/api/client";
import type {
  ConversationListResponse,
  ConversationDetailResponse,
  ConversationSummary,
  ConversationMessage,
  AiDraft,
  ConversationChannel,
} from "@/types/inbox";

const base = (shopId: string) => `inbox/${encodeURIComponent(shopId)}`;

export const inboxService = {
  listConversations: (
    shopId: string,
    query: Record<string, string | number>,
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams(
      Object.entries(query).map(([k, v]) => [k, String(v)]),
    );
    return apiRequest<ConversationListResponse>(
      `${base(shopId)}/conversations?${params.toString()}`,
      { signal },
    );
  },

  getConversation: (
    shopId: string,
    conversationId: string,
    signal?: AbortSignal,
  ) =>
    apiRequest<ConversationDetailResponse>(
      `${base(shopId)}/conversations/${encodeURIComponent(conversationId)}`,
      { signal },
    ),

  createConversation: (
    shopId: string,
    input: {
      customerId: string;
      channel: ConversationChannel;
      channelThreadId?: string;
      initialMessage?: string;
    },
    requestId: string,
  ) =>
    apiRequest<ConversationSummary>(`${base(shopId)}/conversations`, {
      method: "POST",
      body: { ...input, requestId },
    }),

  addMessage: (
    shopId: string,
    conversationId: string,
    input: {
      sender: "customer" | "staff";
      text: string;
    },
    requestId: string,
  ) =>
    apiRequest<ConversationMessage>(
      `${base(shopId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: "POST",
        body: { ...input, requestId },
      },
    ),

  generateDraft: (
    shopId: string,
    conversationId: string,
    triggerMessageId?: string,
    requestId?: string,
  ) =>
    apiRequest<AiDraft>(
      `${base(shopId)}/conversations/${encodeURIComponent(conversationId)}/drafts`,
      {
        method: "POST",
        body: {
          triggerMessageId,
          requestId: requestId ?? crypto.randomUUID(),
        },
      },
    ),

  editDraft: (
    shopId: string,
    conversationId: string,
    draftId: string,
    editedText: string,
    version: number,
  ) =>
    apiRequest<AiDraft>(
      `${base(shopId)}/conversations/${encodeURIComponent(conversationId)}/drafts/${encodeURIComponent(draftId)}`,
      {
        method: "PATCH",
        body: { editedText, version },
      },
    ),

  approveDraft: (
    shopId: string,
    conversationId: string,
    draftId: string,
    requestId: string,
    version: number,
  ) =>
    apiRequest<AiDraft>(
      `${base(shopId)}/conversations/${encodeURIComponent(conversationId)}/drafts/${encodeURIComponent(draftId)}/approve`,
      {
        method: "POST",
        body: { requestId, version },
      },
    ),

  rejectDraft: (
    shopId: string,
    conversationId: string,
    draftId: string,
    reason?: string,
  ) =>
    apiRequest<AiDraft>(
      `${base(shopId)}/conversations/${encodeURIComponent(conversationId)}/drafts/${encodeURIComponent(draftId)}/reject`,
      {
        method: "POST",
        body: { reason },
      },
    ),

  sendApprovedDraft: (
    shopId: string,
    conversationId: string,
    draftId: string,
    requestId: string,
  ) =>
    apiRequest<{
      message: ConversationMessage;
      draft: { id: string; status: string; sentAt: string };
    }>(
      `${base(shopId)}/conversations/${encodeURIComponent(conversationId)}/drafts/${encodeURIComponent(draftId)}/send`,
      {
        method: "POST",
        body: { requestId },
      },
    ),

  getHistory: (shopId: string, conversationId: string, signal?: AbortSignal) =>
    apiRequest<{
      conversation: ConversationSummary;
      messages: ConversationMessage[];
      drafts: AiDraft[];
      timeline: Array<{
        type: string;
        text: string;
        source: string;
        createdAt: string;
      }>;
    }>(
      `${base(shopId)}/conversations/${encodeURIComponent(conversationId)}/history`,
      { signal },
    ),
};
