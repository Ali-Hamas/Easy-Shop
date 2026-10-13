import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { config } from "../../shared/config.js";
import { fetchWithRetry } from "../../shared/fetch-retry.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type VisualProductCandidate = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  imageUrls: string[];
};

export type VisualMatch = {
  productId: string | null;
  confidence: number;
  reason: string;
};

export async function downloadImageBuffer(imageUrl: string) {
  const dataUrl = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(imageUrl);
  if (dataUrl) {
    if (!IMAGE_TYPES.has(dataUrl[1].toLowerCase())) throw new Error("Unsupported image type.");
    const buffer = Buffer.from(dataUrl[2], "base64");
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("Image is too large.");
    return {
      buffer,
      mimeType: dataUrl[1].toLowerCase(),
    };
  }
  const resolved = new URL(imageUrl, config.appOrigin);
  if (!['http:', 'https:'].includes(resolved.protocol)) throw new Error("Image URL is not allowed.");
  const addresses = await lookup(resolved.hostname, { all: true });
  if (addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Private image hosts are not allowed.");
  const response = await fetchWithRetry(resolved.toString(), { redirect: "error" }, { actionName: "downloadImage", timeoutMs: 15000, maxRetries: 2 });
  if (!response.ok) throw new Error("Image could not be downloaded.");
  const type = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!IMAGE_TYPES.has(type)) throw new Error("Unsupported image type.");
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error("Image is too large.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Image is too large.");
  return {
    buffer,
    mimeType: type,
  };
}

function isPrivateAddress(address: string) {
  const mapped = address.match(/(?:^|:)(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateAddress(mapped[1]);
  if (isIP(address) === 6) {
    const value = address.toLowerCase();
    return value === "::1" || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb") || value.startsWith("fc") || value.startsWith("fd");
  }
  const octets = address.split(".").map(Number);
  return octets[0] === 10 || octets[0] === 127 || (octets[0] === 169 && octets[1] === 254) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168) || octets[0] === 0;
}

export async function matchProductImageWithGemini(
  imageUrl: string,
  candidates: VisualProductCandidate[],
): Promise<VisualMatch> {
  if (!config.geminiApiKey || candidates.length === 0)
    return { productId: null, confidence: 0, reason: "Gemini key or candidates missing." };
  const { buffer, mimeType } = await downloadImageBuffer(imageUrl);
  const catalogImages = (
    await Promise.all(
      candidates.flatMap((candidate) =>
        candidate.imageUrls.slice(0, 1).map(async (catalogImageUrl) => {
          try {
            const image = await downloadImageBuffer(catalogImageUrl);
            return { id: candidate.id, ...image };
          } catch {
            return null;
          }
        }),
      ),
    )
  ).filter((image) => image !== null);
  const prompt = `Match this buyer image to one catalog product.
Return strict JSON only: {"productId": string|null, "confidence": number, "reason": string}.
Use null if uncertain. Never guess.
Catalog metadata and attached catalog images:
${candidates
  .map(
    (p) =>
      `- ${p.id}: ${p.name}; category=${p.category || ""}; description=${(
        p.description || ""
      ).slice(0, 240)}`,
  )
  .join("\n")}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...catalogImages.flatMap((image) => [
            { text: `Catalog image for product ${image.id}.` },
            {
              inline_data: {
                mime_type: image.mimeType,
                data: image.buffer.toString("base64"),
              },
            },
          ]),
          { text: "Buyer image to match:" },
          {
            inline_data: {
              mime_type: mimeType,
              data: buffer.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: { temperature: 0, response_mime_type: "application/json" },
  };
  const response = await fetchWithRetry(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": config.geminiApiKey }, body: JSON.stringify(body) },
    { maxRetries: 3, timeoutMs: 20000, actionName: "geminiVisualMatch" },
  );
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message || "Gemini visual match failed.");
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(text) as VisualMatch;
  if (!candidates.some((p) => p.id === parsed.productId)) parsed.productId = null;
  return {
    productId: parsed.productId ?? null,
    confidence: Number(parsed.confidence) || 0,
    reason: String(parsed.reason || ""),
  };
}
