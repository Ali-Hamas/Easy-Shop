"use client";

import { MessageSquare } from "lucide-react";
import { SearchInput } from "@/components/ui/fields";
import { StatusBadge } from "@/components/ui/display";
import {
  channelLabels,
  aiStatusLabels,
  aiStatusTone,
  formatTimeAgo,
} from "@/adapters/inbox";
import type { ConversationSummary } from "@/types/inbox";

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
  channelFilter: string;
  onChannelFilterChange: (ch: string) => void;
  aiStatusFilter: string;
  onAiStatusFilterChange: (status: string) => void;
  isLoading: boolean;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  channelFilter,
  onChannelFilterChange,
  aiStatusFilter,
  onAiStatusFilterChange,
  isLoading,
}: ConversationListProps) {
  const channels: Array<{ value: string; label: string }> = [
    { value: "all", label: "All" },
    { value: "messenger", label: "Messenger" },
    { value: "instagram", label: "Instagram" },
    { value: "storefront", label: "Storefront" },
  ];

  const aiFilters: Array<{ value: string; label: string }> = [
    { value: "all", label: "All AI states" },
    { value: "draft_ready", label: "Draft ready" },
    { value: "approved", label: "Approved" },
    { value: "needs_human", label: "Needs human" },
    { value: "sent", label: "Replied" },
  ];

  return (
    <aside className="inbox-list-col" aria-label="Conversations">
      <div className="inbox-list-header">
        <SearchInput
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search inquiries…"
        />
        <div className="inbox-list-filters">
          {channels.map((ch) => (
            <button
              key={ch.value}
              type="button"
              className="inbox-filter-pill"
              data-active={channelFilter === ch.value}
              onClick={() => onChannelFilterChange(ch.value)}
            >
              {ch.label}
            </button>
          ))}
        </div>
        <div className="inbox-list-filters">
          {aiFilters.map((st) => (
            <button
              key={st.value}
              type="button"
              className="inbox-filter-pill"
              data-active={aiStatusFilter === st.value}
              onClick={() => onAiStatusFilterChange(st.value)}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      <div className="inbox-list-items">
        {isLoading && conversations.length === 0 ? (
          <div className="inbox-list-empty">Loading conversations…</div>
        ) : conversations.length === 0 ? (
          <div className="inbox-list-empty">
            <MessageSquare
              size={24}
              style={{ margin: "0 auto 8px", opacity: 0.5 }}
            />
            No conversations matching criteria
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = conv.id === selectedId;
            const snippet = conv.lastMessage?.text || "No messages yet";
            const timeAgo = formatTimeAgo(conv.lastActivityAt);
            const initials = conv.channel.slice(0, 2).toUpperCase();

            return (
              <button
                key={conv.id}
                type="button"
                className="inbox-item"
                data-selected={isSelected}
                onClick={() => onSelect(conv.id)}
              >
                <div className="inbox-item-avatar" aria-hidden="true">
                  {initials}
                </div>

                <div className="inbox-item-content">
                  <div className="inbox-item-top">
                    <span className="inbox-item-name">
                      {conv.customerName ?? channelLabels[conv.channel] ?? conv.channel}
                    </span>
                    <span className="inbox-item-time">{timeAgo}</span>
                  </div>

                  <p className="inbox-item-snippet" title={snippet}>
                    {snippet}
                  </p>

                  <div className="inbox-item-footer">
                    <StatusBadge tone={aiStatusTone(conv.aiStatus)}>
                      {aiStatusLabels[conv.aiStatus] || conv.aiStatus}
                    </StatusBadge>

                    {conv.unreadCount > 0 && (
                      <span
                        className="inbox-unread-badge"
                        title={`${conv.unreadCount} unread message(s)`}
                        aria-label="Unread message"
                      />
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
