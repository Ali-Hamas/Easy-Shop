import { config } from "../../shared/config.js";
import { fetchWithRetry } from "../../shared/fetch-retry.js";

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
  const response = await fetchWithRetry(imageUrl, {}, { actionName: "downloadImage" });
  if (!response.ok) throw new Error("Image could not be downloaded.");
  const type = response.headers.get("content-type") || "image/jpeg";
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: type.split(";")[0],
  };
}

export async function matchProductImageWithGemini(
  imageUrl: string,
  candidates: VisualProductCandidate[],
): Promise<VisualMatch> {
  if (!config.geminiApiKey || candidates.length === 0)
    return { productId: null, confidence: 0, reason: "Gemini key or candidates missing." };
  const { buffer, mimeType } = await downloadImageBuffer(imageUrl);
  const prompt = `Match this buyer image to one catalog product.
Return strict JSON only: {"productId": string|null, "confidence": number, "reason": string}.
Use null if uncertain. Never guess.
Catalog:
${candidates
  .map(
    (p) =>
      `- ${p.id}: ${p.name}; category=${p.category || ""}; description=${(
        p.description || ""
      ).slice(0, 240)}; images=${p.imageUrls.slice(0, 3).join(", ")}`,
  )
  .join("\n")}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.geminiApiKey}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
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
