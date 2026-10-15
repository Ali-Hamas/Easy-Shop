import sharp from "sharp";
import { mkdir } from "node:fs/promises";
const root = "docs/screenshots/inventory";
await mkdir(`${root}/review`, { recursive: true });
for (const name of ["list", "editor"]) {
  const images = [];
  for (const w of [1440, 1280, 1024, 768, 430, 390]) {
    const { data, info } = await sharp(`${root}/${name}-${w}.png`)
      .resize({ width: 360 })
      .png()
      .toBuffer({ resolveWithObject: true });
    images.push({ data, info, w });
  }
  const heights = [
    Math.max(...images.slice(0, 3).map((i) => i.info.height)) + 40,
    Math.max(...images.slice(3).map((i) => i.info.height)) + 40,
  ];
  const parts = [];
  images.forEach((i, n) => {
    const left = (n % 3) * 380 + 10,
      top = (n < 3 ? 0 : heights[0]) + 30;
    parts.push(
      { input: i.data, left, top },
      {
        input: Buffer.from(
          `<svg width="360" height="25"><rect width="360" height="25" fill="white"/><text x="6" y="18" font-family="Arial" font-size="14">${name} · ${i.w}px</text></svg>`,
        ),
        left,
        top: top - 28,
      },
    );
  });
  await sharp({
    create: {
      width: 1140,
      height: heights[0] + heights[1],
      channels: 3,
      background: "#D9DDE5",
    },
  })
    .composite(parts)
    .png()
    .toFile(`${root}/review/${name}.png`);
}
console.log("Inventory and editor review sheets generated for all six widths.");
