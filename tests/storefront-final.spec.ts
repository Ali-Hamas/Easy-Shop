import { test, expect } from "@playwright/test";

test.describe("Three Final Corrections Verification", () => {
  test.setTimeout(240000);

  test("Task 1 & Task 2: Complete seller flow (no-store dashboard state, onboarding, launched dashboard state, storefront shopping, and responsive viewports)", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const suffix = Date.now().toString(36);
    const email = `seller-${suffix}@example.test`;
    const password = `Pass-${suffix}-Secure!`;
    const shopAddress = `shop-real-${suffix}`;

    // 1. Register
    await page.goto("/register");
    await page.getByLabel("Your name", { exact: true }).fill("Storefront Seller");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 60000 });

    // 2. Verify Seller with No Store on Dashboard
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible({
      timeout: 15000,
    });

    // Masthead should not have active store link yet
    await expect(page.locator(".quick-store-link")).not.toBeVisible();

    // Focus storefront hub in dashboard
    const unsetupHub = page.locator(".focus-storefront");
    await expect(unsetupHub).toBeVisible();

    // Status shows "Not set up"
    const unsetupStatusBadge = unsetupHub.locator(".store-status-badge");
    await expect(unsetupStatusBadge).toContainText("Not set up");

    // View Store button is disabled with explanation
    const disabledWrapper = unsetupHub.locator(".view-store-disabled-wrapper");
    await expect(disabledWrapper).toBeVisible();
    const disabledBtn = disabledWrapper.locator(".focus-storefront-btn-disabled");
    await expect(disabledBtn).toBeDisabled();

    // Focus or hover reveals the tooltip hint: "Please set up your store first."
    await disabledWrapper.focus();
    const hint = disabledWrapper.locator(".view-store-disabled-hint");
    await expect(hint).toHaveText("Please set up your store first.");

    // Obvious "Set Up Store" action is visible and directs to onboarding
    const setupBtn = unsetupHub.locator(".focus-setup-store-btn");
    await expect(setupBtn).toBeVisible();
    await expect(setupBtn).toHaveText("Set Up Store");
    await setupBtn.click();
    await expect(page).toHaveURL(/\/onboarding/);

    // 3. Complete Store Onboarding
    // Step 0: Identity
    await page.getByLabel("Shop name", { exact: true }).fill("Artisan Clothier");
    await page.getByLabel("Shop address", { exact: true }).fill(shopAddress);
    await page.getByRole("button", { name: "Check address availability" }).click();
    await expect(page.getByRole("status")).toContainText("available");
    await page.getByRole("button", { name: "Create shop", exact: true }).click();

    // Step 1: Policies
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The details that build trust.",
    );
    await page.getByLabel("Delivery charge").fill("100");
    await page.getByRole("button", { name: "Save & continue" }).click();

    // Step 2: First product
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Give your shop a first product.",
    );
    await page.getByLabel("Product name", { exact: true }).fill("Everyday Leather Tote");
    await page.getByLabel(/Price/).fill("1200");
    await page.getByLabel("Opening stock").fill("18");
    await page.getByRole("button", { name: "Save & continue" }).click();

    // Step 3: Meta connection
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Start with your storefront.",
    );
    await page.getByRole("button", { name: "Skip for now" }).first().click();

    // Step 4: AI Reply mode
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Decide how AI should help.",
    );
    await page.getByRole("radio", { name: /Suggest only/ }).check();
    await page.getByRole("button", { name: "Save & continue" }).click();

    // Step 5: Direction
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Choose a starting direction.",
    );
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Save & continue" }).click();

    // Step 6: Launch
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "One last look. Then launch.",
    );
    await page.getByRole("checkbox", { name: /Publish this shop/ }).check();
    await page.getByRole("button", { name: "Launch storefront" }).click();

    // Verification screen
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your front door is open.",
    );

    // 4. Navigate to Dashboard to verify View Store and Copy Link access
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Your shop, at a glance." }),
    ).toBeVisible({ timeout: 15000 });

    // Top masthead View Store action
    const topViewStore = page.locator(".quick-store-link");
    await expect(topViewStore).toBeVisible();
    await expect(topViewStore).toHaveAttribute("href", `/store/${shopAddress}`);

    // Storefront Hub in focus overview
    const hub = page.locator(".focus-storefront");
    await expect(hub).toBeVisible();
    await expect(hub.locator(".focus-shop-name")).toHaveText("Artisan Clothier");

    // Status is Live with live dot
    const statusBadge = hub.locator(".store-status-badge");
    await expect(statusBadge).toContainText("Live");

    // Store URL box
    const urlBox = hub.locator(".store-url-box");
    await expect(urlBox).toContainText(`/store/${shopAddress}`);

    // Copy Link action with feedback
    const copyBtn = hub.locator(".store-copy-link-btn");
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    const copyStatus = hub.locator(".store-copy-status");
    await expect(copyStatus).toBeVisible();
    await expect(copyStatus).toHaveText("Store link copied.");

    // Primary View Store button in hub
    const hubViewStore = hub.locator(".focus-storefront-btn");
    await expect(hubViewStore).toBeVisible();
    await expect(hubViewStore).toHaveAttribute("href", `/store/${shopAddress}`);

    // 5. Click View Store to open storefront
    await hubViewStore.click();
    await expect(page).toHaveURL(new RegExp(`/store/${shopAddress}`));

    // 6. Verify Storefront Structure
    // Header
    const buyerHeader = page.locator(".buyer-header");
    await expect(buyerHeader).toBeVisible();
    await expect(buyerHeader.locator(".buyer-brand-title")).toHaveText("Artisan Clothier");
    await expect(page.getByLabel("Search products in store")).toBeVisible();
    const bagBtn = page.locator(".buyer-bag-btn");
    await expect(bagBtn).toBeVisible();
    await expect(bagBtn.locator(".buyer-bag-badge")).toHaveText("0");

    // Store Hero
    const buyerHero = page.locator(".buyer-hero");
    await expect(buyerHero).toBeVisible();
    await expect(buyerHero.locator(".buyer-hero-brand h1")).toHaveText("Artisan Clothier");
    await expect(buyerHero).toContainText("1 curated item");

    // Adaptive catalog: Exactly 1 product -> Luxury spotlight card
    const spotlightCard = page.locator(".buyer-spotlight-card");
    await expect(spotlightCard).toBeVisible();
    await expect(spotlightCard.locator(".buyer-spotlight-name")).toHaveText(
      "Everyday Leather Tote",
    );
    await expect(spotlightCard.locator(".buyer-spotlight-price")).toContainText("1,200");
    await expect(spotlightCard.locator(".buyer-stock-pill")).toContainText("18 available");

    // Store Policies strip
    const policiesStrip = page.locator(".buyer-policies-strip");
    await expect(policiesStrip).toBeVisible();
    await expect(policiesStrip).toContainText("Fast Delivery");

    // Footer
    const buyerFooter = page.locator(".buyer-footer");
    await expect(buyerFooter).toBeVisible();
    await expect(buyerFooter.locator(".buyer-footer-name")).toHaveText("Artisan Clothier");
    await expect(buyerFooter).toContainText("Powered by Easy-Shop");

    // Storefront Chat launcher
    await expect(page.locator(".storefront-chat-launcher")).toBeVisible();

    // 7. Responsive Viewports Verification across 1440, 1280, 1024, 768, 430, 390, 375, 320
    const viewports = [1440, 1280, 1024, 768, 430, 390, 375, 320];
    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(50);

      await expect(buyerHeader).toBeVisible();
      await expect(buyerHero).toBeVisible();
      await expect(spotlightCard).toBeVisible();

      const hasOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth > root.clientWidth + 1;
      });
      expect(hasOverflow, `Horizontal overflow detected on storefront at ${width}px`).toBe(false);
    }

    // Reset viewport back to desktop for detail flow
    await page.setViewportSize({ width: 1280, height: 900 });

    // 8. Navigate to Product Detail Page
    const detailLink = spotlightCard.locator(".buyer-spotlight-detail-btn");
    await detailLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/store/${shopAddress}/products/everyday-leather-tote`),
    );

    // Product Detail Page verification
    const detailContainer = page.locator(".buyer-detail-container");
    await expect(detailContainer).toBeVisible();
    await expect(detailContainer.locator(".buyer-detail-title")).toHaveText(
      "Everyday Leather Tote",
    );
    await expect(detailContainer.locator(".buyer-detail-price")).toContainText("1,200");
    await expect(detailContainer.locator(".buyer-detail-stock")).toContainText(
      "18",
    );

    // Quantity selector: increase quantity
    const qtyDisplay = detailContainer.locator(".buyer-qty-display");
    await expect(qtyDisplay).toHaveText("1");
    const plusBtn = detailContainer.getByRole("button", { name: "Increase quantity" });
    await plusBtn.click();
    await expect(qtyDisplay).toHaveText("2");

    // Add to Bag action
    const addToBagBtn = detailContainer.locator(".buyer-add-to-bag-btn");
    await addToBagBtn.click();

    // Feedback in toast and bag badge
    await expect(page.locator(".buyer-toast")).toBeVisible();
    await expect(page.locator(".buyer-toast")).toContainText("Everyday Leather Tote");
    await expect(bagBtn.locator(".buyer-bag-badge")).toHaveText("2");

    // Cart Drawer opens automatically upon adding to bag
    const cartDrawer = page.locator(".buyer-cart-drawer");
    await expect(cartDrawer).toBeVisible();
    await expect(cartDrawer.locator(".buyer-cart-item-title")).toHaveText(
      "Everyday Leather Tote",
    );
    await expect(cartDrawer.locator(".buyer-cart-subtotal-val")).toContainText("2,400");

    // Close drawer
    await cartDrawer.locator(".buyer-cart-close-btn").click();
    await expect(cartDrawer).not.toBeVisible();

    // Reopen drawer by clicking the bag button in header
    await bagBtn.click();
    await expect(cartDrawer).toBeVisible();
    await cartDrawer.locator(".buyer-cart-close-btn").click();
    await expect(cartDrawer).not.toBeVisible();
  });

  test("Task 3: Public website final section redesign and content narrative", async ({
    page,
  }) => {
    await page.goto("/");

    // Locate the closing scene section
    const closingSection = page.locator(".studio-finale.closing-scene#launch");
    await expect(closingSection).toBeVisible();

    // Verify simplified live product environment
    const envStage = closingSection.locator(".closing-env-stage");
    await expect(envStage).toBeVisible();
    await expect(envStage.locator(".closing-env-live-badge")).toContainText("Storefront Live");
    await expect(envStage.locator(".closing-env-url")).toHaveText(
      "easy-shop.app/store/sunday-studio",
    );
    await expect(envStage.locator(".closing-env-supervision")).toContainText(
      "Grounded inventory · Supervised replies",
    );

    // Grounded product facts
    await expect(envStage.locator(".closing-product-name")).toHaveText("Everyday tote");
    await expect(envStage.locator(".closing-product-price")).toHaveText("৳ 850");
    await expect(envStage.locator(".closing-product-stock")).toHaveText("24 in stock");

    // Connected conversation and supervised reply
    await expect(envStage.locator(".closing-msg-author strong")).toHaveText("Nadia Ahmed");
    await expect(envStage.locator(".closing-verified-reply")).toBeVisible();
    await expect(envStage.locator(".closing-verified-tag")).toContainText(
      "Verified against live catalog",
    );

    // Closing statement & supporting text
    await expect(closingSection.locator(".closing-headline")).toContainText(
      "A little more clarity.",
    );
    await expect(closingSection.locator(".closing-headline")).toContainText(
      "A lot more room to grow.",
    );
    await expect(closingSection.locator(".closing-supporting")).toContainText(
      "Give your products a home and every conversation its context.",
    );

    // CTAs
    const primaryCta = closingSection.locator(".closing-primary-btn");
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toHaveText(/Create your store/);
    await expect(primaryCta).toHaveAttribute("href", "/register");

    const secondaryCta = closingSection.locator(".closing-secondary-btn");
    await expect(secondaryCta).toBeVisible();
    await expect(secondaryCta).toHaveText("Log in to workspace");
    await expect(secondaryCta).toHaveAttribute("href", "/login");

    // Closing wordmark
    await expect(closingSection.locator(".closing-wordmark")).toHaveText("easy shop.");
  });
});
