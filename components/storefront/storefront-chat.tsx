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
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const pending = useRef<{
    requestId: string;
    name: string;
    text: string;
  } | null>(null);
  const base = `storefront/${encodeURIComponent(subdomain)}/chat`;
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const response = await apiRequest<{ messages: Message[] }>(
        `${base}/messages`,
        { signal },
      );
      setMessages(response.messages);
    },
    [base],
  );
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        if (!document.hidden) await refresh(controller.signal);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Messages could not be refreshed.",
          );
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 5000);
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
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Chat could not be opened.",
          );
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
    if (
      !pending.current ||
      pending.current.name !== submission.name ||
      pending.current.text !== submission.text
    )
      pending.current = { ...submission, requestId: crypto.randomUUID() };
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
        description="Talk directly with the shop. Replies appear here; keep this browser to return to your conversation."
      >
        <div className="store-chat">
          <p className="store-chat-note">
            Private storefront conversation. Never send payment details or
            passwords.
          </p>
          <div
            className="store-chat-messages"
            role="log"
            aria-label="Messages"
            aria-live="polite"
          >
            {!messages.length && (
              <p>
                {ready
                  ? "Ask about a product, size or availability. The shop will reply here."
                  : "Opening your private conversation…"}
              </p>
            )}
            {messages.map((message) => (
              <article key={message.id} data-sender={message.sender}>
                <span>{message.sender === "customer" ? "You" : shopName}</span>
                <p dir="auto">{message.text}</p>
                <time dateTime={message.createdAt}>
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </article>
            ))}
          </div>
          {error && (
            <p role="alert" className="store-chat-error">
              {error}
            </p>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setError("");
              if (!ready) {
                setOpen(false);
              } else
                void refresh().catch(() =>
                  setError("Messages could not be refreshed. Try again."),
                );
            }}
          >
            <RefreshCw size={15} />
            {ready ? "Refresh messages" : "Close and retry"}
          </Button>
          <form onSubmit={send}>
            <label htmlFor="buyer-name">Your name</label>
            <input
              id="buyer-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={100}
              required
              disabled={busy}
            />
            <label htmlFor="buyer-message">Message</label>
            <textarea
              id="buyer-message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={4000}
              required
              disabled={busy}
            />
            <Button
              type="submit"
              loading={busy}
              disabled={!ready || !text.trim() || name.trim().length < 2}
            >
              <Send size={16} /> Send message
            </Button>
          </form>
        </div>
      </Drawer>
    </>
  );
}
