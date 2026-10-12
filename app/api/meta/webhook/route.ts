import type { NextRequest } from "next/server";

async function forward(request: NextRequest) {
  const upstream = new URL(
    process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000",
  );
  const destination = new URL("/api/v1/meta/webhook", upstream);
  destination.search = request.nextUrl.search;
  const body = request.method === "GET" ? undefined : await request.text();
  const init: RequestInit = {
    method: request.method,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  };
  if (body) {
    init.body = body;
    init.headers = { "content-type": "application/json" };
  }
  return fetch(destination, init);
}

export const GET = forward;
export const POST = forward;
