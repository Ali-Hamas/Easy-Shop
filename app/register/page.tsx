import type { Metadata } from "next";
import AuthExperience from "@/components/auth/auth-experience";
import "@/styles/launch.css";
import "@/styles/auth.css";
export const metadata: Metadata = {
  title: "Get started — Easy Shop",
  robots: { index: false, follow: false },
};
export default function RegisterPage() {
  return <AuthExperience mode="register" />;
}
