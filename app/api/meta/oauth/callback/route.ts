import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const target = new URL(request.url);
  target.pathname = "/inbox";
  target.search = "meta=failed";
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(target);
  try {
    const upstream = new URL(
      process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000",
    );
    const callback = new URL("/api/v1/inbox/channels/meta/callback", upstream);
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", state);
    const response = await fetch(callback, {
      headers: {
        Origin: process.env.APP_ORIGIN ?? request.nextUrl.origin,
        Cookie: request.cookies
          .getAll()
          .map((c) => `${c.name}=${c.value}`)
          .join("; "),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    target.search = response.ok ? "meta=connected" : "meta=failed";
  } catch {
    target.search = "meta=failed";
  }
  return NextResponse.redirect(target);
}
