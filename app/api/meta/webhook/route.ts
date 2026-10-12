import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

function verifiedMetaSignature(secret: string, body: string, signature: string | null) {
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  if (!signature || signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function forward(request: NextRequest) {
  const upstream = new URL(
    process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000",
  );
  const destination = new URL("/api/v1/meta/webhook", upstream);
  destination.search = request.nextUrl.search;
  const body = request.method === "GET" ? undefined : await request.text();
  if (request.method === "POST") {
    const secret = process.env.META_APP_SECRET;
    if (
      !secret ||
      !body ||
      !verifiedMetaSignature(
        secret,
        body,
        request.headers.get("x-hub-signature-256"),
      )
    ) {
      return Response.json({ code: "META_SIGNATURE_INVALID" }, { status: 403 });
    }
  }
  const init: RequestInit = {
    method: request.method,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  };
  if (body) {
    init.body = body;
    init.headers = {
      "content-type": "application/json",
      "x-easyshop-meta-verified": "1",
    };
  }
  return fetch(destination, init);
}

export const GET = forward;
export const POST = forward;
