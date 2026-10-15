import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("all requested widths preserve dashboard and laboratory layout", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 1280, 1024, 768, 430, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["dashboard", "design-system"]) {
      await page.goto(`/${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true);
      await page.screenshot({
        caret: "initial",
        path: `docs/screenshots/elevation/${route}-${width}.png`,
        fullPage: route === "dashboard",
      });
    }
  }
});
test("sidebar collapse retains navigation and restores its width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard");
  const aside = page.locator("aside.sidebar");
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await expect(aside).toHaveCSS("width", "72px");
  await aside.getByRole("link", { name: "Orders", exact: true }).click();
  await expect(page).toHaveURL(/orders/);
  await expect(
    aside.getByRole("link", { name: "Orders", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await expect(aside).toHaveCSS("width", "224px");
});
test("detail drawer scrolls independently and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/design-system");
  const trigger = page.getByRole("button", {
    name: "Preview detail drawer",
    exact: true,
  });
  await trigger.click();
  const drawer = page.getByRole("dialog");
  await expect(
    drawer.getByRole("heading", { name: "Order #1048" }),
  ).toBeVisible();
  const body = drawer.locator(".overlay-body");
  expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(
    drawer.getByRole("button", { name: "Close preview" }),
  ).toBeInViewport();
  await expect(
    drawer.getByRole("heading", { name: "Order #1048" }),
  ).toBeInViewport();
  await body.evaluate((el) => el.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/screenshots/elevation/detail-drawer.png",
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test("laboratory interactions and AI states remain local", async ({ page }) => {
  await page.goto("/design-system");
  const search = page.getByRole("searchbox", { name: "Search sample orders" });
  await search.fill("1048");
  await page
    .getByRole("button", { name: "Clear search sample orders" })
    .click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await page.getByRole("tab", { name: "Timeline", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Illustrative events only",
  );
  await page.getByLabel("AI state preview").selectOption("thinking");
  await expect(
    page.getByRole("status").filter({ hasText: "Preparing a reply" }),
  ).toBeVisible();
  await page.getByLabel("AI state preview").selectOption("approval");
  await expect(page.locator(".ai-state")).toHaveText("Approval required");
  await page
    .locator("#ai-components")
    .screenshot({ path: "docs/screenshots/elevation/ai-components.png" });
  await page.getByRole("button", { name: "Open modal", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/elevation/approval-modal.png",
  });
  await page.keyboard.press("Escape");
});
test("mobile laboratory and command surface pass accessibility checks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/design-system");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Ask AI to do work", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "docs/screenshots/elevation/mobile-command.png",
  });
});
