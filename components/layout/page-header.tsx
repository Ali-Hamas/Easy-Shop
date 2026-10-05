import type { ReactNode } from "react";
export function PageTitle({ children }: { children: ReactNode }) {
  return <h1>{children}</h1>;
}
export function PageDescription({ children }: { children: ReactNode }) {
  return <p className="page-description">{children}</p>;
}
export function PageHeader({
  title,
  description,
  actions,
  primaryAction,
  secondaryActions,
  eyebrow,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <PageTitle>{title}</PageTitle>
        <PageDescription>{description}</PageDescription>
      </div>
      {(actions || primaryAction || secondaryActions) && (
        <div className="page-actions">
          {actions ?? (
            <>
              {secondaryActions}
              {primaryAction}
            </>
          )}
        </div>
      )}
    </header>
  );
}
