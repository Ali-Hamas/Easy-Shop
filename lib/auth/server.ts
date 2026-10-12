import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthSession } from "@/types/auth";
export async function requireSession(): Promise<AuthSession> {
  const token = (await cookies()).get("easy_shop_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) redirect("/login");
  let response: Response;
  try {
    response = await fetch(
      new URL(
        "/api/v1/auth/me",
        process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000",
      ),
      {
        headers: { Cookie: `easy_shop_session=${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch {
    redirect("/login");
  }
  if (!response.ok) redirect("/login");
  return response.json();
}
