"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, ExternalLink, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/display";
import { channelLabels, formatMessageTime } from "@/adapters/inbox";
import type {
  ConversationSummary,
  ConversationMessage,
  ConversationCustomerContext,
} from "@/types/inbox";

interface ConversationThreadProps {
  conversation: ConversationSummary | null;
  customer: ConversationCustomerContext | null;
  messages: ConversationMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onGenerateDraft: () => Promise<void>;
  onOpenCustomer: (customerId: string) => void;
  isSending: boolean;
  isGenerating: boolean;
}

export function ConversationThread({
  conversation,
  customer,
  messages,
  onSendMessage,
  onGenerateDraft,
  onOpenCustomer,
  isSending,
  isGenerating,
}: ConversationThreadProps) {
  const [inputText, setInputText] = useState("");
  const streamEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!conversation) {
    return (
      <section
        className="inbox-thread-col"
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <p className="inbox-list-empty">
          Select a conversation from the list to view inquiry details.
        </p>
      </section>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;
    const text = inputText.trim();
    try {
      await onSendMessage(text);
      setInputText("");
    } catch {
      /* Parent displays the error; retain the reply. */
    }
  };

  return (
    <section className="inbox-thread-col" aria-label="Conversation Thread">
      {/* Header */}
      <header className="inbox-thread-header">
        <div className="inbox-thread-header-info">
          <h2 className="inbox-thread-header-title">
            {customer?.name || "Customer Inquiry"}
          </h2>
          <span className="inbox-thread-header-meta">
            via {channelLabels[conversation.channel] || conversation.channel}
          </span>
          <StatusBadge
            tone={conversation.status === "open" ? "primary" : "neutral"}
          >
            {conversation.status.toUpperCase()}
          </StatusBadge>
        </div>

        {customer && (
          <Button
            variant="ghost"
            onClick={() => onOpenCustomer(customer.id)}
            style={{ fontSize: 12, padding: "4px 8px" }}
          >
            <User size={14} />
            Customer details
            <ExternalLink size={12} />
          </Button>
        )}
      </header>

      {/* Message Stream */}
      <div className="inbox-thread-stream" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="inbox-list-empty" style={{ margin: "auto" }}>
            No messages recorded in this conversation yet.
          </div>
        ) : (
          messages.map((msg) => {
            const isCustomer = msg.sender === "customer";
            const time = formatMessageTime(msg.createdAt);

            return (
              <div
                key={msg.id}
                className="inbox-message"
                data-sender={msg.sender}
              >
                <div className="inbox-bubble" dir="auto">
                  {msg.text}
                </div>

                <div className="inbox-message-meta">
                  <span>{time}</span>
                  {!isCustomer && (
                    <span className="inbox-source-tag">
                      {msg.source === "staff_approved_ai" ? (
                        <>
                          <Bot size={11} />
                          AI Approved
                        </>
                      ) : (
                        "Staff Manual"
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={streamEndRef} />
      </div>

      {/* Composer */}
      <form className="inbox-thread-composer" onSubmit={handleSend}>
        <div style={{ display: "flex", gap: 8 }}>
          <textarea
            className="inbox-draft-textarea"
            style={{ minHeight: 64, maxHeight: 120 }}
            aria-label="Reply to customer"
            maxLength={4000}
            disabled={isSending || conversation.channel !== "storefront"}
            placeholder="Type a manual staff reply…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
        </div>

        <div className="inbox-composer-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={onGenerateDraft}
            disabled={isGenerating}
            style={{ fontSize: 12.5 }}
          >
            <Sparkles size={14} color="var(--brand)" />
            {isGenerating ? "Drafting with live context…" : "Generate AI draft"}
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={
              !inputText.trim() ||
              isSending ||
              conversation.channel !== "storefront"
            }
            style={{ fontSize: 12.5 }}
          >
            <Send size={13} />
            {isSending ? "Sending…" : "Send message"}
          </Button>
        </div>
      </form>
    </section>
  );
}
