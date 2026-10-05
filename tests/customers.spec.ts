import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("real Customer directory, profile, notes, tags, conflicts and responsive layouts", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.EASY_SHOP_LIVE_VERIFY !== "1",
    "Requires isolated Atlas backend",
  );
  test.setTimeout(240000);
  const setup = await request.post("/api/commerce/onboarding/start", {
    headers: { origin: "http://localhost:3000" },
    data: {
      ownerName: "Customer reviewer",
      shopName: "Sunday Studio",
      subdomain: `crm-ui-${Date.now().toString(36)}`,
      category: "Home",
      country: "Bangladesh",
      currency: "BDT",
      language: "en",
    },
  });
  expect(setup.status()).toBe(201);
  const { shop } = await setup.json();
  await page.addInitScript((id) => {
    sessionStorage.setItem("easy-shop:onboarding-id", id);
    sessionStorage.setItem("easy-shop:onboarding-id:name", "Sunday Studio");
  }, shop.id);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/customers");
  await expect(
    page.getByRole("heading", { name: "Make room for your first customer" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Nadia Ahmed");
  await page.getByLabel("Phone", { exact: true }).fill("+8801700123456");
  await page.getByLabel("Email", { exact: true }).fill("nadia@example.test");
  await page.getByLabel("Tags", { exact: true }).fill("VIP, Repeat customer");
  await page.getByLabel("Preferred language").selectOption("bn");
  await page.getByRole("button", { name: "Add address", exact: true }).click();
  await page.getByLabel("Street address").fill("12 Garden Road");
  await page.getByLabel("City", { exact: true }).fill("Dhaka");
  await page
    .getByRole("button", { name: "Save customer", exact: true })
    .click();
  const profile = page.getByRole("dialog", {
    name: "Nadia Ahmed",
    exact: true,
  });
  await expect(profile).toBeVisible();
  await expect(
    profile.getByText("Record created", { exact: true }),
  ).toBeVisible();
  await expect(
    profile.getByText("No connected order or return history yet.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Note", { exact: true })
    .fill("Prefers earthy colours. Confirm sizing before an order.");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(
    profile.getByText(
      "Prefers earthy colours. Confirm sizing before an order.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit customer", exact: true })
    .click();
  await page.getByLabel("Customer status").selectOption("inactive");
  await expect(
    page.getByRole("button", { name: "Save customer" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByLabel("Tags", { exact: true }).fill("VIP, Inactive");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(profile).toBeVisible();
  await expect(
    profile.getByText("Details updated", { exact: true }),
  ).toBeVisible();
  for (const width of [1440, 1280, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `docs/screenshots/customer-motion/profile-${width}.png`,
    });
  }
  expect(
    (
      await new AxeBuilder({ page })
        .include(".customer-profile")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByLabel("Status", { exact: true }).selectOption("active");
  await expect(
    page.getByRole("heading", { name: "No matching customers" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Tag", { exact: true }).fill("vip");
  await expect(page.locator(".customer-mobile-list")).toContainText(
    "Nadia Ahmed",
  );
  for (const width of [1440, 1280, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `docs/screenshots/customer-motion/directory-${width}.png`,
    });
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Duplicate person");
  await page.getByLabel("Phone", { exact: true }).fill("+8801700123456");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByRole("alert")).toContainText("existing customer");
  await expect(page.getByLabel("Full name")).toHaveValue("Duplicate person");
  await page.keyboard.press("Escape");
  await page.route("**/api/commerce/customers/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        code: "DATABASE_UNAVAILABLE",
        message: "Database temporarily unavailable.",
      }),
    }),
  );
  await page.getByLabel("Search customers").fill("failure");
  await expect(
    page.getByRole("button", { name: "Retry directory" }),
  ).toBeVisible();
  await page.unrouteAll();
  await page.getByRole("button", { name: "Retry directory" }).click();
  await expect(
    page.getByRole("heading", { name: "No matching customers" }),
  ).toBeVisible();
});
test("progressive scroll assembly, stable reverse scroll and complete small-screen collection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#story")).toHaveAttribute(
    "data-scroll-mode",
    "motion",
  );
  async function at(selector: string, progress: number) {
    await page.locator(selector).evaluate((el, p) => {
      const target = el as HTMLElement;
      window.scrollTo(
        0,
        target.offsetTop + (target.offsetHeight - innerHeight) * p,
      );
    }, progress);
    await page.waitForTimeout(180);
  }
  await at("#story", 0.3);
  const early = await page
    .locator("#story .desk-draft")
    .evaluate((e) => Number(getComputedStyle(e).opacity));
  await expect(page.locator("#story .desk-customer")).not.toHaveCSS(
    "opacity",
    "0",
  );
  await at("#story", 0.95);
  await expect(page.locator("#story .desk-draft")).toHaveCSS("opacity", "1");
  expect(early).toBeLessThan(0.1);
  await at("#story", 0.3);
  await expect
    .poll(() =>
      page
        .locator("#story .desk-draft")
        .evaluate((e) => Number(getComputedStyle(e).opacity)),
    )
    .toBeLessThan(0.1);
  await at("#storefront", 0.25);
  const a = await page
    .locator(".satellite-0")
    .evaluate((e) => Number(getComputedStyle(e).opacity));
  const b = await page
    .locator(".satellite-3")
    .evaluate((e) => Number(getComputedStyle(e).opacity));
  expect(a).toBeGreaterThan(b);
  await at("#storefront", 0.9);
  await expect(page.locator(".satellite-3")).toHaveCSS("opacity", "1");
  for (const width of [1440, 1280, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#storefront").scrollIntoViewIfNeeded();
    await expect(page.locator(".satellite-3")).toHaveCSS("opacity", "1");
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `docs/screenshots/customer-motion/collection-${width}.png`,
    });
    await page.locator(".studio-finale").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `docs/screenshots/customer-motion/finale-${width}.png`,
    });
  }
});
