import type { ReactNode } from "react";
export function MetricPlaceholder({
  label,
  icon,
  note,
}: {
  label: string;
  icon: ReactNode;
  note: string;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        <span>{icon}</span>
      </div>
      <div className="metric-value" aria-label="No data">
        —
      </div>
      <div className="metric-note">{note}</div>
    </div>
  );
}
