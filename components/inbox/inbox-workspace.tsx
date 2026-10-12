"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { Inbox, RefreshCw, AlertCircle, Camera, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rememberedShop, subscribeShop } from "@/adapters/commerce";
import { inboxService } from "@/services/inbox";
import { ConversationList } from "./conversation-list";
import { ConversationThread } from "./conversation-thread";
import { AiReplyPanel } from "./ai-reply-panel";
import type {
  ConversationSummary,
  ConversationMessage,
  ConversationCustomerContext,
  AiDraft,
  ChannelConnection,
} from "@/types/inbox";

export function InboxWorkspace() {
  const router = useRouter();
  const requests = useRef(new Map<string, string>());
  const requestFor = (key: string) => {
    const id = requests.current.get(key) ?? crypto.randomUUID();
    requests.current.set(key, id);
    return id;
  };
  const shopId = useSyncExternalStore(
    subscribeShop,
    rememberedShop,
    () => null,
  );

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationSummary | null>(null);
  const [customer, setCustomer] = useState<ConversationCustomerContext | null>(
    null,
  );
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [latestDraft, setLatestDraft] = useState<AiDraft | null>(null);
  const [channels, setChannels] = useState<ChannelConnection[]>([]);

  const [panel, setPanel] = useState("list");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [aiStatusFilter, setAiStatusFilter] = useState("all");

  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [isConnectingMeta, setIsConnectingMeta] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("meta");
    if (result === "failed")
      setErrorMessage("Facebook and Instagram connection did not finish.");
    if (result) router.replace("/inbox");
  }, [router]);

  // Load conversation list
  useEffect(() => {
    if (!shopId) return;
    const ac = new AbortController();
    const timer = setTimeout(() => {
      setIsLoadingList(true);
      const query: Record<string, string | number> = {
        q: search,
        channel: channelFilter,
        aiStatus: aiStatusFilter,
        limit: 50,
      };
      inboxService
        .listConversations(shopId, query, ac.signal)
        .then((res) => {
          if (ac.signal.aborted) return;
          setConversations(res.conversations);
          setSelectedId((prev) =>
            prev && res.conversations.some((c) => c.id === prev)
              ? prev
              : res.conversations[0]?.id || null,
          );
        })
        .catch((err: unknown) => {
          if (ac.signal.aborted) return;
          const message =
            err instanceof Error
              ? err.message
              : "Failed to load conversations.";
          setErrorMessage(message);
        })
        .finally(() => {
          if (!ac.signal.aborted) setIsLoadingList(false);
        });
    }, 200);

    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [shopId, search, channelFilter, aiStatusFilter]);

  useEffect(() => {
    if (!shopId) return;
    const ac = new AbortController();
    inboxService
      .listChannels(shopId, ac.signal)
      .then((res) => {
        if (!ac.signal.aborted) setChannels(res.channels);
      })
      .catch(() => {
        if (!ac.signal.aborted) setChannels([]);
      });
    return () => ac.abort();
  }, [shopId]);

  // Load selected conversation details
  useEffect(() => {
    if (!shopId || !selectedId) {
      const timer = setTimeout(() => {
        setSelectedConversation(null);
        setCustomer(null);
        setMessages([]);
        setLatestDraft(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    const ac = new AbortController();
    const timer = setTimeout(() => {
      setErrorMessage(null);
      inboxService
        .getConversation(shopId, selectedId, ac.signal)
        .then((data) => {
          if (ac.signal.aborted) return;
          setSelectedConversation(data.conversation);
          setCustomer(data.customer);
          setMessages(data.messages);
          setLatestDraft(data.latestDraft);
        })
        .catch((err: unknown) => {
          if (ac.signal.aborted) return;
          const message =
            err instanceof Error
              ? err.message
              : "Failed to load conversation details.";
          setErrorMessage(message);
        });
    }, 0);

    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [shopId, selectedId]);

  // Manual refresh helper
  const reloadConversations = useCallback(
    async (targetSelectedId?: string) => {
      if (!shopId) return;
      setIsLoadingList(true);
      try {
        const query: Record<string, string | number> = {
          q: search,
          channel: channelFilter,
          aiStatus: aiStatusFilter,
          limit: 50,
        };
        const res = await inboxService.listConversations(shopId, query);
        setConversations(res.conversations);
        if (targetSelectedId) {
          const detail = await inboxService.getConversation(
            shopId,
            targetSelectedId,
          );
          setSelectedId(targetSelectedId);
          setSelectedConversation(detail.conversation);
          setMessages(detail.messages);
          setCustomer(detail.customer);
          setLatestDraft(detail.latestDraft);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to reload conversations.";
        setErrorMessage(message);
      } finally {
        setIsLoadingList(false);
      }
    },
    [shopId, search, channelFilter, aiStatusFilter],
  );

  // Send manual staff message
  const handleSendMessage = async (text: string) => {
    if (
      !shopId ||
      !selectedId ||
      selectedConversation?.id !== selectedId ||
      selectedConversation.shopId !== shopId
    )
      return;
    setIsSending(true);
    setErrorMessage(null);
    try {
      const newMsg = await inboxService.addMessage(
        shopId,
        selectedId,
        { sender: "staff", text },
        crypto.randomUUID(),
      );
      setMessages((prev) => [...prev, newMsg]);
      reloadConversations(selectedId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send message.";
      setErrorMessage(message);
      throw err;
    } finally {
      setIsSending(false);
    }
  };

  // Generate AI draft
  const handleGenerateDraft = async () => {
    if (
      !shopId ||
      !selectedId ||
      selectedConversation?.id !== selectedId ||
      selectedConversation.shopId !== shopId
    )
      return;
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const latestCustomerMsg = [...messages]
        .reverse()
        .find((m) => m.sender === "customer");
      const draft = await inboxService.generateDraft(
        shopId,
        selectedId,
        latestCustomerMsg?.id,
        crypto.randomUUID(),
      );
      setLatestDraft(draft);
      setPanel("draft");
      reloadConversations(selectedId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate AI draft.";
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Edit draft text
  const handleEditDraft = async (editedText: string) => {
    if (!shopId || !selectedId || !latestDraft) return;
    setIsSubmittingDraft(true);
    setErrorMessage(null);
    try {
      const updated = await inboxService.editDraft(
        shopId,
        selectedId,
        latestDraft.id,
        editedText,
        latestDraft.version,
      );
      setLatestDraft(updated);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save draft edits.";
      setErrorMessage(message);
      throw err;
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  // Approve draft (Separate Step!)
  const handleApproveDraft = async (draftId: string) => {
    if (
      !shopId ||
      !selectedId ||
      selectedConversation?.id !== selectedId ||
      selectedConversation.shopId !== shopId
    )
      return;
    setIsSubmittingDraft(true);
    setErrorMessage(null);
    try {
      const draft = latestDraft?.id === draftId ? latestDraft : null;
      if (!draft) return;
      const approved = await inboxService.approveDraft(
        shopId,
        selectedId,
        draftId,
        crypto.randomUUID(),
        draft.version,
      );
      setLatestDraft(approved);
      reloadConversations(selectedId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to approve draft.";
      setErrorMessage(message);
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  // Reject draft
  const handleRejectDraft = async (draftId: string, reason?: string) => {
    if (
      !shopId ||
      !selectedId ||
      selectedConversation?.id !== selectedId ||
      selectedConversation.shopId !== shopId
    )
      return;
    setIsSubmittingDraft(true);
    setErrorMessage(null);
    try {
      const rejected = await inboxService.rejectDraft(
        shopId,
        selectedId,
        draftId,
        reason,
      );
      setLatestDraft(rejected);
      reloadConversations(selectedId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to reject draft.";
      setErrorMessage(message);
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  // Send approved draft (Dispatches reply to message thread)
  const handleSendApprovedDraft = async (draftId: string) => {
    if (
      !shopId ||
      !selectedId ||
      selectedConversation?.id !== selectedId ||
      selectedConversation.shopId !== shopId
    )
      return;
    setIsSubmittingDraft(true);
    setErrorMessage(null);
    try {
      const res = await inboxService.sendApprovedDraft(
        shopId,
        selectedId,
        draftId,
        requestFor(`${shopId}:${selectedId}:send:${draftId}`),
      );
      setMessages((prev) => [...prev, res.message]);
      if (latestDraft?.id === draftId) {
        setLatestDraft({
          ...latestDraft,
          status: "sent",
          sentAt: res.draft.sentAt,
        });
      }
      reloadConversations(selectedId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to dispatch reply.";
      setErrorMessage(message);
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  const handleOpenCustomer = (customerId: string) => {
    router.push(`/customers?id=${encodeURIComponent(customerId)}`);
  };

  const metaChannel = channels.find((c) => c.provider === "meta");
  const metaStatus = metaChannel?.status ?? "skipped";

  const handleConnectMeta = async () => {
    if (!shopId) return;
    setIsConnectingMeta(true);
    setErrorMessage(null);
    try {
      const res = await inboxService.requestMetaConnection(shopId);
      setChannels(res.channels);
      window.location.assign(res.authUrl);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to request Facebook and Instagram connection.",
      );
    } finally {
      setIsConnectingMeta(false);
    }
  };

  return (
    <div className="inbox-workspace" data-panel={panel}>
      {/* Workspace Header */}
      <header className="inbox-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Inbox size={22} color="var(--brand)" />
            <h1>Customer Inquiries & AI Replies</h1>
          </div>
          <p>
            Storefront messaging. Review, edit, approve, and send grounded
            replies.
          </p>
        </div>

        <div className="inbox-header-meta">
          <div className="inbox-channel-status" data-status={metaStatus}>
            <Camera size={15} />
            <span>Facebook + Instagram</span>
            <strong>{metaStatus}</strong>
          </div>
          <Button
            variant="ghost"
            onClick={() => reloadConversations(selectedId ?? undefined)}
            disabled={isLoadingList}
            title="Refresh conversations"
          >
            <RefreshCw
              size={14}
              className={isLoadingList ? "animate-spin" : ""}
            />
            Refresh
          </Button>
        </div>
      </header>

      {/* Error notification banner */}
      {errorMessage && (
        <div
          className="inbox-alert-banner inbox-alert-warning"
          style={{ marginBottom: 4 }}
          role="alert"
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setErrorMessage(null)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      <section className="inbox-connect-panel" aria-label="Channel connection">
        <div>
          <span className="inbox-connect-eyebrow">
            Combined social inbox
          </span>
          <h2>Connect Facebook pages and Instagram</h2>
          <p>
            Messenger, Instagram DM and storefront chats appear together in this
            inbox. Use filters when you need one channel.
          </p>
        </div>
        <Button
          variant={metaStatus === "connected" ? "secondary" : "primary"}
          disabled={!shopId || isConnectingMeta}
          onClick={handleConnectMeta}
        >
          <Link2 size={15} />
          {metaStatus === "connected"
            ? "Connected"
            : metaStatus === "pending"
              ? "Connection pending"
              : "Connect Facebook & Instagram"}
        </Button>
      </section>

      <nav className="inbox-mobile-panels" aria-label="Inbox view">
        {[["list", "Conversations"], ["thread", "Messages"], ["draft", "AI review"]].map(([value, label]) => <Button key={value} variant={panel === value ? "primary" : "secondary"} aria-pressed={panel === value} disabled={value !== "list" && !selectedId} onClick={() => setPanel(value)}>{label}</Button>)}
      </nav>
      {/* 3-Column Desktop Layout */}
      <div className="inbox-layout">
        {/* Left Column: Conversation List */}
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setPanel("thread"); }}
          search={search}
          onSearchChange={setSearch}
          channelFilter={channelFilter}
          onChannelFilterChange={setChannelFilter}
          aiStatusFilter={aiStatusFilter}
          onAiStatusFilterChange={setAiStatusFilter}
          isLoading={isLoadingList}
        />

        {/* Center Column: Conversation Thread */}
        <ConversationThread
          key={selectedId}
          conversation={
            selectedConversation?.id === selectedId &&
            selectedConversation.shopId === shopId
              ? selectedConversation
              : null
          }
          customer={
            selectedConversation?.id === selectedId &&
            selectedConversation.shopId === shopId
              ? customer
              : null
          }
          messages={messages}
          onSendMessage={handleSendMessage}
          onGenerateDraft={handleGenerateDraft}
          onOpenCustomer={handleOpenCustomer}
          isSending={isSending}
          isGenerating={isGenerating}
        />

        <AiReplyPanel
          draft={latestDraft}
          customer={customer}
          onGenerate={handleGenerateDraft}
          onEdit={handleEditDraft}
          onApprove={handleApproveDraft}
          onReject={handleRejectDraft}
          onSendApproved={handleSendApprovedDraft}
          isGenerating={isGenerating}
          isSubmitting={isSubmittingDraft}
        />
      </div>
    </div>
  );
}
