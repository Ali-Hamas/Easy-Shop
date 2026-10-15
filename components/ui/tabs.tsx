"use client";
import { Tabs as T, ToggleGroup as G } from "radix-ui";
import { motion, useReducedMotion } from "framer-motion";
import { useId, useState, type ReactNode } from "react";
import { duration, ease } from "@/config/motion";
export function Tabs({
  items,
  label,
  defaultValue,
}: {
  items: { value: string; label: string; content: ReactNode }[];
  label: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? items[0]?.value);
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <T.Root value={value} onValueChange={setValue}>
      <T.List className="tabs" aria-label={label}>
        {items.map((i) => (
          <T.Trigger className="tab" key={i.value} value={i.value}>
            {i.label}
            {value === i.value && (
              <motion.span
                layoutId={id}
                className="tab-indicator"
                transition={{ duration: reduced ? 0 : duration.normal, ease }}
              />
            )}
          </T.Trigger>
        ))}
      </T.List>
      {items.map((i) => (
        <T.Content className="tab-content" key={i.value} value={i.value}>
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : duration.normal, ease }}
          >
            {i.content}
          </motion.div>
        </T.Content>
      ))}
    </T.Root>
  );
}
export function SegmentedControl({
  value,
  onValueChange,
  options,
  label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <G.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      className="segmented"
      aria-label={label}
    >
      {options.map((o) => (
        <G.Item key={o.value} className="segment" value={o.value}>
          {value === o.value && (
            <motion.span
              className="segment-selection"
              layoutId={id}
              transition={{ duration: reduced ? 0 : duration.normal, ease }}
            />
          )}
          <span className="segment-text">{o.label}</span>
        </G.Item>
      ))}
    </G.Root>
  );
}
