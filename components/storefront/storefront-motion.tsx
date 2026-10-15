"use client";
import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useMotionPreference } from "@/hooks/use-motion-preference";
export function StorefrontProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const reduced = useMotionPreference();
  return reduced ? null : (
    <motion.div
      className="store-scroll-progress"
      style={{ scaleX }}
      aria-hidden
    />
  );
}
export function StorefrontReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null),
    reduced = useMotionPreference();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start 0.55"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [48, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.975, 1]);
  return (
    <motion.div
      ref={ref}
      className="store-section-reveal"
      style={reduced ? undefined : { y, scale, transformOrigin: "center top" }}
    >
      {children}
    </motion.div>
  );
}
