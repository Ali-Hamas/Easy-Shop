"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, RefreshCw, Send } from "lucide-react";
import { Drawer } from "@/components/ui/overlays";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/client";
import "@/styles/storefront-chat.css";

type Message = {
  id: string;
  sender: "customer" | "staff";
  text: string;
  createdAt: string;
};
export function StorefrontChat({
  subdomain,
  shopName,
}: {
  subdomain: string;
  shopName: string;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("storefront_chat_name") || "";
    }
    return "";
  });
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pending = useRef<{
    requestId: string;
    name: string;
    text: string;
  } | null>(null);
  const base = `storefront/${encodeURIComponent(subdomain)}/chat`;

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await apiRequest<{ messages: Message[] }>(
          `${base}/messages`,
          { signal },
        );
        setMessages(response.messages);
      } catch (err) {
        if (!signal?.aborted) {
          throw err;
        }
      }
    },
    [base],
  );

  // Auto-scroll to newest message
  useEffect(() => {
    if (open && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  // Real-time polling without manual refresh button
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        if (!document.hidden) {
          await refresh(controller.signal);
        }
      } catch {
        // Silent recovery on polling tick
      }
      if (!controller.signal.aborted) {
        timer = setTimeout(poll, 1800);
      }
    }

    apiRequest(`${base}/session`, {
      method: "POST",
      body: {},
      signal: controller.signal,
    })
      .then(() => {
        if (!controller.signal.aborted) {
          setReady(true);
          void poll();
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error ? e.message : "Chat could not be opened.",
          );
        }
      });

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, base, refresh]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !ready || !text.trim() || name.trim().length < 2) return;
    const submission = { name: name.trim(), text: text.trim() };

    // Remember name for future messages
    if (typeof window !== "undefined") {
      localStorage.setItem("storefront_chat_name", submission.name);
    }

    if (
      !pending.current ||
      pending.current.name !== submission.name ||
      pending.current.text !== submission.text
    ) {
      pending.current = { ...submission, requestId: crypto.randomUUID() };
    }

    setBusy(true);
    setError("");

    try {
      const response = await apiRequest<{ message: Message }>(
        `${base}/messages`,
        { method: "POST", body: pending.current },
      );
      setMessages((current) =>
        current.some((m) => m.id === response.message.id)
          ? current
          : [...current, response.message],
      );
      pending.current = null;
      setText("");

      // Trigger instant refresh to ensure server synchronization
      void refresh().catch(() => {});
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Message could not be sent. Your text is still here.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function manualSync() {
    setIsRefreshing(true);
    setError("");
    try {
      await refresh();
    } catch {
      setError("Could not refresh messages.");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <>
      <button
        className="store-chat-trigger storefront-chat-launcher"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <MessageCircle size={18} /> Message the shop
      </button>

      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={`Message ${shopName}`}
        description="Direct private conversation with the store. Updates in real-time."
      >
        <div className="store-chat">
          {/* Live auto-updating status bar */}
          <div className="store-chat-status-bar">
            <div className="store-chat-live-indicator">
              <span className="live-dot-pulse" />
              <span className="live-status-text">
                {ready ? "Live connected" : "Connecting…"}
              </span>
            </div>
            <div className="store-chat-status-actions">
              <span className="store-chat-auto-sync-hint">
                Auto-updates in real time
              </span>
              <button
                type="button"
                className="store-chat-icon-sync-btn"
                title="Sync messages now"
                onClick={manualSync}
                disabled={isRefreshing || !ready}
              >
                <RefreshCw
                  size={13}
                  className={isRefreshing ? "spin-sync" : ""}
                />
              </button>
            </div>
          </div>

          <div
            className="store-chat-messages"
            role="log"
            aria-label="Messages"
            aria-live="polite"
          >
            {!messages.length && (
              <div className="store-chat-empty-hint">
                <MessageCircle size={28} strokeWidth={1.5} />
                <p>
                  {ready
                    ? "Ask about a product, size or availability. The shop will reply here automatically."
                    : "Opening your private conversation…"}
                </p>
              </div>
            )}
            {messages.map((message) => (
              <article key={message.id} data-sender={message.sender}>
                <div className="chat-msg-header">
                  <span className="chat-msg-author">
                    {message.sender === "customer" ? "You" : shopName}
                  </span>
                  <time dateTime={message.createdAt} className="chat-msg-time">
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p dir="auto" className="chat-msg-text">
                  {message.text}
                </p>
              </article>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <p role="alert" className="store-chat-error">
              {error}
            </p>
          )}

          <form onSubmit={send} className="store-chat-form">
            <div className="store-chat-input-group">
              <label htmlFor="buyer-name">Your name</label>
              <input
                id="buyer-name"
                autoComplete="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={100}
                required
                disabled={busy}
              />
            </div>

            <div className="store-chat-input-group">
              <label htmlFor="buyer-message">Message</label>
              <textarea
                id="buyer-message"
                placeholder="Type your question for the shop..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={4000}
                required
                disabled={busy}
              />
            </div>

            <Button
              type="submit"
              loading={busy}
              disabled={!ready || !text.trim() || name.trim().length < 2}
              className="store-chat-send-btn"
            >
              <Send size={15} /> Send message
            </Button>
          </form>
        </div>
      </Drawer>
    </>
  );
}
