import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("docs/screenshots/inventory/motion", { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: {
    dir: "docs/screenshots/inventory/motion",
    size: { width: 1440, height: 1000 },
  },
});
const page = await context.newPage();
await page.goto("http://localhost:3000");
await page.locator("h1").waitFor();
await page.evaluate(() => document.fonts.ready);
const observations = [];
for (const [name, selector] of [
  ["hero", ".studio-hero"],
  ["storefront", "#storefront"],
  ["inventory", "#operations"],
  ["workflow", "#workflow"],
]) {
  const loc = page.locator(selector);
  const box = await loc.boundingBox();
  await page.evaluate(
    (y) => window.scrollTo(0, y),
    Math.max(0, (box?.y ?? 0) + (await page.evaluate(() => scrollY)) - 150),
  );
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, name === "workflow" ? 330 : 180);
    await page.waitForTimeout(350);
    observations.push({
      scene: name,
      step: i,
      scrollY: await page.evaluate(() => scrollY),
      transform:
        name === "hero"
          ? await page
              .locator(".hero-environment")
              .evaluate((el) => getComputedStyle(el).transform)
          : null,
      active: await loc.locator('[aria-pressed="true"]').allTextContents(),
    });
    if (i === 1 || i === 4)
      await page.screenshot({
        path: `docs/screenshots/inventory/motion/${name}-${i}.png`,
      });
  }
}
await page.locator("#ai-replies").scrollIntoViewIfNeeded();
await page.getByRole("button", { name: "Try an example draft" }).click();
await page.waitForTimeout(250);
await page.screenshot({
  path: "docs/screenshots/inventory/motion/ai-context.png",
});
await page.getByRole("button", { name: "Approve draft" }).waitFor();
await page.getByRole("button", { name: "Approve draft" }).click();
await page.screenshot({
  path: "docs/screenshots/inventory/motion/ai-approved.png",
});
await page.goto("http://localhost:3000/dashboard");
await page.getByRole("button", { name: "How these steps connect" }).click();
await page.getByRole("button", { name: "Notifications", exact: true }).click();
await page.waitForTimeout(250);
await page.screenshot({
  path: "docs/screenshots/inventory/motion/dashboard-panel.png",
});
await writeFile(
  "docs/screenshots/inventory/motion/observations.json",
  JSON.stringify(observations, null, 2),
);
const video = page.video();
await context.close();
await video.saveAs("docs/screenshots/inventory/motion-review.webm");
await browser.close();
console.log(
  "Headed Chromium scroll review and interaction recording complete.",
);
