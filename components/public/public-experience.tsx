"use client";
import { useMotionPreference as useReducedMotion } from "@/hooks/use-motion-preference";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Layers2,
  ArrowUpRight,
  Menu,
  X,
  MessageCircle,
  Package,
  Check,
  Sparkles,
  Pencil,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { demoReply } from "@/config/public-demo";
export function LaunchHeader() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    if (open) document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  const links = [
    { href: "#product", label: "Explore" },
    { href: "#story", label: "How it connects" },
    { href: "#ai-replies", label: "Human-led AI" },
  ];
  return (
    <header className="launch-header">
      <div className="launch-width launch-header-row">
        <Link className="launch-brand" href="/" aria-label="Easy Shop home">
          <Layers2 size={24} />
          <span>easy shop.</span>
        </Link>
        <nav className="launch-desktop-nav" aria-label="Public navigation">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="launch-account-links">
          <Link href="/login">Log in</Link>
          <Link href="/register" className="launch-button compact">
            Get started <ArrowUpRight size={15} />
          </Link>
        </div>
        <button
          ref={button}
          className="launch-menu-toggle"
          aria-expanded={open}
          aria-controls="launch-mobile-nav"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="launch-mobile-nav"
            className="launch-mobile-nav"
            aria-label="Mobile public navigation"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduced ? 0 : 0.24 }}
          >
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
            <Link href="/login">Log in</Link>
            <Link href="/register">Get started</Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

export function ReplyExperience() {
  const [state, setState] = useState<
    "idle" | "drafting" | "draft" | "approved" | "complete"
  >("idle");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(demoReply);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contextStep, setContextStep] = useState(0);
  const reduced = useReducedMotion();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function draft() {
    setState("drafting");
    setEditing(false);
    setText(demoReply);
    setContextStep(1);
    timer.current = setTimeout(
      () => {
        setContextStep(2);
        timer.current = setTimeout(
          () => {
            setContextStep(3);
            setState("draft");
          },
          reduced ? 0 : 450,
        );
      },
      reduced ? 0 : 450,
    );
  }
  return (
    <div
      className="reply-experience"
      data-phase={
        state === "approved" || state === "complete" ? 4 : contextStep
      }
    >
      <div className="reply-conversation">
        <div className="scene-toolbar">
          <span>
            <MessageCircle size={17} /> Conversation
          </span>
          <span className="scene-chip chip-neutral">Example</span>
        </div>
        <div className="customer-mini">
          <span className="identity-disc">NA</span>
          <div>
            <strong>Nadia Ahmed</strong>
            <small>Customer context in view</small>
          </div>
        </div>
        <div className="conversation-divider">
          <span>Today’s example</span>
        </div>
        <p className="customer-bubble">
          Hi! Is the everyday tote available in olive?
        </p>
        <div className="conversation-source">
          <Package size={17} />
          <span>
            Everyday tote<small>Olive · 24 available · ৳ 850</small>
          </span>
          <Check size={14} />
        </div>
        <p className="small-print">
          Fictional data. This demonstration never contacts a customer or an AI
          provider.
        </p>
      </div>
      <div className="reply-workbench">
        <div
          className="reply-choreography"
          aria-label="Reply preparation stages"
        >
          {["Message", "Context", "Stock lookup", "Draft", "Approval"].map(
            (label, i) => (
              <motion.span
                key={label}
                data-active={
                  i <=
                  (state === "approved" || state === "complete"
                    ? 4
                    : contextStep)
                }
                animate={{ y: reduced ? 0 : i === contextStep ? -3 : 0 }}
                transition={{ duration: 0.18 }}
              >
                {label}
              </motion.span>
            ),
          )}
        </div>
        <div className="scene-toolbar">
          <span>
            <Sparkles size={17} /> Reply workspace
          </span>
          <span className="scene-chip">Human-led</span>
        </div>
        <div className="reply-state" aria-live="polite">
          {state === "idle"
            ? "Ready when you are."
            : state === "drafting"
              ? "Reading the example product context…"
              : state === "approved"
                ? "Reviewed. Ready for your decision."
                : state === "complete"
                  ? "Demo complete. No message was sent."
                  : "A suggestion, ready for your review."}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={
              state === "drafting"
                ? "drafting"
                : state === "idle"
                  ? "idle"
                  : "content"
            }
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.22 }}
          >
            {state === "idle" ? (
              <div className="draft-idle">
                <span className="ai-mark">
                  <Sparkles size={30} />
                </span>
                <h3>
                  Start with what
                  <br />
                  your shop knows.
                </h3>
                <p>
                  Try a supervised reply using the example product and customer
                  context.
                </p>
              </div>
            ) : state === "drafting" ? (
              <div className="draft-reading">
                <span>
                  <Check size={16} /> Product details in view
                </span>
                <span>
                  <Check size={16} /> Stock context in view
                </span>
                <span>
                  <Sparkles size={16} /> Preparing an example draft
                </span>
              </div>
            ) : (
              <div className="draft-editor">
                <label htmlFor="demo-reply">
                  {editing ? "Edit the example reply" : "Reply draft"}
                </label>
                {editing ? (
                  <textarea
                    id="demo-reply"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setState("draft");
                    }}
                    rows={4}
                    maxLength={1000}
                  />
                ) : (
                  <p>{text}</p>
                )}
                <div className="draft-citations">
                  <span>
                    <Package size={12} /> Product facts
                  </span>
                  <span>
                    <Users size={12} /> Customer context
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="reply-actions">
          {state === "idle" ? (
            <button className="launch-button" onClick={draft}>
              Try an example draft <Sparkles size={16} />
            </button>
          ) : state === "drafting" ? (
            <button className="launch-button" disabled>
              Preparing example…
            </button>
          ) : state === "complete" ? (
            <button
              className="launch-button secondary"
              onClick={() => {
                setState("idle");
                setEditing(false);
              }}
            >
              Reset the demo
            </button>
          ) : (
            <>
              <button
                className="launch-button secondary"
                onClick={() => {
                  setEditing(!editing);
                  setState("draft");
                }}
              >
                <Pencil size={14} />
                {editing ? "Finish editing" : "Edit"}
              </button>
              {state === "approved" ? (
                <button
                  className="launch-button"
                  onClick={() => setState("complete")}
                >
                  Preview send <Send size={14} />
                </button>
              ) : (
                <button
                  className="launch-button"
                  disabled={!text.trim()}
                  onClick={() => {
                    setEditing(false);
                    setState("approved");
                  }}
                >
                  Approve draft <Check size={15} />
                </button>
              )}
            </>
          )}
        </div>
        <div className="reply-guard">
          <ShieldCheck size={14} /> Approval is a review step, not a send
          action.
        </div>
      </div>
      <aside className="reply-context-sidebar">
        <span className="launch-kicker">Sources, not guesses</span>
        <h3>
          The useful
          <br />
          details stay close.
        </h3>
        <div>
          <Package size={18} />
          <strong>Product</strong>
          <p>
            Everyday tote
            <br />
            Olive / One size
          </p>
        </div>
        <div>
          <Users size={18} />
          <strong>Customer</strong>
          <p>Nadia prefers earthy colours.</p>
        </div>
        <span className="small-print">
          AI replies are in development. This is a local interaction preview.
        </span>
      </aside>
    </div>
  );
}
