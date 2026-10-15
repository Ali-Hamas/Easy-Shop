import type {
  ConversationChannel,
  ConversationAiStatus,
  DraftStatus,
  DraftConfidence,
} from "@/types/inbox";

export const channelLabels: Record<ConversationChannel, string> = {
  messenger: "Messenger",
  instagram: "Instagram Direct",
  storefront: "Storefront Chat",
};

export const aiStatusLabels: Record<ConversationAiStatus, string> = {
  idle: "Idle",
  generating: "Drafting…",
  draft_ready: "Draft ready",
  approved: "Approved",
  rejected: "Rejected",
  sent: "Replied",
  needs_human: "Needs human",
};

export const draftStatusLabels: Record<DraftStatus, string> = {
  ready: "Draft ready",
  edited: "Edited draft",
  approved: "Approved (Ready to send)",
  rejected: "Rejected",
  sending: "Sending…",
  sent: "Sent",
  send_failed: "Send failed",
};

import type { Tone } from "@/types/ui";

export function aiStatusTone(status: ConversationAiStatus): Tone {
  switch (status) {
    case "draft_ready":
      return "info";
    case "approved":
    case "sent":
      return "success";
    case "needs_human":
      return "warning";
    case "rejected":
      return "danger";
    case "generating":
      return "primary";
    default:
      return "neutral";
  }
}

export function draftStatusTone(status: DraftStatus): Tone {
  switch (status) {
    case "ready":
      return "info";
    case "edited":
      return "primary";
    case "approved":
      return "success";
    case "sent":
      return "success";
    case "rejected":
    case "send_failed":
      return "danger";
    default:
      return "neutral";
  }
}

export function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
    }).format(new Date(isoString));
  } catch {
    return "";
  }
}

export function formatMessageTime(isoString: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(isoString));
  } catch {
    return "";
  }
}

export function confidenceRationale(
  confidence: DraftConfidence,
  hasSources: boolean,
): string {
  if (confidence === "high") {
    return "Verified against live product stock and customer language.";
  }
  if (confidence === "review") {
    return "Staff verification recommended for policy or return inquiries.";
  }
  return hasSources
    ? "Context retrieved but confidence requires manual staff review."
    : "No matching product or verified facts found.";
}
