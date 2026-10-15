import type { ReactNode } from "react";
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="form-section">
      <legend>{title}</legend>
      <p>{description}</p>
      <div className="form-fields">{children}</div>
    </fieldset>
  );
}
