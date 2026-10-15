import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const routes = [
  "dashboard",
  "inbox",
  "orders",
  "products",
  "website",
  "delivery",
  "payments",
  "customers",
  "marketing",
  "ads",
  "ai",
  "analytics",
  "settings",
];
test("all module shells render and keep an active navigation item", async ({
  page,
}) => {
  for (const route of routes) {
    await page.goto(`/${route}`);
    // App Router can retain a hidden previous route during navigation.
    // Assert the accessible page heading, excluding that cached tree.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (
      ["delivery", "payments", "marketing", "ads", "ai", "analytics"].includes(
        route,
      )
    ) {
      await expect(page.locator(`aside a[href="/${route}"]`)).toHaveCount(0);
    } else {
      await expect(page.locator(`aside a[aria-current=page]`)).toHaveAttribute(
        "href",
        `/${route}`,
      );
    }
  }
});
test("command opens with keyboard, navigates and closes with Escape", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByRole("textbox", { name: "Find a workspace" }).fill("orders");
  await dialog.getByRole("link", { name: "Orders", exact: true }).click();
  await expect(page).toHaveURL(/orders/);
  await page.keyboard.press("Control+k");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
test("mobile navigation works without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Products", exact: true })
    .click();
  await expect(page).toHaveURL(/products/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("modal traps focus, restores focus and reports demo feedback", async ({
  page,
}) => {
  await page.goto("/design-system");
  const trigger = page.getByRole("button", { name: "Open modal", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Show toast" }).click();
  await expect(
    page.getByText("This is a sample notification. Nothing was saved.", {
      exact: true,
    }),
  ).toBeVisible();
});
test("dashboard and component library pass automated accessibility checks", async ({
  page,
}) => {
  for (const route of ["dashboard", "design-system"]) {
    await page.goto(`/${route}`);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});

test("responsive visual snapshots", async ({ page }) => {
  for (const [name, width, height] of [
    ["desktop", 1440, 1080],
    ["tablet", 900, 1100],
    ["mobile", 390, 844],
    ["small-mobile", 320, 760],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/dashboard");
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `docs/screenshots/${name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("mobile shell has named controls and accessible contrast", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
