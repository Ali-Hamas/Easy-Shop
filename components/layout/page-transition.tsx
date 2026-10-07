"use client";
import { useEffect } from "react";
import { useAnimate, useReducedMotion } from "framer-motion";
import { duration, ease } from "@/config/motion";
/** Keep SSR content visible. A template remount owns each page entry. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const [scope, animate] = useAnimate();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const animation = animate(
      scope.current,
      { y: [4, 0] },
      { duration: duration.page, ease },
    );
    return () => animation.stop();
  }, [animate, reduced, scope]);
  return (
    <div ref={scope} className="page-transition">
      {children}
    </div>
  );
}
