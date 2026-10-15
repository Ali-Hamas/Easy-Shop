import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const widths = [1440, 1280, 1024, 768, 430, 390, 375, 320];
const product = {
  id: "test-product",
  slug: "olive-tote",
  name: "Olive tote",
  description: "Canvas tote with an inside pocket.",
  price: 850,
  stock: 12,
  imageUrl: "http://localhost:3000/images/olive-tote.webp",
  images: [
    "http://localhost:3000/images/olive-tote.webp",
    "http://localhost:3000/images/weekend-shirt.svg",
  ],
  variants: [
    { id: "olive", title: "Olive", price: 850, stock: 12 },
    { id: "natural", title: "Natural", price: 900, stock: 0 },
  ],
};
const shop = {
  id: "ui-shop",
  displayName: "Sunday Studio",
  subdomain: "ui-review",
  category: "Accessories",
  country: "Bangladesh",
  currency: "BDT",
  language: "en",
  status: "launched",
  policyDefaults: { deliveryCharge: 80, returnDays: 3, codAllowed: true },
};
test("storefront count layouts, product detail, search and accessible bag", async ({
  page,
}) => {
  test.setTimeout(240000);
  let count = 1;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/commerce/storefront/ui-review**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/products/"))
      return route.fulfill({
        json: { product: { ...product, currency: "BDT" } },
      });
    return route.fulfill({
      json: {
        shop,
        template: { id: "test" },
        products: Array.from({ length: count }, (_, i) => ({
          ...product,
          id: i ? "item-" + i : product.id,
          slug: i ? "item-" + i : product.slug,
          name: i ? "Canvas piece " + i : product.name,
        })),
      },
    });
  });
  for (count of [0, 1, 3, 6]) {
    await page.goto("/store/ui-review");
    await expect(
      page.getByRole("heading", { name: "Sunday Studio", level: 1 }),
    ).toBeVisible();
    if (count === 1)
      await expect(page.locator(".buyer-spotlight-card")).toHaveCount(1);
    if (count === 3)
      await expect(page.locator(".buyer-card-curated")).toHaveCount(3);
    if (count === 6)
      await expect(page.locator(".buyer-catalog-grid .buyer-card")).toHaveCount(
        6,
      );
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page
    .getByRole("textbox", { name: "Search products in store" })
    .fill("nothingmatches");
  await expect(page.locator(".buyer-empty")).toBeVisible();
  await page.goto(
    "/store/ui-review/products/olive-tote?productId=test-product",
  );
  await expect(
    page.getByRole("heading", { name: "Olive tote", level: 1 }),
  ).toBeVisible();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if ([1440, 390].includes(width))
      await page.screenshot({
        path: `docs/screenshots/three-ui/product-${width}.png`,
        fullPage: true,
      });
  }
  await page.getByRole("button", { name: /Add to/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Shopping Bag" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  expect(errors).toEqual([]);
});
test("public opening is visible, scroll linked and responsive", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/");
  await expect(page.locator(".connected-hero-stage")).toHaveCSS(
    "opacity",
    "1",
    { timeout: 30000 },
  );
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if ([1440, 390].includes(width))
      await page.screenshot({
        path: `docs/screenshots/three-ui/hero-final-${width}.png`,
      });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    const e = document.querySelector("#story") as HTMLElement;
    window.scrollTo(0, e.offsetTop);
  });
  await expect(page.locator("#story .connected-reply")).toHaveCSS(
    "opacity",
    "0",
  );
  await page.evaluate(() => {
    const e = document.querySelector("#story") as HTMLElement;
    window.scrollTo(0, e.offsetTop + (e.offsetHeight - innerHeight) * 0.85);
  });
  await expect(page.locator("#story .connected-reply")).toHaveCSS(
    "opacity",
    "1",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#story")).toHaveAttribute("data-static", "true");
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});

test("dashboard store identity covers not set up, draft and live states", async ({
  page,
}) => {
  test.skip(
    process.env.EASY_SHOP_LIVE_VERIFY !== "1",
    "Requires disposable Atlas verification backend",
  );
  test.setTimeout(180000);
  const id = Date.now().toString(36);
  const origin = { Origin: "http://localhost:3000" };
  const register = await page.request.post("/api/commerce/auth/register", {
    headers: origin,
    data: {
      name: "UI Reviewer",
      email: `ui-${id}@example.test`,
      password: `UI-review-${id}-safe`,
    },
  });
  expect(register.ok()).toBe(true);
  await page.goto("/dashboard");
  await expect(page.locator(".focus-storefront")).toContainText("Not set up");
  await expect(page.locator(".focus-facts")).toHaveCount(0);
  const start = await page.request.post("/api/commerce/onboarding/start", {
    headers: origin,
    data: {
      ownerName: "UI Reviewer",
      shopName: "Sunday UI Review",
      subdomain: `ui-${id}`,
      category: "Accessories",
      country: "Bangladesh",
      currency: "BDT",
      language: "en",
    },
  });
  expect(start.ok()).toBe(true);
  const state = await start.json();
  const shopId = state.shop.id;
  await page.goto("/dashboard");
  await expect(page.locator(".focus-storefront")).toContainText("Draft");
  await expect(page.getByRole("link", { name: "Preview Store" })).toBeVisible();
  const mutate = async (path: string, data?: object, method = "POST") => {
    const response = await page.request.fetch(
      `/api/commerce/onboarding/${shopId}/${path}`,
      { method, headers: origin, data },
    );
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await mutate("products", { name: "Olive tote", price: 850, stock: 12 });
  await mutate("channels/meta/skip");
  await mutate("ai-mode", { aiMode: "suggest" }, "PATCH");
  await mutate("template", { templateId: state.templates[0].id });
  await mutate("launch");
  await page.goto("/dashboard");
  await expect(page.locator(".focus-storefront")).toContainText("Live");
  await expect(page.locator(".focus-facts")).toBeVisible();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if ([1440, 390].includes(width))
      await page.screenshot({
        path: `docs/screenshots/three-ui/dashboard-${width}.png`,
        fullPage: true,
      });
  }
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "Copy customer-facing storefront URL" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Store link copied." }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});
