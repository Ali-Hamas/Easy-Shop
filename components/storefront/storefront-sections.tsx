"use client";
import {
  Children,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import type { StorefrontSectionId } from "@/types/storefront-content";
export function StorefrontSection({
  children,
}: {
  sectionId: StorefrontSectionId;
  children: ReactNode;
}) {
  return <>{children}</>;
}
export function StorefrontSectionLayout({
  sections,
  children,
}: {
  sections: StorefrontSectionId[];
  children: ReactNode;
}) {
  const nodes = Children.toArray(children).filter(
    (c): c is ReactElement<{ sectionId: StorefrontSectionId }> =>
      isValidElement(c),
  );
  return (
    <div className="store-home-sections">
      {sections
        .filter((id) => id !== "footer")
        .flatMap((id) => nodes.filter((n) => n.props.sectionId === id))}
    </div>
  );
}
