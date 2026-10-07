import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const label = process.argv[2] ?? "after";
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(process.env.REVIEW_URL ?? "http://localhost:3000");
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
const results = [];
for (const selector of [
  ".studio-hero",
  "#story",
  "#storefront",
  "#ai-replies",
  "#workflow",
  ".studio-finale",
]) {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__frames = [];
    window.__running = true;
    let previous = performance.now();
    function tick(now) {
      if (!window.__running) return;
      window.__frames.push(now - previous);
      previous = now;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
  const before = (await cdp.send("Performance.getMetrics")).metrics;
  for (let i = 0; i < 16; i++) {
    await page.mouse.wheel(0, 60);
    await page.waitForTimeout(50);
  }
  const frames = await page.evaluate(() => {
    window.__running = false;
    return window.__frames;
  });
  const after = (await cdp.send("Performance.getMetrics")).metrics;
  const delta = (name) =>
    after.find((x) => x.name === name).value -
    before.find((x) => x.name === name).value;
  const sorted = frames.slice(2).sort((a, b) => a - b);
  results.push({
    selector,
    frames: sorted.length,
    p95: sorted[Math.floor(sorted.length * 0.95)],
    over33ms: sorted.filter((x) => x > 33.4).length,
    layoutCount: delta("LayoutCount"),
    layoutSeconds: delta("LayoutDuration"),
    scriptSeconds: delta("ScriptDuration"),
  });
}
await mkdir("docs/screenshots/customer-motion", { recursive: true });
await writeFile(
  `docs/screenshots/customer-motion/performance-${label}.json`,
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
await browser.close();
