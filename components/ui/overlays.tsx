"use client";
import {
  Dialog as D,
  Tooltip as T,
  Popover as P,
  DropdownMenu as M,
} from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useRef, type ReactNode, type RefObject } from "react";
import { IconButton } from "./button";
import { duration, ease } from "@/config/motion";
import { cn } from "@/lib/utils";
export type OverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
};
function Overlay({
  open,
  onOpenChange,
  title,
  description,
  children,
  metadata,
  actions,
  footer,
  className,
  initialFocusRef,
  kind = "modal",
}: { kind?: "modal" | "detail" | "navigation" } & OverlayProps) {
  const reduced = useReducedMotion();
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const isDrawer = kind !== "modal";
  const transition = { duration: reduced ? 0 : duration.overlay, ease };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount key="overlay">
            <D.Overlay forceMount asChild>
              <motion.div
                className="overlay-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
              />
            </D.Overlay>
            <D.Content
              forceMount
              asChild
              onOpenAutoFocus={(event) => {
                previousFocus.current = document.activeElement as HTMLElement;
                event.preventDefault();
                (initialFocusRef?.current ?? titleRef.current)?.focus();
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (previousFocus.current?.isConnected)
                  previousFocus.current.focus();
              }}
            >
              <motion.section
                className={cn(
                  "overlay-panel",
                  isDrawer ? `drawer drawer-${kind}` : "modal",
                  className,
                )}
                initial={
                  reduced
                    ? false
                    : {
                        opacity: 0,
                        x: isDrawer ? (kind === "navigation" ? -40 : 48) : 0,
                        y: isDrawer ? 0 : 6,
                        scale: isDrawer ? 1 : 0.99,
                      }
                }
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        x: isDrawer ? (kind === "navigation" ? -32 : 36) : 0,
                        y: isDrawer ? 0 : 4,
                        scale: isDrawer ? 1 : 0.995,
                      }
                }
                transition={transition}
              >
                <div className="overlay-heading">
                  <div className="overlay-title-group">
                    {metadata && (
                      <div className="overlay-metadata">{metadata}</div>
                    )}
                    <D.Title ref={titleRef} tabIndex={-1}>
                      {title}
                    </D.Title>
                    <D.Description>{description}</D.Description>
                  </div>
                  <div className="overlay-actions">
                    {actions}
                    <D.Close asChild>
                      <IconButton label="Close">
                        <X size={18} />
                      </IconButton>
                    </D.Close>
                  </div>
                </div>
                <div className="overlay-body">{children}</div>
                {footer && <footer className="overlay-footer">{footer}</footer>}
              </motion.section>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
export function Modal(props: OverlayProps) {
  return <Overlay {...props} />;
}
export function Drawer({
  variant = "detail",
  ...props
}: OverlayProps & { variant?: "detail" | "navigation" }) {
  return <Overlay {...props} kind={variant} />;
}
export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  return (
    <T.Provider delayDuration={350}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content className="tooltip" sideOffset={8}>
            {content}
            <T.Arrow />
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
export function Popover({
  trigger,
  children,
  label,
}: {
  trigger: ReactNode;
  children: ReactNode;
  label: string;
}) {
  return (
    <P.Root>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          aria-label={label}
          className="popover"
          sideOffset={10}
          align="end"
          collisionPadding={16}
        >
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
export function Dropdown({
  trigger,
  items,
}: {
  trigger: ReactNode;
  items: {
    label: string;
    onSelect: () => void;
    disabled?: boolean;
    danger?: boolean;
  }[];
}) {
  return (
    <M.Root>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content
          className="dropdown"
          sideOffset={8}
          align="end"
          collisionPadding={16}
        >
          {items.map((item) => (
            <M.Item
              key={item.label}
              onSelect={item.onSelect}
              disabled={item.disabled}
              className={cn("dropdown-item", item.danger && "dropdown-danger")}
            >
              {item.label}
            </M.Item>
          ))}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
