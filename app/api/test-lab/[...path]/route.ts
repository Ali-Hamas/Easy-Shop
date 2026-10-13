import type { NextRequest } from "next/server";

const allowed = new Set(["ui", "status", "products", "chat"]);

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context);
}

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.length !== 1 || !allowed.has(path[0])) return Response.json({ code: "NOT_FOUND", message: "This operation is not available." }, { status: 404 });
  if (request.method === "POST" && request.headers.get("origin") !== `${request.nextUrl.protocol}//${request.headers.get("host") ?? ""}`)
    return Response.json({ code: "ORIGIN_REJECTED", message: "Open this form from the same application." }, { status: 403 });
  const body = request.method === "GET" ? undefined : await request.text();
  if (body && Buffer.byteLength(body, "utf8") > 15 * 1024 * 1024)
    return Response.json({ code: "REQUEST_TOO_LARGE", message: "The image is too large." }, { status: 413 });
  const upstream = new URL(process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000");
  const response = await fetch(new URL(`/api/v1/test-lab/${path[0]}`, upstream), {
    method: request.method,
    body,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      origin: process.env.APP_ORIGIN ?? "http://localhost:3000",
      cookie: request.cookies.getAll().filter((c) => c.name === "easy_shop_session").map((c) => `${c.name}=${c.value}`).join("; "),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json", "cache-control": "no-store" } });
}
