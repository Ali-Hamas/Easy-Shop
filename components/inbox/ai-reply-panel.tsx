"use client";

import { useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  Send,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/display";
import {
  AILabel,
  AIStateIndicator,
  AIConfidence,
  AISource,
} from "@/components/ai/ai-primitives";
import {
  draftStatusLabels,
  draftStatusTone,
  confidenceRationale,
} from "@/adapters/inbox";
import type { AiDraft, ConversationCustomerContext } from "@/types/inbox";

interface AiReplyPanelProps {
  draft: AiDraft | null;
  customer: ConversationCustomerContext | null;
  onGenerate: () => Promise<void>;
  onEdit: (text: string) => Promise<void>;
  onApprove: (draftId: string) => Promise<void>;
  onReject: (draftId: string, reason?: string) => Promise<void>;
  onSendApproved: (draftId: string) => Promise<void>;
  isGenerating: boolean;
  isSubmitting: boolean;
}

function DraftEditorBox({
  draft,
  onEdit,
  onApprove,
  onReject,
  onSendApproved,
  onGenerate,
  isGenerating,
  isSubmitting,
}: {
  draft: AiDraft;
  onEdit: (text: string) => Promise<void>;
  onApprove: (draftId: string) => Promise<void>;
  onReject: (draftId: string, reason?: string) => Promise<void>;
  onSendApproved: (draftId: string) => Promise<void>;
  onGenerate: () => Promise<void>;
  isGenerating: boolean;
  isSubmitting: boolean;
}) {
  const [editText, setEditText] = useState(
    draft.editedText ?? draft.originalText,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const isApproved = draft.status === "approved";
  const isSent = draft.status === "sent";
  const isRejected = draft.status === "rejected";
  const canSend = isApproved || draft.status === "send_failed";

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    try {
      await onEdit(editText.trim());
      setIsEditing(false);
    } catch {
      /* Keep edits visible; the workspace reports the error. */
    }
  };

  return (
    <div className="inbox-draft-editor-box">
      <p className="inbox-provider-note">
        {draft.provider === "openai" ? "AI-generated draft · Human review required" : "Fallback draft · Verify the facts and language before approval"}
      </p>
      {!isEditing && ["ready", "edited"].includes(draft.status) && (
        <Button variant="secondary" disabled={isSubmitting} onClick={() => setIsEditing(true)}>Edit draft</Button>
      )}
      {isEditing ? (
        <>
          <textarea
            className="inbox-draft-textarea"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            aria-label="Edit draft reply"
            maxLength={4000}
            placeholder="Edit draft text before approval…"
            dir="auto"
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button
              variant="ghost"
              onClick={() => {
                setEditText(draft.editedText ?? draft.originalText);
                setIsEditing(false);
              }}
              style={{ fontSize: 12 }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveEdit}
              disabled={isSubmitting}
              style={{ fontSize: 12 }}
            >
              Save edits
            </Button>
          </div>
        </>
      ) : (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--text)",
            whiteSpace: "pre-wrap",
          }}
          dir="auto"
        >
          {draft.editedText ?? draft.originalText}
        </div>
      )}

      {/* SEPARATE APPROVE FROM SEND ACTION BUTTONS */}
      {!isSent && !isRejected && (
        <div className="inbox-draft-actions-bar">
          <div className="inbox-draft-actions-primary">
            {/* Step 1: Approve Draft */}
            {!isApproved ? (
              <Button
                variant="secondary"
                onClick={() => onApprove(draft.id)}
                disabled={isSubmitting || isEditing}
                style={{ flex: 1, fontSize: 12.5 }}
              >
                <Check size={14} color="var(--success, #2da44e)" />
                Approve draft
              </Button>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--success, #2da44e)",
                  fontSize: 12.5,
                  fontWeight: 500,
                  padding: "6px 0",
                }}
              >
                <ShieldCheck size={16} />
                Approved by the shop owner
              </div>
            )}

            {/* Step 2: Explicit Send (blocked if unapproved!) */}
            <Button
              variant="primary"
              onClick={() => onSendApproved(draft.id)}
              disabled={!canSend || isSubmitting}
              style={{ flex: 1, fontSize: 12.5 }}
              title={
                canSend
                  ? "Dispatch approved reply to customer"
                  : "Draft must be approved first before sending"
              }
            >
              <Send size={13} />
              Send approved reply
            </Button>
          </div>

          {/* Reject Option */}
          {!showRejectInput ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 4,
              }}
            >
              <Button
                variant="ghost"
                onClick={onGenerate}
                disabled={isGenerating || isSubmitting}
                style={{ fontSize: 11.5, padding: "2px 6px" }}
              >
                <RefreshCw size={12} />
                Regenerate
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowRejectInput(true)}
                style={{
                  fontSize: 11.5,
                  color: "var(--danger)",
                  padding: "2px 6px",
                }}
              >
                <XCircle size={12} />
                Reject draft
              </Button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 4,
              }}
            >
              <input
                type="text"
                className="inbox-draft-textarea"
                style={{ minHeight: "auto", padding: "6px 8px", fontSize: 12 }}
                placeholder="Optional reason for rejection…"
                aria-label="Reason for rejection"
                maxLength={1000}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <div
                style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}
              >
                <Button
                  variant="ghost"
                  onClick={() => setShowRejectInput(false)}
                  style={{ fontSize: 11.5 }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => onReject(draft.id, rejectionReason)}
                  disabled={isSubmitting}
                  style={{ fontSize: 11.5 }}
                >
                  Confirm rejection
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {isSent && (
        <div className="inbox-alert-banner inbox-alert-success">
          <ShieldCheck size={16} />
          <span>Approved reply sent to customer thread.</span>
        </div>
      )}

      {isRejected && (
        <div className="inbox-alert-banner inbox-alert-warning">
          <XCircle size={16} />
          <span>
            Draft was rejected
            {draft.rejectionReason ? `: "${draft.rejectionReason}"` : "."}
          </span>
        </div>
      )}
    </div>
  );
}

