import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth/server";
import { SessionProvider } from "@/components/auth/session-provider";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return (
    <SessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
