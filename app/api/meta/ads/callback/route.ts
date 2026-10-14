import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const target = new URL("/ads", request.url);
  target.search = "metaAds=failed";
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(target);
  try {
    const upstream = new URL(process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000");
    const callback = new URL("/api/v1/ads/callback", upstream);
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", state);
    const response = await fetch(callback, {
      headers: {
        Origin: process.env.APP_ORIGIN ?? request.nextUrl.origin,
        Cookie: request.cookies.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    target.search = response.ok ? "metaAds=connected" : "metaAds=failed";
  } catch {
    target.search = "metaAds=failed";
  }
  return NextResponse.redirect(target);
}
