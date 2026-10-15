"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  FileText,
  ShieldCheck,
  UserRound,
  ArrowUpRight,
  Check,
  Pause,
  AlignLeft,
} from "lucide-react";
import type { ReactNode } from "react";
import { duration, ease } from "@/config/motion";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/display";
import { cn } from "@/lib/utils";
export function AIAccent({
  size = "default",
}: {
  size?: "sm" | "default" | "lg";
}) {
  return (
    <span className={cn("ai-accent", `ai-accent-${size}`)} aria-hidden>
      <Sparkles
        size={size === "sm" ? 16 : size === "lg" ? 24 : 18}
        strokeWidth={1.6}
      />
    </span>
  );
}
export function AILabel({
  children = "AI assistant",
}: {
  children?: ReactNode;
}) {
  return (
    <span className="ai-label">
      <AIAccent size="sm" />
      {children}
    </span>
  );
}
export function AISource({
  name,
  detail,
  onOpen,
}: {
  name: string;
  detail?: string;
  onOpen?: () => void;
}) {
  const content = (
    <>
      <FileText size={13} aria-hidden />
      <span>{name}</span>
      {detail && <span className="source-detail">{detail}</span>}
      {onOpen && <ArrowUpRight size={12} aria-hidden />}
    </>
  );
  return onOpen ? (
    <button className="ai-source" onClick={onOpen}>
      {content}
    </button>
  ) : (
    <span className="ai-source">{content}</span>
  );
}
export function AIConfidence({
  level,
  reason,
}: {
  level: "high" | "review" | "missing";
  reason: string;
}) {
  return (
    <div className="ai-confidence">
      <span className="confidence-mark" aria-hidden>
        {[0, 1, 2].map((i) => (
          <i
            key={i}
            data-filled={
              i < (level === "high" ? 3 : level === "review" ? 2 : 0)
            }
          />
        ))}
      </span>
      <span>
        {level === "high"
          ? "High confidence"
          : level === "review"
            ? "Needs verification"
            : "Insufficient information"}
      </span>
      <span className="confidence-reason">{reason}</span>
    </div>
  );
}
const states = {
  idle: { label: "Ready to assist", icon: Sparkles },
  thinking: { label: "Preparing a reply…", icon: AlignLeft },
  draft: { label: "Draft ready for review", icon: Check },
  approval: { label: "Approval required", icon: ShieldCheck },
  handoff: { label: "Needs a human", icon: UserRound },
  paused: { label: "AI paused", icon: Pause },
} as const;
export type AIPresentationState = keyof typeof states;
export function AIStateIndicator({ state }: { state: AIPresentationState }) {
  const reduced = useReducedMotion();
  const { label, icon: Icon } = states[state];
  return (
    <div className="ai-state" role="status" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={reduced ? false : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: reduced ? 0 : duration.micro, ease }}
        >
          <Icon size={15} />
          {label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
export function AIContent({
  title,
  children,
  sources,
  footer,
}: {
  title: string;
  children: ReactNode;
  sources?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="ai-content">
      <div className="ai-content-heading">
        <AILabel>{title}</AILabel>
        <span className="meta">AI-generated draft</span>
      </div>
      <div className="ai-content-copy" dir="auto">
        {children}
      </div>
      {sources && <div className="ai-sources">{sources}</div>}
      {footer && <div className="ai-content-footer">{footer}</div>}
    </section>
  );
}
export function AISuggestion({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ai-suggestion">
      <AIAccent />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function AIActionReview({
  title,
  description,
  onReview,
}: {
  title: string;
  description: string;
  onReview: () => void;
}) {
  return (
    <div className="approval-pattern">
      <div>
        <StatusBadge tone="warning">Approval required</StatusBadge>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <Button variant="secondary" onClick={onReview}>
        Review action
        <ArrowUpRight size={14} />
      </Button>
    </div>
  );
}
export function HumanHandoff({
  reason,
  assignee,
}: {
  reason: string;
  assignee: string;
}) {
  return (
    <div className="handoff-pattern">
      <span className="handoff-icon">
        <UserRound size={17} />
      </span>
      <div>
        <strong>Hand off to {assignee}</strong>
        <p>{reason}</p>
      </div>
      <StatusBadge>Needs a human</StatusBadge>
    </div>
  );
}
