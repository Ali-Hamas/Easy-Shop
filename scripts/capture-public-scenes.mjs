import { chromium } from "@playwright/test";
import sharp from "sharp";
const browser = await chromium.launch();
const page = await browser.newPage({ reducedMotion: "reduce" });
const root = "docs/screenshots/combined";
for (const width of [1440, 1280, 1024, 768, 430, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("http://localhost:3000");
  await page.evaluate(() => document.fonts.ready);
  const scenes = [
    ".position-statement",
    ".operating-pin",
    ".workspace-theatre",
    ".studio-store",
    ".stock-editorial",
    ".person-editorial",
    ".studio-trust",
    ".studio-finale",
  ];
  const pieces = [];
  let top = 30;
  for (const selector of scenes) {
    const target = page.locator(selector);
    if (!(await target.count())) continue;
    const buffer = await target.screenshot({
      style: ".launch-header,.launch-skip{visibility:hidden!important}",
    });
    const { data, info } = await sharp(buffer)
      .resize({ width: 400 })
      .png()
      .toBuffer({ resolveWithObject: true });
    pieces.push({ input: data, left: 10, top });
    top += info.height + 20;
  }
  await sharp({
    create: { width: 420, height: top, channels: 3, background: "#D9DDE5" },
  })
    .composite(pieces)
    .png()
    .toFile(`${root}/review/public-scenes-${width}.png`);
}
await browser.close();
console.log("Public narrative scene review captured at six widths.");
