"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, AlertTriangle, CircleOff } from "lucide-react";
export function StockSignal({
  available,
  threshold = 5,
  inactive = false,
}: {
  available: number;
  threshold?: number;
  inactive?: boolean;
}) {
  const reduced = useReducedMotion();
  const state = inactive
    ? "inactive"
    : available === 0
      ? "out"
      : available <= threshold
        ? "low"
        : "healthy";
  const Icon =
    state === "healthy" ? Check : state === "low" ? AlertTriangle : CircleOff;
  return (
    <span className={`stock-signal-badge stock-${state}`}>
      <Icon size={13} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={reduced ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -5 }}
          transition={{ duration: reduced ? 0 : 0.16 }}
        >
          {state === "healthy"
            ? "Healthy"
            : state === "low"
              ? "Low stock"
              : state === "out"
                ? "Out of stock"
                : "Inactive"}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
