import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthSession } from "@/types/auth";

const sessionForToken = cache(async (token: string): Promise<AuthSession | null> => {
  try {
    const response = await fetch(
      new URL(
        "/api/v1/auth/me",
        process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000",
      ),
      {
        headers: { Cookie: `easy_shop_session=${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(2000),
      },
    );
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
});

export async function requireSession(): Promise<AuthSession> {
  const token = (await cookies()).get("easy_shop_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) redirect("/login");
  const session = await sessionForToken(token);
  if (!session) redirect("/login");
  return session;
}
