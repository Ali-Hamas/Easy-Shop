import { test, expect } from "@playwright/test";

test.describe("Onboarding and Product Validation UX", () => {
  test.setTimeout(240000);

  test("country, currency, language defaults and confirmation behavior", async ({
    page,
  }) => {
    const suffix = Date.now().toString(36);
    const email = `merchant-${suffix}@example.test`;
    const password = `Test-Pass-${suffix}-Secure`;

    // 1. Register to enter authenticated onboarding
    await page.goto("/register");
    await page.getByLabel("Your name", { exact: true }).fill("UX Reviewer");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 60000 });

    // 2. Verify Country selector is a structured selector with real country names
    const countrySelect = page.getByLabel("Country", { exact: true });
    await expect(countrySelect).toBeVisible();

    // Verify Default country (Bangladesh -> BDT, bn)
    const currencySelect = page.getByLabel("Currency", { exact: true });
    const languageSelect = page.getByLabel("Primary customer language", {
      exact: true,
    });
    await expect(currencySelect).toHaveValue("BDT");
    await expect(page.getByText("BDT - Bangladeshi Taka")).toBeAttached();

    // Verify Language label and helper text
    await expect(
      page.getByText(
        "Easy-Shop uses this as the default language for storefront and AI-assisted customer replies where supported.",
      ),
    ).toBeVisible();

    // 3. Select Pakistan -> defaults should automatically update to PKR and Urdu
    await countrySelect.selectOption("PK");
    await expect(currencySelect).toHaveValue("PKR");
    await expect(languageSelect).toHaveValue("ur");

    // 4. Select United Kingdom -> defaults should update to GBP and English
    await countrySelect.selectOption("GB");
    await expect(currencySelect).toHaveValue("GBP");
    await expect(languageSelect).toHaveValue("en");

    // 5. Select United States -> defaults to USD
    await countrySelect.selectOption("US");
    await expect(currencySelect).toHaveValue("USD");

    // 6. Select UAE -> defaults to AED
    await countrySelect.selectOption("AE");
    await expect(currencySelect).toHaveValue("AED");

    // 7. Manually change currency to USD and language to English
    await currencySelect.selectOption("USD");
    await languageSelect.selectOption("en");

    // 8. Now change country to Pakistan while dependent values were customized
    // Should trigger the confirmation modal!
    await countrySelect.selectOption("PK");
    const confirmModal = page.getByRole("dialog", {
      name: /Update defaults for Pakistan/,
    });
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal).toContainText("PKR");

    // Click "Keep custom settings"
    await page.getByRole("button", { name: "Keep custom settings" }).click();
    await expect(confirmModal).not.toBeVisible();
    await expect(currencySelect).toHaveValue("USD");
    await expect(languageSelect).toHaveValue("en");

    // Now change country to Bangladesh and this time click "Update defaults"
    await countrySelect.selectOption("BD");
    const bdModal = page.getByRole("dialog", {
      name: /Update defaults for Bangladesh/,
    });
    await expect(bdModal).toBeVisible();
    await page.getByRole("button", { name: "Update defaults" }).click();
    await expect(bdModal).not.toBeVisible();
    await expect(currencySelect).toHaveValue("BDT");
    await expect(languageSelect).toHaveValue("bn");
  });

  test("product form validation UX in onboarding step 2 and Meta connection flow", async ({
    page,
  }) => {
    const suffix = Date.now().toString(36);
    const email = `meta-${suffix}@example.test`;
    const password = `Test-Pass-${suffix}-Secure`;
    const address = `shop-${suffix}`;

    // 1. Register & start shop
    await page.goto("/register");
    await page.getByLabel("Your name", { exact: true }).fill("Meta Reviewer");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 60000 });

    await page.getByLabel("Shop name", { exact: true }).fill("Meta Store Test");
    await page.getByLabel("Shop address", { exact: true }).fill(address);
    await page
      .getByRole("button", { name: "Check address availability" })
      .click();
    await expect(page.getByRole("status")).toContainText("available");
    await page
      .getByRole("button", { name: "Create shop", exact: true })
      .click();

    // Step 1: Policies
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The details that build trust.",
    );
    await page.getByRole("button", { name: "Save & continue" }).click();

    // Step 2: First product validation
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Give your shop a first product.",
    );

    // Attempt to submit empty product
    await page.getByRole("button", { name: "Save & continue" }).click();

    // Human readable errors must appear
    const nameInput = page.getByLabel("Product name", { exact: true });
    await expect(nameInput).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Product name is required.")).toBeVisible();

    // Fix product name -> error clears live!
    await nameInput.fill("Handcrafted Ceramic Mug");
    await expect(page.getByText("Product name is required.")).not.toBeVisible();

    // Price validation
    const priceInput = page.getByLabel(/Price/);
    await priceInput.fill("0");
    await page.getByRole("button", { name: "Save & continue" }).click();
    await expect(
      page.getByText("Enter a valid price greater than 0."),
    ).toBeVisible();

    // Correct price live -> error clears
    await priceInput.fill("450");
    await expect(
      page.getByText("Enter a valid price greater than 0."),
    ).not.toBeVisible();

    // Fill valid opening stock
    const stockInput = page.getByLabel("Opening stock");
    await stockInput.fill("15");

    // Save product successfully
    await page.getByRole("button", { name: "Save & continue" }).click();

    // Step 3: Meta connection step
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Start with your storefront.",
    );
    await expect(
      page.getByRole("heading", { name: "Connect Facebook & Instagram" }),
    ).toBeVisible();

    // Both Connect and Skip options must be clearly visible
    const connectBtn = page.getByRole("button", {
      name: "Connect Facebook & Instagram",
    });
    const skipBtn = page.getByRole("button", { name: "Skip for now" }).first();
    await expect(connectBtn).toBeVisible();
    await expect(skipBtn).toBeVisible();

    // Clicking Connect must NOT fake a successful connection; it communicates dev status
    await connectBtn.click();
    await expect(
      page.getByText(
        "Meta connection is not configured in this development environment.",
      ),
    ).toBeVisible();

    // Skip allows proceeding without Meta
    await skipBtn.click();

    // Advances to AI mode
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Decide how AI should help.",
    );
    await page.getByRole("radio", { name: /Suggest only/ }).check();
    await page.getByRole("button", { name: "Save & continue" }).click();

    // Step 5: Template
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

    // Storefront launched
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your front door is open.",
    );

    // 7. Navigate to Products workspace to verify ProductEditor validation UX
    await page.goto("/products");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The facts behind every sale.",
    );

    await page
      .getByRole("button", { name: "Add product", exact: true })
      .click();

    // Provide SKU so only product name is invalid in Basics
    const nameField = page.getByLabel("Product name", { exact: true });
    const skuField = page.getByLabel("Product SKU", { exact: true });
    await skuField.fill("SILK-001");
    await nameField.fill("");

    // Submit invalid product
    await page.getByRole("button", { name: /Create/ }).click();

    // 1. Validation summary must appear
    await expect(
      page.getByRole("alert").filter({ hasText: /fields? need attention/ }),
    ).toBeVisible();

    // 2. Section tab "Basics" must receive error state indicator
    const basicsTab = page.getByRole("tab", { name: /Basics/ });
    await expect(basicsTab.locator(".editor-tab-error-badge")).toBeVisible();

    // 3. Human readable error beneath field
    await expect(page.getByText("Product name is required.")).toBeVisible();

    // 4. Focus moves to invalid field
    await expect(nameField).toBeFocused();

    // 5. Correcting field clears error and tab error badge
    await nameField.fill("Premium Silk Scarf");
    await expect(page.getByText("Product name is required.")).not.toBeVisible();
    await expect(basicsTab.locator(".editor-tab-error-badge")).toHaveCount(0);

    // 6. Test Pricing section validation
    const pricingTab = page.getByRole("tab", { name: /Pricing/ });
    await pricingTab.click();
    const priceField = page.getByLabel("Selling price");
    const compareField = page.getByLabel("Compare price (optional)", {
      exact: true,
    });

    await priceField.fill("1200");
    await compareField.fill("800"); // compare price lower than price
    await page.getByRole("button", { name: /Create/ }).click();

    // Error on comparePrice
    await expect(
      page.getByText(
        "Compare price must be greater than or equal to selling price.",
      ),
    ).toBeVisible();
    await expect(pricingTab.locator(".editor-tab-error-badge")).toBeVisible();

    // Correct compare price -> error clears immediately
    await compareField.fill("1500");
    await expect(
      page.getByText(
        "Compare price must be greater than or equal to selling price.",
      ),
    ).not.toBeVisible();
    await expect(pricingTab.locator(".editor-tab-error-badge")).toHaveCount(0);
  });

  test("responsive layout verification across mobile and desktop breakpoints", async ({
    page,
  }) => {
    const viewports = [1440, 1280, 1024, 768, 430, 390, 375, 320];

    await page.goto("/register");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });
      const noOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(
        noOverflow,
        `Width ${width} should not overflow horizontally`,
      ).toBe(true);
    }
  });
});
