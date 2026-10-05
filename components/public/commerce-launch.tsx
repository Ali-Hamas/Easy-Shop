"use client";
import Link from "next/link";
import { useMotionPreference as useReducedMotion } from "@/hooks/use-motion-preference";
import { useRef, useState } from "react";
import {
  motion,
  MotionConfig,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";
import {
  Package,
  MessageCircle,
  ShieldCheck,
  Layers2,
  Users,
  Sparkles,
  Store,
  LayoutDashboard,
} from "lucide-react";
import { StorefrontMotionScene, InventoryMotionScene } from "./motion-scenes";
import { LaunchHeader, ReplyExperience } from "./public-experience";
import { ConnectedHero, ConnectedStory } from "./connected-opening";
import { ClosingScene } from "./closing-scene";
import { WorkspaceScene, CustomerScene } from "./product-scenes";
const flow = [
  { title: "Storefront", icon: Store, copy: "Your products have a home." },
  { title: "Customer", icon: Users, copy: "A person starts the conversation." },
  {
    title: "AI Reply",
    icon: Sparkles,
    copy: "The context becomes a suggestion.",
  },
  {
    title: "Product / Inventory",
    icon: Package,
    copy: "The answer stays close to the facts.",
  },
  {
    title: "Customer Record",
    icon: Users,
    copy: "Useful context stays with the relationship.",
  },
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    copy: "The next action comes into focus.",
  },
];
function ConnectedWorkflow() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const lastStep = useRef(-1);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(5, Math.floor(v * 6));
    if (!reduced && window.innerWidth >= 1000 && next !== lastStep.current) {
      lastStep.current = next;
      setStep(next);
    }
  });
  return (
    <section id="workflow" ref={ref} className="thread-story">
      <div className="thread-pin studio-width">
        <div className="thread-heading">
          <span className="studio-label">The connected working day</span>
          <h2>
            Nothing useful
            <br />
            gets left behind.
          </h2>
          <p>
            Follow the context.
            <br />
            Keep the decision yours.
          </p>
        </div>
        <div className="thread-flow" role="group" aria-label="Explore workflow">
          <div className="thread-line">
            <motion.span
              animate={{ scaleX: step / 5 }}
              transition={{ duration: reduced ? 0 : 0.45 }}
            />
          </div>
          {flow.map((item, i) => (
            <button
              key={item.title}
              aria-pressed={i === step}
              data-complete={i <= step}
              onClick={() => setStep(i)}
            >
              <span>
                <item.icon size={26} />
                {i === step && (
                  <motion.i
                    className="flow-traveler"
                    initial={false}
                    transition={{
                      duration: reduced ? 0 : 0.32,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                )}
              </span>
              <strong>{item.title}</strong>
              <small>0{i + 1}</small>
            </button>
          ))}
        </div>
        <div className="thread-focus" aria-live="polite">
          <span>0{step + 1}</span>
          <div>
            <h3>{flow[step].title}</h3>
            <p>{flow[step].copy}</p>
          </div>
          <span className="scene-chip">Illustrative workflow</span>
        </div>
        <p className="thread-note">
          Scroll to follow the sequence, or select a step. This preview makes no
          business changes.
        </p>
      </div>
    </section>
  );
}
export default function CommerceLaunch() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="launch-site studio-site">
        <a href="#main" className="launch-skip">
          Skip to content
        </a>
        <LaunchHeader />
        <main id="main">
          <ConnectedHero />
          <ConnectedStory />
          <section id="product" className="workspace-theatre studio-width">
            <div className="theatre-title">
              <h2>Pull up your workspace.</h2>
              <p>
                Five perspectives. One shop.
                <br />
                Select a view to explore.
              </p>
            </div>
            <WorkspaceScene />
          </section>
          <StorefrontMotionScene />
          <InventoryMotionScene />
          <section className="person-editorial">
            <div className="studio-width person-layout">
              <div className="person-statement">
                <span className="studio-label">A person, not a ticket</span>
                <h2>
                  Remember
                  <br />
                  what matters.
                </h2>
                <p>Carry the useful details into the next conversation.</p>
              </div>
              <CustomerScene />
              <div className="person-margin">
                <span>NA</span>
                <p>
                  Nadia’s next question
                  <br />
                  doesn’t start from zero.
                </p>
                <small>
                  Fictional customer profile.
                  <br />
                  Illustrative customer context.
                </small>
              </div>
            </div>
          </section>
          <section id="ai-replies" className="studio-ai">
            <div className="studio-width">
              <div className="studio-ai-heading">
                <span className="studio-label">
                  <Sparkles size={18} /> Connected intelligence
                </span>
                <h2>
                  The facts are the foundation.
                  <br />
                  The final word is yours.
                </h2>
                <p>
                  Follow a question into a sourced draft. Edit, approve and
                  preview the next step.
                </p>
              </div>
              <div className="source-ribbon">
                <span>
                  <MessageCircle size={15} /> Conversation
                </span>
                <i />
                <span>
                  <Package size={15} /> Product + stock
                </span>
                <i />
                <span>
                  <Users size={15} /> Customer context
                </span>
                <i />
                <span>
                  <ShieldCheck size={15} /> Your review
                </span>
              </div>
              <ReplyExperience />
              <p className="ai-evidence">
                Source status: example product and customer facts only.
                Confidence is not scored; no model is connected. This demo never
                sends a message.
              </p>
            </div>
          </section>
          <ConnectedWorkflow />
          <section id="trust" className="studio-trust studio-width">
            <ShieldCheck size={38} />
            <h2>
              Trust is knowing
              <br />
              where the line is.
            </h2>
            <div>
              <p>
                Facts stay visible.
                <br />
                Missing information stays a question.
                <br />
                Your approval stays yours.
              </p>
              <small>
                The scenes here use illustrative data. Inside your workspace,
                AI drafts use your shop’s facts. You review and approve every
                reply before sending it to a storefront customer.
              </small>
            </div>
          </section>
          <ClosingScene />
        </main>
        <footer className="launch-footer studio-width">
          <Link className="launch-brand" href="/">
            <Layers2 size={22} />
            easy shop.
          </Link>
          <span>Social commerce, considered.</span>
          <nav aria-label="Footer">
            <Link href="/login">Log in</Link>
            <a href="#trust">Trust & control</a>
          </nav>
        </footer>
      </div>
    </MotionConfig>
  );
}
