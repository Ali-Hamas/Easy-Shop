import { test, expect } from "@playwright/test";

test.describe("Storefront Product Display & Preview Mode Verification", () => {
  test.setTimeout(120000);

  test("Draft store displays products in preview mode and provides draft banner with dashboard navigation", async ({
    page,
    request,
  }) => {
    const suffix = Date.now().toString(36);
    const email = `seller-preview-${suffix}@example.test`;
    const password = `Secure-Pass-${suffix}!`;
    const shopAddress = `preview-shop-${suffix}`;

    // 1. Register seller
    await page.goto("/register");
    await page.getByLabel("Your name", { exact: true }).fill("Preview Merchant");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 30000 });

    // 2. Set up shop identity in onboarding
    await page.getByLabel("Shop name", { exact: true }).fill("Boutique Preview");
    await page.getByLabel("Shop address", { exact: true }).fill(shopAddress);
    await page.getByRole("button", { name: "Check address availability" }).click();
    await expect(page.getByRole("status")).toContainText("available");
    await page.getByRole("button", { name: "Create shop", exact: true }).click();

    // Set up policies
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The details that build trust.",
    );
    await page.getByLabel("Delivery charge").fill("150");
    await page.getByRole("button", { name: "Save & continue" }).click();

    // Add product in onboarding
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Give your shop a first product.",
    );
    await page.getByLabel("Product name", { exact: true }).fill("Silk Embroidered Scarf");
    await page.getByLabel(/Price/).fill("2400");
    await page.getByLabel("Opening stock").fill("12");
    await page.getByRole("button", { name: "Save & continue" }).click();

    // 3. Do NOT launch yet - shop remains in 'draft' status.
    // Verify that public unauthenticated visit to unlaunched shop returns 404
    const publicRes = await request.get(`http://127.0.0.1:4000/api/v1/storefront/${shopAddress}`);
    expect(publicRes.status()).toBe(404);

    // 4. Now visit storefront in preview mode: /store/:subdomain?preview=true
    await page.goto(`/store/${shopAddress}?preview=true`);

    // Verify Draft Preview Banner is visible
    const previewBanner = page.locator(".store-preview-banner");
    await expect(previewBanner).toBeVisible();
    await expect(previewBanner.locator(".store-preview-tag")).toHaveText("Draft Preview");
    await expect(previewBanner).toContainText(
      "This shop is currently in draft. Complete setup from your seller dashboard to launch it for buyers.",
    );

    // Verify product is displayed on the storefront
    await expect(page.locator(".buyer-hero-brand h1")).toHaveText("Boutique Preview");
    const spotlightCard = page.locator(".buyer-spotlight-card");
    await expect(spotlightCard).toBeVisible();
    await expect(spotlightCard.locator(".buyer-spotlight-name")).toHaveText(
      "Silk Embroidered Scarf",
    );
    await expect(spotlightCard.locator(".buyer-spotlight-price")).toContainText("2,400");
    await expect(spotlightCard.locator(".buyer-stock-pill")).toContainText("12 available");

    // Click "Seller Dashboard" in the preview banner to verify seamless navigation
    await previewBanner.getByRole("link", { name: "Seller Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator(".store-preview-action-btn")).toBeVisible();
  });
});
