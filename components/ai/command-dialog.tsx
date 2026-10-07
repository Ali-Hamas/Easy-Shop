"use client";
import { useRef, useState } from "react";
import { ArrowUpRight, Search, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/overlays";
import { AILabel } from "./ai-primitives";
import { StatusBadge } from "@/components/ui/display";
import { releaseNavigation } from "@/config/navigation";
export function CommandDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const results = releaseNavigation.filter((n) =>
    n.label.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      className="command-modal"
      initialFocusRef={inputRef}
      metadata={<AILabel>Workspace assistant</AILabel>}
      footer={
        <div className="command-footer">
          <ShieldCheck size={15} />
          <span>Risky actions always need your approval.</span>
          <StatusBadge tone="primary">Suggest-only</StatusBadge>
        </div>
      }
      title="Ask AI to do work"
      description="Find your way around the workspace."
    >
      <div className="command-input">
        <Search size={20} />
        <input
          ref={inputRef}
          aria-label="Find a workspace"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a page or workspace…"
        />
      </div>
      <div className="ai-notice">
        <Sparkles size={18} />
        <div>
          <strong>Assistance starts with your shop data</strong>
          <p>
            AI is not connected in this preview. You can navigate pages below;
            no commands will run.
          </p>
        </div>
      </div>
      <div className="command-results">
        {results.length ? (
          results.map((n) => (
            <Link
              onClick={() => onOpenChange(false)}
              key={n.slug}
              href={`/${n.slug}`}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              <ArrowUpRight size={15} />
            </Link>
          ))
        ) : (
          <p className="muted">
            No matching pages. Try “orders” or “products”.
          </p>
        )}
      </div>
    </Modal>
  );
}
