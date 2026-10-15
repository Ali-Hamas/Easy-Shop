import type { ReactNode } from "react";
import { Package, Truck, Wallet, Link2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/display";
import type { Tone } from "@/types/ui";
export function CommerceFact({
  label,
  value,
  icon = "order",
}: {
  label: string;
  value: ReactNode;
  icon?: "order" | "delivery" | "payment";
}) {
  const Icon = { order: Package, delivery: Truck, payment: Wallet }[icon];
  return (
    <div className="commerce-fact">
      <Icon size={17} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
export function ConnectionStatus({
  name,
  connected,
  lastSync,
}: {
  name: string;
  connected: boolean;
  lastSync?: string;
}) {
  return (
    <div className="connection-status">
      <span className="channel-icon">
        <Link2 size={17} />
      </span>
      <div>
        <strong>{name}</strong>
        {lastSync && <p>{lastSync}</p>}
      </div>
      <StatusBadge tone={connected ? "success" : "neutral"}>
        {connected ? "Connected" : "Not connected"}
      </StatusBadge>
    </div>
  );
}
export function OperationalNotice({
  title,
  description,
  tone = "neutral",
}: {
  title: string;
  description: string;
  tone?: Tone;
}) {
  return (
    <div className="operational-notice">
      <StatusBadge tone={tone}>{title}</StatusBadge>
      <p>{description}</p>
    </div>
  );
}
