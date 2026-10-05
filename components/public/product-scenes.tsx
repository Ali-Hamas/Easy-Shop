"use client";
import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Store,
  Package,
  Users,
  Sparkles,
  Search,
  Check,
  MessageCircle,
  ChevronRight,
  ShieldCheck,
  Layers2,
  ArrowDown,
  FileText,
} from "lucide-react";
import { demoProducts, demoReply } from "@/config/public-demo";
export const modules = [
  { id: "dashboard", name: "Overview", icon: LayoutDashboard },
  { id: "store", name: "Storefront", icon: Store },
  { id: "inventory", name: "Inventory", icon: Package },
  { id: "customers", name: "Customers", icon: Users },
  { id: "ai", name: "AI replies", icon: Sparkles },
] as const;
export type SceneId = (typeof modules)[number]["id"];
export function Swatch({
  tone = "olive",
  small = false,
}: {
  tone?: string;
  small?: boolean;
}) {
  return (
    <div
      className={`material-swatch material-${tone} ${small ? "swatch-small" : ""}`}
      aria-hidden="true"
    >
      {["olive", "chalk", "natural"].includes(tone) ? (
        <Image
          src={
            tone === "olive"
              ? "/images/olive-tote.webp"
              : tone === "chalk"
                ? "/images/weekend-shirt.svg"
                : "/images/natural-tote.svg"
          }
          alt=""
          fill
          sizes={small ? "40px" : "(max-width: 600px) 160px, 360px"}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <>
          <span />
          <span />
          <span />
        </>
      )}
    </div>
  );
}
export function InventoryScene({
  interactive = false,
}: {
  interactive?: boolean;
}) {
  const [selected, setSelected] = useState("shirt");
  return (
    <div className="inventory-scene">
      <div className="scene-toolbar">
        <span>
          <Package size={16} /> Product library
        </span>
        <span className="quiet-label">Example inventory</span>
      </div>
      <div className="inventory-columns">
        <span>Product / variant</span>
        <span>Available</span>
        <span>Status</span>
      </div>
      {demoProducts.map((p) => (
        <motion.div
          layout
          key={p.id}
          className={`inventory-record ${interactive && selected === p.id ? "record-focused" : ""}`}
        >
          <Swatch tone={p.tone} small />
          <div>
            {interactive ? (
              <button
                className="record-select"
                onClick={() => setSelected(p.id)}
                aria-pressed={selected === p.id}
              >
                {p.name}
              </button>
            ) : (
              <strong>{p.name}</strong>
            )}
            <small>{p.variant}</small>
          </div>
          <span className="stock-number">{p.stock}</span>
          <span
            className={`scene-chip ${p.stock < 5 ? "chip-warning" : "chip-neutral"}`}
          >
            {p.stock < 5 ? "Low stock" : "Available"}
          </span>
        </motion.div>
      ))}
      {interactive && (
        <motion.div layout className="inventory-insight" role="status">
          <span className="small-symbol">
            <Package size={17} />
          </span>
          <div>
            <strong>
              {selected === "shirt"
                ? "A small detail worth your attention."
                : "A clear view of what’s available."}
            </strong>
            <p>
              {selected === "shirt"
                ? "3 in stock · Chalk / Medium. Review before replying."
                : "Variant and stock information, in the same place."}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
export function CustomerScene() {
  return (
    <div className="customer-scene">
      <div className="scene-toolbar">
        <span>
          <Users size={16} /> Customer context
        </span>
        <span className="quiet-label">Fictional profile</span>
      </div>
      <div className="customer-identity">
        <span className="identity-disc">NA</span>
        <div>
          <p className="customer-name">Nadia Ahmed</p>
          <p>Customer profile preview</p>
        </div>
        <span className="scene-chip chip-neutral">Returning</span>
      </div>
      <div className="customer-details">
        <div>
          <small>Recent conversation</small>
          <p>Asked about the olive tote</p>
        </div>
        <div>
          <small>Order context</small>
          <p>No connected order history</p>
        </div>
      </div>
      <div className="customer-note">
        <FileText size={16} />
        <div>
          <strong>A note for the next conversation</strong>
          <p>
            Prefers earthy colours. Check sizing together before confirming.
          </p>
        </div>
      </div>
      <div className="activity-trail">
        <span />
        <p>
          <strong>Conversation context</strong>
          <small>Product interest: Everyday tote</small>
        </p>
      </div>
    </div>
  );
}
export function StoreScene({ phone = false }: { phone?: boolean }) {
  return (
    <div className={`store-scene ${phone ? "store-phone" : ""}`}>
      <div className="store-masthead">
        <span>sunday studio</span>
        <span>{phone ? "☰" : "Shop / Our story"}</span>
      </div>
      <div className="store-cover">
        <p>
          Things you’ll
          <br />
          reach for, daily.
        </p>
        <div className="store-material">
          <Swatch tone="olive" />
        </div>
        <span>The everyday collection</span>
      </div>
      <div className="store-item">
        <div>
          <strong>Everyday tote</strong>
          <p>Olive / One size</p>
        </div>
        <span>৳ 850</span>
      </div>
      <div className="store-lineup">
        <Swatch tone="chalk" />
        <Swatch tone="natural" />
        <Swatch tone="olive" />
      </div>
    </div>
  );
}
export function ReplyScene() {
  return (
    <div className="compact-reply">
      <div className="scene-toolbar">
        <span>
          <Sparkles size={16} /> Suggested reply
        </span>
        <span className="scene-chip">Review first</span>
      </div>
      <p>{demoReply}</p>
      <div className="reply-source">
        <Package size={14} /> Everyday tote <span>24 available</span>
      </div>
      <div className="reply-review">
        <ShieldCheck size={14} /> Your approval before send
      </div>
    </div>
  );
}
function Overview() {
  return (
    <div className="overview-scene">
      <div className="overview-heading">
        <div>
          <small>Sunday Studio / Your workspace</small>
          <h2>A little clarity for today.</h2>
        </div>
        <span className="scene-chip chip-neutral">Illustrative data</span>
      </div>
      <div className="overview-stats">
        <div>
          <small>Products in this example</small>
          <strong>
            03<span>styles & variants</span>
          </strong>
        </div>
        <div>
          <small>Needs a closer look</small>
          <strong>
            01<span>low-stock variant</span>
          </strong>
        </div>
        <div>
          <small>AI reply</small>
          <strong className="stat-word">
            Your review<span>before anything is sent</span>
          </strong>
        </div>
      </div>
      <div className="overview-body">
        <InventoryScene />
        <div className="overview-next">
          <span className="small-symbol">
            <MessageCircle size={19} />
          </span>
          <small>Next conversation</small>
          <h3>
            A familiar customer.
            <br />A clearer answer.
          </h3>
          <p>Nadia is asking about the everyday tote in olive.</p>
          <div>
            <span className="identity-disc small">NA</span>
            <span>
              Customer context <ChevronRight size={13} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
const context: Record<SceneId, { heading: string; copy: string }> = {
  dashboard: {
    heading: "See the day, without the noise.",
    copy: "One operational home, designed around the next useful action.",
  },
  store: {
    heading: "Your shop, with a point of view.",
    copy: "A storefront that gives your products room to speak.",
  },
  inventory: {
    heading: "An answer starts with the facts.",
    copy: "Keep product, variant and stock information in the same view.",
  },
  customers: {
    heading: "Pick up where you left off.",
    copy: "Bring the person and their previous context into the conversation.",
  },
  ai: {
    heading: "A first draft. Never the final say.",
    copy: "Product-grounded suggestions, with human review built into the flow.",
  },
};
export function WorkspaceScene({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState<SceneId>("dashboard");
  const reduced = useReducedMotion();
  return (
    <div className={`workspace-showcase ${compact ? "workspace-compact" : ""}`}>
      <h2 className="sr-only">Explore the operating system</h2>
      <div
        className="scene-module-picker"
        role="group"
        aria-label="Explore the operating system"
      >
        {modules.map((m) => (
          <button
            key={m.id}
            aria-pressed={selected === m.id}
            onClick={() => setSelected(m.id)}
          >
            <m.icon size={16} />
            <span>{m.name}</span>
            {selected === m.id && (
              <motion.span
                layoutId={compact ? "compact-module" : "hero-module"}
                className="module-underline"
                transition={{ duration: reduced ? 0 : 0.22 }}
              />
            )}
          </button>
        ))}
      </div>
      <div className="workspace-frame">
        <div className="workspace-topbar">
          <span>
            <Layers2 size={19} /> Sunday Studio <ChevronRight size={12} />
          </span>
          <span className="workspace-search">
            <Search size={13} /> Ask, find, get a little help <kbd>⌘ K</kbd>
          </span>
          <span className="identity-disc small">SS</span>
        </div>
        <div className="workspace-inside">
          <div className="workspace-iconrail" aria-hidden="true">
            {modules.map((m) => (
              <span key={m.id} className={selected === m.id ? "active" : ""}>
                <m.icon size={18} />
              </span>
            ))}
          </div>
          <div className="workspace-main">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selected}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: reduced ? 0 : 0.22 }}
              >
                {selected === "dashboard" ? (
                  <Overview />
                ) : selected === "store" ? (
                  <div className="store-tour-scene">
                    <StoreScene />
                    <div className="store-tour-copy">
                      <span className="scene-chip">Storefront concept</span>
                      <h3>
                        A shared home
                        <br />
                        for your products.
                      </h3>
                      <p>
                        Shop details <Check size={15} />
                      </p>
                      <p>
                        First product <Check size={15} />
                      </p>
                      <p>
                        Review storefront <ArrowDown size={15} />
                      </p>
                    </div>
                  </div>
                ) : selected === "inventory" ? (
                  <InventoryScene interactive />
                ) : selected === "customers" ? (
                  <CustomerScene />
                ) : (
                  <div className="ai-tour-scene">
                    <div className="buyer-message">
                      <span className="identity-disc small">N</span>
                      <p>Is the everyday tote available in olive?</p>
                    </div>
                    <ReplyScene />
                    <p className="scene-disclaimer">
                      Example only. No AI service or messaging channel is
                      connected.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="tour-explanation" aria-live="polite">
        <strong>{context[selected].heading}</strong>
        <span>{context[selected].copy}</span>
      </div>
    </div>
  );
}
