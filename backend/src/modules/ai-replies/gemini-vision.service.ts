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
  const dataUrl = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(imageUrl);
  if (dataUrl) {
    return {
      buffer: Buffer.from(dataUrl[2], "base64"),
      mimeType: dataUrl[1],
    };
  }
  const resolvedUrl = new URL(imageUrl, config.appOrigin).toString();
  const response = await fetchWithRetry(resolvedUrl, {}, { actionName: "downloadImage" });
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
