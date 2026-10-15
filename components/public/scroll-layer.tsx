"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { useMotionPreference } from "@/hooks/use-motion-preference";
const query = "(min-width: 1000px) and (min-height: 800px)";
const subscribe = (fn: () => void) => {
  const m = window.matchMedia(query);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};
export function useStaticScene() {
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  return useMotionPreference() || !desktop;
}
export function ScrollLayer({
  progress,
  start,
  end,
  children,
  className,
  settled = false,
}: {
  progress: MotionValue<number>;
  start: number;
  end: number;
  children: ReactNode;
  className?: string;
  settled?: boolean;
}) {
  // Keep one continuous MotionValue clock. The installed Motion version's
  // accelerated ViewTimeline mapping diverges for these nested reveal ranges.
  // Function transforms avoid that path without React state or layout reads.
  const opacity = useTransform(() =>
    Math.min(1, Math.max(0, (progress.get() - start) / (end - start))),
  );
  const y = useTransform(() => (1 - opacity.get()) * 18);
  const scale = useTransform(() => 0.975 + opacity.get() * 0.025);
  return (
    <motion.div
      className={className}
      style={settled ? { opacity: 1, y: 0, scale: 1 } : { opacity, y, scale }}
    >
      {children}
    </motion.div>
  );
}
