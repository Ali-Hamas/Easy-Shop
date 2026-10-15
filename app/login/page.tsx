import type { Metadata } from "next";
import AuthExperience from "@/components/auth/auth-experience";
import "@/styles/launch.css";
import "@/styles/auth.css";
export const metadata: Metadata = {
  title: "Log in — Easy Shop",
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return <AuthExperience mode="login" />;
}
