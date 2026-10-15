import { commerceUi } from "../config/commerce-ui.ts";
// Read-only presentation QA using an existing disposable test shop.
// Theme overrides stay inside the browser; no seller data is changed.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const subdomain = process.env.THEME_QA_SHOP;
if (!/^studio-[a-z0-9]+$/.test(subdomain || ""))
  throw Error("Set THEME_QA_SHOP to a disposable studio test shop.");
const base = "http://localhost:3000";
const endpoint = `/api/commerce/storefront/${subdomain}`;
const response = await fetch(base + endpoint);
if (!response.ok) throw Error("Disposable storefront unavailable");
const fixture = await response.json();
const themes = [
  "fashion-lifestyle",
  "beauty-cosmetics",
  "electronics-gadgets",
  "food-restaurant",
  "modern-general",
];
const dir = "docs/screenshots/storefront-themes";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const report = [];
try {
  for (const theme of themes) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    let catalogSize;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(`**${endpoint}`, (route) => {
      const data = structuredClone(fixture);
      data.shop.content.design.themeId = theme;
      if (catalogSize !== undefined) {
        // Synthetic size cases are browser-only fixtures, never database records.
        data.products = Array.from({ length: catalogSize }, (_, index) => ({
          ...fixture.products[index % fixture.products.length],
          id: `size-case-${index}`,
        }));
        data.shop.content.featuredProductIds = [];
        data.shop.content.collections = [];
      }
      return route.fulfill({ json: data });
    });
    await page.goto(`${base}/store/${subdomain}`);
    await expect(page.locator(".buyer-site")).toHaveAttribute(
      "data-store-theme",
      theme,
    );
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".review-layout")).toBeVisible({
      timeout: 30000,
    });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      if (overflow) throw Error(`${theme}: overflow at ${width}`);
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      report.push({
        theme,
        width,
        violations: axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      });
      if (width !== 320)
        await page.screenshot({
          path: `${dir}/${theme}-${width}.png`,
          fullPage: true,
        });
    }
    await page
      .getByRole("link", { name: "View details", exact: true })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.screenshot({
      path: `${dir}/${theme}-product-320.png`,
      fullPage: true,
    });
    if (commerceUi.orders) {
      await page.getByRole("button", { name: /Add to Bag/ }).click();
      await expect(
        page.getByRole("button", { name: "Continue to checkout" }),
      ).toBeVisible();
      await expect
        .poll(async () => {
          const box = await page.locator(".buyer-cart-drawer").boundingBox();
          return !!box && box.x >= -1 && box.x + box.width <= 321;
        })
        .toBe(true);
      await page.screenshot({ path: `${dir}/${theme}-cart-320.png` });
      await page.getByRole("button", { name: "Continue to checkout" }).click();
      await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
      const checkout = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      report.push({
        theme,
        surface: "checkout",
        violations: checkout.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        errors,
      });
      await page.screenshot({ path: `${dir}/${theme}-checkout-320.png` });
    } else {
      await expect(
        page.getByRole("button", { name: /bag|checkout|Place order/i }),
      ).toHaveCount(0);
      await expect(page.locator("#order-tracking")).toHaveCount(0);
      report.push({
        theme,
        surface: "browse-only detail",
        violations: [],
        errors,
      });
    }
    for (const size of [0, 1, 8]) {
      catalogSize = size;
      await page.goto(`${base}/store/${subdomain}`);
      await expect(page.locator(".brand-hero")).toBeVisible();
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      if (size === 0)
        await expect(
          page.getByRole("heading", { name: "A collection is on its way." }),
        ).toBeVisible();
      if (size === 1)
        await expect(page.locator(".buyer-spotlight-card")).toBeVisible();
      if (size === 8)
        await expect(
          page.locator(".store-product-grid .store-product-card"),
        ).toHaveCount(8);
      report.push({ theme, catalogSize: size, violations: [] });
    }
    await page.evaluate(() => scrollTo(0, 0));
    const before = await page
      .locator(".brand-cover-motion")
      .evaluate((el) => getComputedStyle(el).transform);
    await page.evaluate(() => scrollTo(0, 450));
    await expect
      .poll(() =>
        page
          .locator(".brand-cover-motion")
          .evaluate((el) => getComputedStyle(el).transform),
      )
      .not.toBe(before);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect(page.locator(".brand-cover-motion")).toBeVisible();
    await page.evaluate(() => scrollTo(0, 450));
    await expect(page.locator(".store-scroll-progress")).toHaveCount(0);
    expect(
      await page
        .locator(".brand-cover-motion")
        .evaluate((el) => getComputedStyle(el).transform),
    ).toBe("none");
    report.push({
      theme,
      motion: "scroll responds; reduced motion disables transforms",
      violations: [],
    });
    await context.close();
    console.log(
      `${theme}: storefront presentation inspected (orders ${commerceUi.orders ? "visible" : "hidden"})`,
    );
  }
} finally {
  await writeFile(`${dir}/verification.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
const failures = report.filter(
  (row) => row.violations.length || row.errors?.length,
);
if (failures.length) {
  console.log(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
} else
  console.log("All five themes passed responsive and accessibility checks.");
