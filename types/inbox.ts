export type ConversationChannel = "messenger" | "instagram" | "storefront";

export type ConversationStatus = "open" | "needs_attention" | "resolved";

export type ConversationAiStatus =
  | "idle"
  | "generating"
  | "draft_ready"
  | "approved"
  | "rejected"
  | "sent"
  | "needs_human";

export type DraftStatus =
  | "ready"
  | "edited"
  | "approved"
  | "rejected"
  | "sending"
  | "sent"
  | "send_failed";

export type DraftConfidence = "high" | "review" | "missing";

export interface ContextSource {
  type: "customer" | "product" | "inventory" | "staff_note" | "policy";
  name: string;
  detail?: string;
}

export interface ConversationSummary {
  customerName?: string;
  id: string;
  shopId: string;
  customerId: string;
  channel: ConversationChannel;
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
}

export interface ConversationMessage {
  id: string;
  shopId: string;
  conversationId: string;
  customerId: string;
  sender: "customer" | "staff";
  text: string;
  source: "incoming" | "staff_manual" | "staff_approved_ai";
  draftId?: string;
  createdAt: string;
}

export interface ConversationCustomerContext {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  language: string;
  tags: string[];
  staffNotes: string[];
}

export interface AiDraft {
  version: number;
  provider?: "openai" | "fallback";
  id: string;
  shopId: string;
  conversationId: string;
  customerId: string;
  triggerMessageId?: string;
  originalText: string;
  editedText?: string;
  confidence: DraftConfidence;
  groundingSummary: string;
  needsHumanAttention: boolean;
  escalationReason?: string;
  contextSources: ContextSource[];
  status: DraftStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetailResponse {
  conversation: ConversationSummary;
  customer: ConversationCustomerContext;
  messages: ConversationMessage[];
  latestDraft: AiDraft | null;
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
  total: number;
  page: number;
  limit: number;
}
