import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const selfHost = new URL(request.url).host;
  if (!origin || new URL(origin).host !== selfHost) {
    return NextResponse.json(
      { message: "Invalid upload origin." },
      { status: 403 },
    );
  }
  const upstream = new URL(
    process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000",
  );
  const session = await fetch(new URL("/api/v1/auth/me", upstream), {
    headers: { Cookie: request.headers.get("cookie") ?? "" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!session?.ok) {
    return NextResponse.json(
      { message: "Log in before uploading product images." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    image?: string;
  } | null;
  const match = body?.image?.match(
    /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) {
    return NextResponse.json(
      { message: "Upload a PNG, JPG or WEBP image." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json(
      { message: "Each image must be 10MB or smaller." },
      { status: 413 },
    );
  }

  const dir = path.join(process.cwd(), "public", "uploads", "products");
  await mkdir(dir, { recursive: true });
  const file = `${randomUUID()}.${MIME_EXT[match[1]]}`;
  await writeFile(path.join(dir, file), buffer);

  return NextResponse.json({ url: `/uploads/products/${file}` });
}
