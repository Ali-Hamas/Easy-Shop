import sharp from "sharp";
import { mkdir } from "node:fs/promises";
const root = "docs/screenshots/combined";
await mkdir(`${root}/review`, { recursive: true });
const widths = [1440, 1280, 1024, 768, 430, 390];
for (const name of [
  "hero",
  "login",
  "register",
  "dashboard",
  "onboarding",
  "storefront-live",
  "product-live",
  "dashboard-live",
  "ai-replies",
  "workflow",
]) {
  const thumbs = [];
  for (const width of widths) {
    const { data, info } = await sharp(`${root}/${name}-${width}.png`)
      .resize({ width: 360 })
      .png()
      .toBuffer({ resolveWithObject: true });
    thumbs.push({ data, info, width });
  }
  const rowHeights = [
    Math.max(...thumbs.slice(0, 3).map((t) => t.info.height)) + 40,
    Math.max(...thumbs.slice(3).map((t) => t.info.height)) + 40,
  ];
  const pieces = [];
  thumbs.forEach((t, i) => {
    const left = (i % 3) * 380 + 10;
    const top = (i < 3 ? 0 : rowHeights[0]) + 32;
    pieces.push({ input: t.data, left, top });
    pieces.push({
      input: Buffer.from(
        `<svg width="360" height="25"><rect width="360" height="25" fill="white"/><text x="5" y="18" font-family="Arial" font-size="14">${name} · ${t.width}px</text></svg>`,
      ),
      left,
      top: top - 28,
    });
  });
  await sharp({
    create: {
      width: 1140,
      height: rowHeights[0] + rowHeights[1] + 10,
      channels: 3,
      background: "#d9dde5",
    },
  })
    .composite(pieces)
    .png()
    .toFile(`${root}/review/${name}.png`);
}
console.log(
  "Ten review sheets created, each covering all six requested widths.",
);
