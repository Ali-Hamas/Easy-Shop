import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("real Atlas shop setup, resume, publish and public product reads", async ({
  page,
}) => {
  test.skip(
    process.env.EASY_SHOP_LIVE_VERIFY !== "1",
    "Requires the isolated Atlas verification backend on port 4000.",
  );
  test.setTimeout(240000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding");
  await expect(page.getByText("Loading saved setup…")).not.toBeVisible({
    timeout: 30000,
  });
  const suffix = Date.now().toString(36);
  const address = `atelier-ui-${suffix}`;
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Integration Reviewer");
  await page.getByLabel("Shop name", { exact: true }).fill("Atelier Sunday");
  await page.getByLabel("Shop address", { exact: true }).fill(address);
  await page
    .getByRole("button", { name: "Check address availability" })
    .click();
  await expect(page.getByRole("status")).toContainText("available");
  await page.getByRole("button", { name: "Create development shop" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The details that build trust.",
    { timeout: 30000 },
  );
  await expect(page).toHaveURL(/shop=/);
  await page.getByLabel("Business address (optional)").fill("Dhaka");
  await page.getByLabel("Delivery charge").fill("80");
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Give your shop a first product.",
  );
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Everyday Carry Tote");
  await page.getByLabel("Price (BDT)").fill("850");
  await page.getByLabel("Opening stock").fill("24");
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Start with your storefront.",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Start with your storefront.",
    { timeout: 30000 },
  );
  await page.getByRole("button", { name: "Skip Meta & continue" }).click();
  await page.getByRole("radio", { name: /Suggest only/ }).check();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(
    page.getByRole("button", { name: "Launch storefront" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /Publish this development shop/ })
    .check();
  await page.getByRole("button", { name: "Launch storefront" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your front door is open.",
    { timeout: 30000 },
  );
  await page
    .getByRole("link", { name: "Open storefront", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Atelier Sunday", level: 1 }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("24 available", { exact: true })).toBeVisible();
  const productLink = page.getByRole("link", { name: "Everyday Carry Tote" });
  const productUrl = await productLink.getAttribute("href");
  expect(productUrl).toContain("everyday-carry-tote");
  for (const width of [1440, 1280, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [`/store/${address}`, productUrl!, "/dashboard"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (route === "/dashboard") {
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Your shop is out in the world.",
          { timeout: 30000 },
        );
      }
      await expect(page.getByText("Opening the shop…")).not.toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByText("Loading your saved shop…")).not.toBeVisible({
        timeout: 30000,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const name =
        route === "/dashboard"
          ? "dashboard-live"
          : route === productUrl
            ? "product-live"
            : "storefront-live";
      await page.screenshot({
        path: `docs/screenshots/combined/${name}-${width}.png`,
        fullPage: true,
        caret: "initial",
      });
      if (width === 1440 || width === 390)
        expect(
          (await new AxeBuilder({ page }).analyze()).violations,
          route,
        ).toEqual([]);
    }
  }
  await page.goto(productUrl!);
  await expect(page.locator(".buyer-price")).toContainText("850");
  await expect(page.getByText("24 available", { exact: true })).toBeVisible();
  await page.goto(`/store/${address}/products/missing-product`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "isn’t available",
    { timeout: 30000 },
  );
});
test("API bridge rejects unapproved paths and cross-origin writes", async ({
  request,
}) => {
  const outside = await request.get("/api/commerce/system");
  expect(outside.status()).toBe(404);
  const cross = await request.post("/api/commerce/onboarding/start", {
    headers: { origin: "https://not-this-app.example" },
    data: {},
  });
  expect(cross.status()).toBe(403);
});
test("onboarding keeps input after failure and storefront handles empty catalog", async ({
  page,
}) => {
  await page.route("**/api/commerce/onboarding/templates", (r) =>
    r.fulfill({ json: { templates: [] } }),
  );
  await page.route("**/api/commerce/onboarding/start", (r) =>
    r.fulfill({
      status: 503,
      json: {
        code: "DATABASE_UNAVAILABLE",
        message: "The shop service is temporarily unavailable.",
      },
    }),
  );
  await page.goto("/onboarding");
  await page.getByLabel("Your name", { exact: true }).fill("Test Owner");
  await page.getByLabel("Shop name", { exact: true }).fill("Test Shop");
  await page.getByLabel("Shop address", { exact: true }).fill("test-shop");
  await page.getByRole("button", { name: "Create development shop" }).click();
  await expect(page.locator(".setup-error")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.getByLabel("Shop name", { exact: true })).toHaveValue(
    "Test Shop",
  );
  await page.route("**/api/commerce/storefront/empty-test", (r) =>
    r.fulfill({
      json: {
        shop: {
          id: "test",
          displayName: "Empty Catalog Test",
          subdomain: "empty-test",
          category: "Home",
          country: "Bangladesh",
          currency: "BDT",
          policyDefaults: {
            deliveryCharge: 0,
            returnDays: 3,
            codAllowed: true,
          },
        },
        template: { id: "test" },
        products: [],
      },
    }),
  );
  await page.goto("/store/empty-test");
  await expect(
    page.getByRole("heading", { name: "A collection is on its way." }),
  ).toBeVisible();
  await page.route("**/api/commerce/storefront/network-test", (r) => r.abort());
  await page.goto("/store/network-test");
  await expect(
    page.getByRole("heading", { name: "The shop is taking a moment." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
