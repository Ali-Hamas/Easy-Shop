import { requireSession } from "@/lib/auth/server";
import { SessionProvider } from "@/components/auth/session-provider";
import OnboardingExperience from "@/components/onboarding/onboarding-experience";
import "@/styles/launch.css";
import "@/styles/commerce.css";
export const metadata = {
  title: "Set up your shop — Easy Shop",
  robots: { index: false, follow: false },
};
export default async function OnboardingPage() {
  const session = await requireSession();
  return (
    <SessionProvider session={session}>
      <OnboardingExperience enabled />
    </SessionProvider>
  );
}
