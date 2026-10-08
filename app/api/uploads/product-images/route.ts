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
  if (origin && new URL(origin).host !== selfHost) {
    return NextResponse.json(
      { message: "Invalid upload origin." },
      { status: 403 },
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