export function AiReplyPanel({
  draft,
  customer,
  onGenerate,
  onEdit,
  onApprove,
  onReject,
  onSendApproved,
  isGenerating,
  isSubmitting,
}: AiReplyPanelProps) {
  const isApproved = draft?.status === "approved";

  return (
    <aside
      className="inbox-assist-col"
      aria-label="AI Assistance and Customer Context"
    >
      {/* 1. Header & AI State */}
      <section className="inbox-assist-section">
        <div className="inbox-assist-section-title">
          <AILabel>AI Grounded Reply</AILabel>
          {draft && (
            <StatusBadge tone={draftStatusTone(draft.status)}>
              {draftStatusLabels[draft.status]}
            </StatusBadge>
          )}
        </div>

        <AIStateIndicator
          state={
            isGenerating
              ? "thinking"
              : !draft
                ? "idle"
                : isApproved
                  ? "approval"
                  : draft.needsHumanAttention
                    ? "handoff"
                    : "draft"
          }
        />

        {draft && (
          <AIConfidence
            level={draft.confidence}
            reason={confidenceRationale(
              draft.confidence,
              draft.contextSources.length > 0,
            )}
          />
        )}
      </section>

      {/* 2. Escalation Banner (if human attention needed) */}
      {draft?.needsHumanAttention && (
        <div className="inbox-alert-banner inbox-alert-warning" role="alert">
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Staff verification required</strong>
            <p style={{ margin: "2px 0 0 0" }}>
              {draft.escalationReason ||
                "Customer inquiry involves return, exchange, or special policy exceptions."}
            </p>
          </div>
        </div>
      )}

      {/* 3. Reply Rationale (renamed from reasoningSummary - concise, zero chain-of-thought) */}
      {draft?.groundingSummary && (
        <section className="inbox-assist-section">
          <span className="inbox-assist-section-title">Reply rationale</span>
          <div className="inbox-rationale-box">{draft.groundingSummary}</div>
        </section>
      )}

      {/* 4. Verified Context Sources (Customer facts, Product stock, Policy) */}
      {draft && draft.contextSources.length > 0 && (
        <section className="inbox-assist-section">
          <span className="inbox-assist-section-title">Grounded facts</span>
          <div className="inbox-sources-list">
            {draft.contextSources.map((source, i) => (
              <AISource
                key={`${source.type}-${source.name}-${i}`}
                name={source.name}
                detail={source.detail}
              />
            ))}
          </div>
        </section>
      )}

      {/* 5. Draft Review & Lifecycle Operations */}
      <section className="inbox-assist-section">
        <div className="inbox-assist-section-title">
          <span>Reply Draft</span>
        </div>

        {!draft ? (
          <div style={{ textAlign: "center", padding: "16px 8px" }}>
            <p className="inbox-item-snippet" style={{ marginBottom: 12 }}>
              No active draft for this inquiry. Generate a grounded response
              using live customer and inventory facts.
            </p>
            <Button
              variant="secondary"
              onClick={onGenerate}
              disabled={isGenerating}
              style={{ width: "100%" }}
            >
              <Sparkles size={14} color="var(--brand)" />
              {isGenerating ? "Drafting…" : "Generate AI draft"}
            </Button>
          </div>
        ) : (
          <DraftEditorBox
            key={draft.id}
            draft={draft}
            onEdit={onEdit}
            onApprove={onApprove}
            onReject={onReject}
            onSendApproved={onSendApproved}
            onGenerate={onGenerate}
            isGenerating={isGenerating}
            isSubmitting={isSubmitting}
          />
        )}
      </section>

      {/* 6. Customer Facts (Strict Zero-Fabrication Rule) */}
      {customer && (
        <section className="inbox-assist-section">
          <span className="inbox-assist-section-title">
            Verified Customer Facts
          </span>
          <div>
            <div className="inbox-customer-fact-row">
              <span className="inbox-customer-fact-label">Name</span>
              <span className="inbox-customer-fact-val">{customer.name}</span>
            </div>
            {customer.phone && (
              <div className="inbox-customer-fact-row">
                <span className="inbox-customer-fact-label">Phone</span>
                <span className="inbox-customer-fact-val">
                  {customer.phone}
                </span>
              </div>
            )}
            {customer.email && (
              <div className="inbox-customer-fact-row">
                <span className="inbox-customer-fact-label">Email</span>
                <span className="inbox-customer-fact-val">
                  {customer.email}
                </span>
              </div>
            )}
            <div className="inbox-customer-fact-row">
              <span className="inbox-customer-fact-label">
                Preferred language
              </span>
              <span className="inbox-customer-fact-val">
                {customer.language.toUpperCase()}
              </span>
            </div>
          </div>

          {customer.tags.length > 0 && (
            <div>
              <span
                className="inbox-customer-fact-label"
                style={{ fontSize: 11.5 }}
              >
                Manual tags:
              </span>
              <div className="inbox-tags-container">
                {customer.tags.map((t) => (
                  <span key={t} className="inbox-tag-pill">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {customer.staffNotes.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <span
                className="inbox-customer-fact-label"
                style={{ fontSize: 11.5 }}
              >
                Staff notes:
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  marginTop: 4,
                }}
              >
                {customer.staffNotes.map((note, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: 12,
                      padding: "4px 8px",
                      background: "var(--surface-secondary)",
                      borderRadius: 4,
                      borderLeft: "2px solid var(--brand)",
                    }}
                  >
                    {note}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </aside>
  );
}
