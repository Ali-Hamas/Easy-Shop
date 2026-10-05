import type { ReactNode } from "react";
import { CircleCheck, CircleAlert, Info, Circle, Sparkles } from "lucide-react";
import type { Tone } from "@/types/ui";
import { cn } from "@/lib/utils";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const Icon = {
    neutral: Circle,
    primary: Sparkles,
    success: CircleCheck,
    warning: CircleAlert,
    danger: CircleAlert,
    info: Info,
  }[tone];
  return (
    <Badge tone={tone}>
      <Icon size={12} aria-hidden />
      {children}
    </Badge>
  );
}
export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span role="img" aria-label={name} className={cn("avatar", className)}>
      {name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}
export function Divider() {
  return <hr className="divider" />;
}
export function Progress({ value, label }: { value: number; label: string }) {
  const bounded = Math.min(100, Math.max(0, value));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={bounded}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${bounded}%` }} />
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
