import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "@/styles/globals.css";
import "@/styles/motion-elevation.css";
export const metadata: Metadata = {
  title: { default: "Workspace · Social commerce", template: "%s · Workspace" },
  description: "A connected workspace for social commerce.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
