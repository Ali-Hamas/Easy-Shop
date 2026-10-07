import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("authenticated merchant and storefront buyer complete the reviewed reply journey", async ({ page, browser }) => {
  test.skip(process.env.EASY_SHOP_LIVE_VERIFY !== "1", "Requires the isolated Atlas verification backend.");
  test.setTimeout(600000);
  const suffix = Date.now().toString(36);
  const email = `handoff-${suffix}@example.test`;
  const password = `Test-only-${suffix}-Password`;
  const address = `handoff-${suffix}`;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/register");
  await page.getByLabel("Your name", { exact: true }).fill("Handoff Reviewer");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 60000 });
  await page.getByLabel("Shop name", { exact: true }).fill("Sunday Studio QA");
  await page.getByLabel("Shop address", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Check address availability" }).click();
  await expect(page.getByRole("status")).toContainText("available");
  await page.getByRole("button", { name: "Create shop", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The details that build trust.");
  await page.getByRole("button", { name: "Save & continue" }).click();
  await page.getByLabel("Product name", { exact: true }).fill("Olive canvas tote");
  await page.getByLabel("Price (BDT)").fill("1250");
  await page.getByLabel("Opening stock").fill("8");
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start with your storefront.");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start with your storefront.");
  await page.getByRole("button", { name: "Skip Meta & continue" }).click();
  await page.getByRole("radio", { name: /Suggest only/ }).check();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await page.getByRole("checkbox", { name: /Publish this shop/ }).check();
  await page.getByRole("button", { name: "Launch storefront" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your front door is open.");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your shop, at a glance." })).toBeVisible();
  await page.getByRole("button", { name: "User profile" }).click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your shop, at a glance." })).toBeVisible();
  const buyerContext = await browser.newContext();
  const buyer = await buyerContext.newPage();
  try {
    await buyer.goto(`http://localhost:3000/store/${address}`);
    await buyer.getByRole("button", { name: "Message the shop" }).click();
    await buyer.getByLabel("Your name", { exact: true }).fill("QA Buyer");
    await buyer.getByLabel("Message", { exact: true }).fill("Is the Olive canvas tote available and what is its price?");
    await buyer.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(buyer.getByRole("log")).toContainText("Is the Olive canvas tote available");
    await page.goto("/inbox");
    await page.getByRole("button", { name: /QA Buyer/ }).click();
    await page.getByRole("button", { name: /Generate AI draft/ }).first().click();
    await expect(page.getByRole("button", { name: "Approve draft", exact: true })).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: /Edit draft/i }).click();
    await page.getByLabel("Edit draft reply").fill("The Olive canvas tote is BDT 1250 and currently in stock.");
    await page.getByRole("button", { name: "Save edits", exact: true }).click();
    await expect(page.getByLabel("Edit draft reply")).not.toBeVisible();
    await page.getByRole("button", { name: "Approve draft", exact: true }).click();
    await expect(buyer.getByRole("log")).not.toContainText("The Olive canvas tote is BDT 1250");
    await page.getByRole("button", { name: /Send approved/i }).click();
    await expect(buyer.getByRole("log")).toContainText("The Olive canvas tote is BDT 1250", { timeout: 30000 });
    await page.goto("/customers");
    await expect(page.getByText("QA Buyer").first()).toBeVisible();
    for (const width of [1440, 1280, 1024, 768, 430, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of ["/dashboard", "/products", "/customers", "/inbox", `/store/${address}`]) {
        await page.goto(route);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (route === "/dashboard") await expect(page.getByRole("heading", { name: "Your shop, at a glance." })).toBeVisible();
        else if (route === "/inbox") await expect(page.getByRole("button", { name: /QA Buyer/ })).toBeVisible();
        else if (route === "/customers") await expect(page.getByText("QA Buyer").first()).toBeVisible();
        else if (route === "/products") await expect(page.getByText("Olive canvas tote").first()).toBeVisible();
        else await expect(page.getByRole("heading", { name: "Sunday Studio QA", level: 1 })).toBeVisible();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `docs/screenshots/handoff/${route.split("/")[1]}-${width}.png`, fullPage: true });
        if (width === 1440 || width === 390) {
          const violations = (await new AxeBuilder({ page }).analyze()).violations;
          expect(violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), `${route} ${width}`).toEqual([]);
        }
      }
    }
    expect(errors).toEqual([]);
  } finally { await buyerContext.close(); }
});
