"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
export function AnimatedValue({ value }: { value: number | string }) {
  const reduced = useReducedMotion();
  return (
    <span
      className="animated-value"
      style={{ display: "inline-block", position: "relative" }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          style={{ display: "inline-block" }}
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -12 }}
          transition={{ duration: reduced ? 0 : 0.22 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
