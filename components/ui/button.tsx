"use client";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  size?: "sm" | "default";
};
export function Button({
  className,
  variant = "primary",
  size = "default",
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "button",
        `button-${variant}`,
        size === "sm" && "button-sm",
        className,
      )}
    >
      {loading && <Loader2 size={16} className="spin" aria-hidden />}
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonProps & { label: string }) {
  return (
    <Button
      {...props}
      variant={props.variant ?? "ghost"}
      aria-label={label}
      className={cn("icon-button", className)}
    >
      {children}
    </Button>
  );
}
