import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("inventory real API editor, safe adjustment, ledger and responsive views", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.EASY_SHOP_LIVE_VERIFY !== "1",
    "Requires isolated Atlas verification backend",
  );
  test.setTimeout(240000);
  const origin = "http://localhost:3000";
  await page.setViewportSize({ width: 1440, height: 1000 });
  const setup = await request.post("/api/commerce/onboarding/start", {
    headers: { origin },
    data: {
      ownerName: "Inventory UI reviewer",
      shopName: "Fieldwork Supply",
      subdomain: `inventory-${Date.now().toString(36)}`,
      category: "Home",
      country: "Bangladesh",
      currency: "BDT",
      language: "en",
    },
  });
  expect(setup.status()).toBe(201);
  const state = await setup.json();
  await page.addInitScript((id) => {
    sessionStorage.setItem("easy-shop:onboarding-id", id);
    sessionStorage.setItem("easy-shop:onboarding-id:name", "Fieldwork Supply");
  }, state.shop.id);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/products");
  await expect(
    page.getByRole("heading", { name: "Start with one good product." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Everyday Canvas Tote");
  await page.getByLabel("Product SKU (optional)", { exact: true }).fill("BAG-001");
  await page.getByLabel("Category", { exact: true }).last().fill("Bags");
  await page
    .getByLabel("Product status", { exact: true })
    .selectOption("active");
  await page.getByRole("tab", { name: "Pricing", exact: true }).click();
  await page.getByLabel("Selling price").fill("850");
  await page
    .getByLabel("Compare price (optional)", { exact: true })
    .fill("950");
  await page
    .getByRole("tab", { name: "Variants & stock", exact: true })
    .click();
  await page
    .getByLabel("Variant SKU 1 (optional)", { exact: true })
    .fill("BAG-001-OLIVE");
  await page
    .getByLabel("Variant name 1", { exact: true })
    .fill("Olive / One size");
  await page.getByLabel("Color 1", { exact: true }).fill("Olive");
  await page.getByLabel("Opening stock 1", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Create active product" }).click();
  await expect(
    page.getByRole("dialog", { name: "Everyday Canvas Tote", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("12 available", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Adjust", exact: true }).click();
  await page.getByLabel("Quantity change", { exact: true }).fill("-20");
  await page.getByLabel("Reason for adjustment").fill("Physical stock count");
  await page.getByLabel("I reviewed the quantities and reason.").check();
  await expect(
    page.getByRole("button", { name: "Confirm adjustment" }),
  ).toBeDisabled();
  await page.getByLabel("Quantity change", { exact: true }).fill("-9");
  await page.getByLabel("I reviewed the quantities and reason.").check();
  await page.getByRole("button", { name: "Confirm adjustment" }).click();
  await expect(page.getByText("3 available", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByText("Physical stock count", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/inventory/detail-1440.png",
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  for (const width of [1440, 1280, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      page
        .getByText("Everyday Canvas Tote", { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/inventory/list-${width}.png`,
      fullPage: true,
    });
    if (width === 390 || width === 1440)
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.getByLabel("Stock", { exact: true }).selectOption("out");
  await expect(
    page.getByRole("heading", { name: "No products match this view." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page
    .getByRole("button", { name: /Everyday Canvas Tote/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Edit product", exact: true }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("A durable canvas carryall.");
  await page.getByRole("tab", { name: "Variants & stock" }).click();
  for (const width of [1440, 1280, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: `docs/screenshots/inventory/editor-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "docs/screenshots/inventory/editor-390.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Everyday Canvas Tote", exact: true }),
  ).toBeVisible();
});
test("scroll scenes visibly advance and reduced motion retains manual controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".hero-environment")).toBeVisible();
  const start = await page
    .locator(".hero-environment")
    .evaluate((el) => getComputedStyle(el).transform);
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() =>
      page
        .locator(".hero-environment")
        .evaluate((el) => getComputedStyle(el).transform),
    )
    .not.toBe(start);
  await page.locator("#operations").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.locator(".inventory-story")).toHaveAttribute(
    "data-step",
    "4",
  );
  await expect(
    page
      .locator(".inventory-story")
      .getByText("Low stock", { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await page.locator("#storefront").scrollIntoViewIfNeeded();
  await expect(page.locator("#storefront .collection-satellite")).toHaveCount(
    4,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("#storefront .collection-hero")).toHaveCSS(
    "opacity",
    "1",
  );
  await page
    .getByRole("button", { name: "Stock changes", exact: true })
    .click();
  await expect(page.locator(".inventory-story")).toHaveAttribute(
    "data-step",
    "1",
  );
  await expect(
    page.locator(".inventory-story .story-stock-number"),
  ).toContainText("12");
});
