"use client";
import { useMotionPreference as useReducedMotion } from "@/hooks/use-motion-preference";
import { useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";
import { ArrowRight, Package, Check, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { ScrollLayer, useStaticScene } from "./scroll-layer";
import { Swatch } from "./product-scenes";
import { StockSignal } from "@/components/inventory/stock-signal";
export function useScene(steps: number) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const lastStep = useRef(-1);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 75%", "end 30%"],
  });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(steps - 1, Math.floor(v * steps));
    if (!reduced && next !== lastStep.current) {
      lastStep.current = next;
      setStep(next);
    }
  });
  return { ref, reduced, step, setStep, progress: scrollYProgress };
}
export function InventoryMotionScene() {
  const { ref, reduced, step, setStep, progress } = useScene(5);
  const settled = useStaticScene();
  const available = [24, 12, 3, 3, 3][step];
  return (
    <section
      ref={ref}
      className="inventory-story studio-width"
      id="operations"
      data-step={step}
    >
      <div className="inventory-story-heading">
        <span className="studio-label">The details do the work</span>
        <h2>
          A small change.
          <br />A clear next action.
        </h2>
        <p>See stock move from a healthy position to a useful signal.</p>
      </div>
      <div className="inventory-composition">
      <div className="inventory-product-stage"><Image src="/images/olive-tote.webp" alt="Olive everyday tote" width={600} height={700} /><div className="inventory-product-caption"><span>The same everyday tote.</span><strong>A story in every stock change.</strong></div><ScrollLayer progress={progress} start={0.15} end={0.38} settled={settled} className="inventory-fact-ticket"><span>Sunday Studio</span><strong>TOTE–OLIVE</strong><span>One size / Olive canvas</span><b>৳ 850</b></ScrollLayer></div>
      <div className="inventory-story-panel">
        <header>
          <span>
            <Package size={18} />
            Stock position
          </span>
          <small>Illustrative inventory sequence</small>
        </header>
        <motion.div
          className="inventory-story-row"
          animate={{
            backgroundColor: step >= 2 ? "#FFF7E8" : "#FFFFFF",
            x: reduced ? 0 : step === 3 ? -6 : 0,
          }}
          transition={{ duration: 0.24 }}
        >
          <Swatch />
          <div>
            <strong>Everyday tote</strong>
            <small>TOTE-OLIVE · Olive / One size</small>
          </div>
          <div className="story-stock-number">
            <span>Available</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.b
                key={available}
                initial={{ opacity: 0, y: reduced ? 0 : 22 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -22 }}
                transition={{ duration: 0.24 }}
              >
                {available}
              </motion.b>
            </AnimatePresence>
          </div>
          <StockSignal available={available} threshold={5} />
        </motion.div>
        <div className="inventory-stock-meter">
          <motion.span
            animate={{
              scaleX: available / 24,
              backgroundColor: step >= 2 ? "#E49A21" : "#16A36A",
            }}
            transition={{ duration: reduced ? 0 : 0.4 }}
          />
        </div>
        <div className="inventory-story-action">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: reduced ? 0 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduced ? 0 : -12 }}
              transition={{ duration: 0.2 }}
            >
              <ShieldCheck size={18} />
              <div>
                <strong>
                  {
                    [
                      "A healthy starting point",
                      "Stock moves, the record follows",
                      "The threshold brings it into view",
                      "One product needs attention",
                      "Review stock before the next promise",
                    ][step]
                  }
                </strong>
                <p>
                  {
                    [
                      "24 units available. Five is the low-stock threshold.",
                      "A smaller balance, with its history kept alongside it.",
                      "Three available units. The status is now low stock.",
                      "The affected row is highlighted, without hiding the rest of the context.",
                      "Open inventory, check the count and record a reason for any adjustment.",
                    ][step]
                  }
                </p>
              </div>
              {step === 4 && (
                <a href="/products">
                  Open inventory <ArrowRight size={14} />
                </a>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="inventory-ledger-scene"><span>Stock history</span>{[{ label: "Opening balance", quantity: "+24", at: 0.05 }, { label: "Stock adjustment", quantity: "−12", at: 0.28 }, { label: "Stock adjustment", quantity: "−9", at: 0.5 }].map(row => <ScrollLayer key={row.label + row.quantity} progress={progress} start={row.at} end={row.at + 0.2} settled={settled} className="inventory-ledger-entry"><Check size={14} /><span>{row.label}</span><strong>{row.quantity}</strong></ScrollLayer>)}</div>
      </div>
      <div
        className="inventory-story-controls"
        role="group"
        aria-label="Inventory story steps"
      >
        {["Healthy", "Stock changes", "Low stock", "Focus", "Review"].map(
          (label, i) => (
            <button
              key={label}
              aria-label={label}
              onClick={() => setStep(i)}
              aria-pressed={i === step}
            >
              <span>{i < step ? <Check size={12} /> : i + 1}</span>
              {label}
            </button>
          ),
        )}
      </div>
      <p className="small-print">
        Illustrative stock changes. Every adjustment in your workspace keeps its reason and history.
      </p>
    </section>
  );
}

export { StorefrontMotionScene } from "./storefront-story";
