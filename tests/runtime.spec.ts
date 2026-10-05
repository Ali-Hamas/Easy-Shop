import { test, expect } from "@playwright/test";
test("no hydration or browser errors with reduced motion", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system");
  await expect(
    page.getByRole("button", { name: "Preview detail drawer", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preview detail drawer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(errors).toEqual([]);
});
