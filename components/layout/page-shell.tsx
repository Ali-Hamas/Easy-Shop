import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export type PageVariant =
  "standard" | "data" | "workspace" | "settings" | "editor" | "analytics";
/** Layout only: panels, filters and actions are composed by the caller. */
export function PageShell({
  children,
  header,
  tabs,
  filters,
  variant = "standard",
  className,
}: {
  children: ReactNode;
  header?: ReactNode;
  tabs?: ReactNode;
  filters?: ReactNode;
  variant?: PageVariant;
  className?: string;
}) {
  return (
    <div
      className={cn("page", `page-${variant}`, className)}
      data-page-variant={variant}
    >
      {header}
      {tabs && <div className="page-tabs">{tabs}</div>}
      {filters && <div className="page-filters">{filters}</div>}
      <div className="page-content">{children}</div>
    </div>
  );
}
export function WorkspacePanels({
  list,
  content,
  context,
}: {
  list: ReactNode;
  content: ReactNode;
  context?: ReactNode;
}) {
  return (
    <div className="workspace-panels">
      <section className="workspace-list">{list}</section>
      <section className="workspace-main">{content}</section>
      {context && <aside className="workspace-context">{context}</aside>}
    </div>
  );
}
