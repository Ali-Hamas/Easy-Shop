import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { emptyStorefrontContent } from "../types/storefront-content";
import { storefrontThemeIds } from "../config/storefront-themes";
import { releaseNavigation } from "../config/navigation";

// Browser-only presentation fixtures: never seed products or reviews into a shop.
const samples = [
  ["Olive everyday tote", "olive-tote.webp"],
  ["Canvas organiser", "canvas-pouch.svg"],
  ["Weekend shirt", "weekend-shirt.svg"],
  ["Daily sandals", "daily-sandals.svg"],
  ["Natural cotton tote", "natural-tote.svg"],
  ["Hand balm", "hand-balm.svg"],
];
for (const themeId of storefrontThemeIds) {
  test(`${themeId}: browse-only storefront, dense grid and scroll motion`, async ({
    page,
  }) => {
    const errors: string[] = [];
    const writes: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const products = samples.map(([name, image], index) => ({
      id: `fixture-${index}`,
      slug: `product-${index}`,
      name,
      imageUrl: `/images/${image}`,
      images: [`/images/${image}`],
      price: 450 + index * 100,
      stock: 12,
      category: index < 4 ? "Everyday pieces" : "Personal essentials",
      description: "Thoughtfully selected for everyday use.",
      variants: [
        {
          id: `variant-${index}`,
          title: "Default",
          price: 450 + index * 100,
          stock: 12,
          sku: null,
        },
      ],
    }));
    let catalog = products;
    const content = {
      ...emptyStorefrontContent,
      design: { ...emptyStorefrontContent.design, themeId },
      headline: "For the things you carry.",
      description:
        "Useful pieces for work, weekends and the moments in between.",
      coverImage: "/images/olive-tote.webp",
      storyTitle: "A little less. A little better.",
      story:
        "Sunday Studio began with a simple idea: the things we reach for every day deserve a little more thought.",
      email: "hello@example.test",
      featuredProductIds: [products[0].id],
    };
    await page.route("**/api/commerce/storefront/browse-fixture**", (route) => {
      if (route.request().method() !== "GET")
        writes.push(route.request().url());
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/reviews"))
        return route.fulfill({
          json: {
            reviews: [],
            count: 0,
            average: null,
            distribution: [5, 4, 3, 2, 1].map((rating) => ({
              rating,
              count: 0,
            })),
            page: 1,
            hasMore: false,
          },
        });
      if (url.pathname.includes("/products/"))
        return route.fulfill({
          json: { product: { ...products[0], currency: "BDT" } },
        });
      return route.fulfill({
        json: {
          shop: {
            id: "fixture",
            displayName: "Sunday Studio",
            subdomain: "browse-fixture",
            category: "Everyday essentials",
            country: "Bangladesh",
            currency: "BDT",
            language: "en",
            status: "launched",
            content,
            selectedTemplateId: themeId,
            policyDefaults: {
              deliveryCharge: 80,
              returnDays: 3,
              codAllowed: true,
            },
          },
          template: { id: themeId },
          products: catalog,
        },
      });
    });
    await page.goto("/store/browse-fixture");
    await expect(page.locator(".store-product-card")).toHaveCount(6);
    await expect(page.locator("#order-tracking")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /bag|checkout|Place order/i }),
    ).toHaveCount(0);
    expect(releaseNavigation.some((item) => item.slug === "orders")).toBe(
      false,
    );
    await mkdir("docs/screenshots/storefront-browse", { recursive: true });
    for (const [width, columns] of [
      [1440, 4],
      [1024, 3],
      [390, 2],
      [320, 2],
    ]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(() =>
          page
            .locator(".store-product-grid")
            .evaluate(
              (el) =>
                getComputedStyle(el).gridTemplateColumns.split(" ").length,
            ),
        )
        .toBe(columns);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 1440 || width === 390) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: `docs/screenshots/storefront-browse/${themeId}-${width}.png`,
          fullPage: true,
        });
      }
    }
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 1000 });
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
    await page
      .getByRole("link", { name: "View details", exact: true })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      products[0].name,
    );
    await expect(page.locator(".buyer-purchase-actions")).toHaveCount(0);
    await expect(page.locator("#order-tracking")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /bag|checkout|Place order/i }),
    ).toHaveCount(0);
    // Two genuine catalog entries retain compact four-column sizing; no fillers.
    catalog = products.slice(0, 2);
    await page.goto("/store/browse-fixture");
    await expect(page.locator(".store-product-card")).toHaveCount(2);
    expect(
      await page
        .locator(".store-product-grid")
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        ),
    ).toBe(4);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect(page.locator(".store-product-card")).toHaveCount(2);
    await page.evaluate(() => scrollTo(0, 450));
    expect(
      await page
        .locator(".brand-cover-motion")
        .evaluate((el) => getComputedStyle(el).transform),
    ).toBe("none");
    await expect(page.locator(".store-scroll-progress")).toHaveCount(0);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}
