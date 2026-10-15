import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const dir = "docs/screenshots/customer-motion";
await mkdir(`${dir}/recording`, { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: `${dir}/recording`, size: { width: 1440, height: 1000 } },
});
const page = await context.newPage();
await page.goto(process.env.REVIEW_URL ?? "http://localhost:3000");
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);
const observations = [];
// One continuous physical wheel pass through the entire page; no scroll jumps.
let previous = -1,
  stopped = 0;
for (let i = 0; i < 350; i++) {
  await page.mouse.wheel(0, 90);
  await page.waitForTimeout(100);
  const state = await page.evaluate(() => ({
    scrollY,
    viewport: innerHeight,
    bottom: scrollY + innerHeight >= document.documentElement.scrollHeight - 2,
    scenes: [
      ".studio-hero",
      "#story",
      "#storefront",
      "#ai-replies",
      "#workflow",
      ".studio-finale",
    ].map((selector) => {
      const el = document.querySelector(selector);
      const box = el.getBoundingClientRect();
      const layer = el.querySelector(
        ".story-desk,.collection-hero,.hero-environment,.closing-action",
      );
      return {
        selector,
        top: box.top,
        height: box.height,
        opacity: layer ? getComputedStyle(layer).opacity : null,
        transform: layer ? getComputedStyle(layer).transform : null,
      };
    }),
  }));
  observations.push(state);
  if (state.scrollY === previous) stopped++;
  else stopped = 0;
  previous = state.scrollY;
  if (state.bottom || stopped > 8) break;
}
await page.waitForTimeout(600);
// Replay the important assembly ranges and preserve intermediate evidence.
for (const selector of ["#story", "#storefront"]) {
  await page.locator(selector).evaluate((el) =>
    scrollTo({
      top: el.getBoundingClientRect().top + scrollY,
      behavior: "instant",
    }),
  );
  await page.waitForTimeout(400);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 190);
    await page.waitForTimeout(350);
    await page.screenshot({
      path: `${dir}/${selector.slice(1)}-stage-${i}.png`,
    });
  }
}
await page.locator("#ai-replies").scrollIntoViewIfNeeded();
await page.getByRole("button", { name: "Try an example draft" }).click();
await page.getByRole("button", { name: "Approve draft" }).waitFor();
await page.getByRole("button", { name: "Approve draft" }).click();
await page.screenshot({ path: `${dir}/ai-reviewed.png` });
await writeFile(
  `${dir}/scroll-observations.json`,
  JSON.stringify(observations, null, 2),
);
const video = page.video();
await context.close();
await video.saveAs(`${dir}/full-scroll-review.webm`);
await browser.close();
console.log(
  `Full headed scroll recording complete; ${observations.length} wheel samples.`,
);
