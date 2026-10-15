"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  MessageCircle,
  Users,
  Package,
  Sparkles,
  Pencil,
  Check,
  Send,
} from "lucide-react";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { ScrollLayer } from "./scroll-layer";
import { ReplyExperience } from "./public-experience";
const steps = [
  { title: "Customer asks", icon: MessageCircle },
  { title: "Context", icon: Users },
  { title: "Stock facts", icon: Package },
  { title: "AI drafts", icon: Sparkles },
  { title: "You edit", icon: Pencil },
  { title: "You approve", icon: Check },
  { title: "You send", icon: Send },
];
export function ReplyStory() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 90%", "center 45%"],
  });
  const progress = useTransform(() =>
    Math.max(0, Math.min(1, scrollYProgress.get())),
  );
  return (
    <div ref={ref} className="reply-story">
      <div
        className="reply-story-path"
        aria-label="How a reviewed reply is prepared"
      >
        <div className="reply-story-line">
          <motion.span style={{ scaleX: reduced ? 1 : progress }} />
        </div>
        {steps.map(({ title, icon: Icon }, i) => (
          <ScrollLayer
            key={title}
            progress={progress}
            start={i * 0.09}
            end={i * 0.09 + 0.3}
            settled={reduced}
            className="reply-story-step"
          >
            <span>
              <Icon size={18} />
            </span>
            <strong>{title}</strong>
          </ScrollLayer>
        ))}
      </div>
      <ReplyExperience />
    </div>
  );
}
