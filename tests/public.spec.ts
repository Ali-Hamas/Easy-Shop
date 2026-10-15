import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("public workspace interactions and supervised reply", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Your shop.");
  const tour = page.getByRole("group", {
    name: "Explore the operating system",
  });
  for (const name of [
    "Storefront",
    "Inventory",
    "Customers",
    "AI replies",
    "Overview",
  ]) {
    await tour.getByRole("button", { name, exact: true }).click();
    await expect(
      tour.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: "Try an example draft" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Edit the example reply")
    .fill("The olive tote is available.");
  await page.getByRole("button", { name: "Finish editing" }).click();
  await page.getByRole("button", { name: "Approve draft" }).click();
  await page.getByRole("button", { name: "Preview send" }).click();
  await expect(
    page.getByText("Demo complete. No message was sent."),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Story steps" })
    .getByRole("button", { name: "You decide" })
    .click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});
test("two scroll narratives advance and manual mobile controls work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page
    .getByRole("group", { name: "Story steps" })
    .getByRole("button", { name: "The facts connect" })
    .click();
  for (const selector of ["#story", "#workflow"]) {
    const target = await page.locator(selector).boundingBox();
    const top = target!.y + (await page.evaluate(() => scrollY));
    await page.evaluate(
      ({ top, height }) =>
        window.scrollTo(0, top + (height - innerHeight) * 0.92),
      { top, height: target!.height },
    );
    await expect(
      page.locator(selector).getByRole("button").last(),
    ).toHaveAttribute("aria-pressed", "true");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByLabel("Open navigation", { exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByLabel("Open navigation", { exact: true }),
  ).toBeFocused();
  await page
    .getByRole("group", { name: "Explore workflow" })
    .getByRole("button", { name: "Customer Record" })
    .click();
  await expect(page.locator(".thread-focus")).toContainText("Useful context");
});
test("auth keeps validation local and never establishes a session", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && !r.url().includes("__nextjs"))
      writes.push(r.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const mode of ["login", "register"]) {
    await page.goto(`/${mode}`);
    const submit = page.getByRole("button", {
      name: mode === "login" ? "Log in" : "Create account",
      exact: true,
    });
    await submit.click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    if (mode === "register")
      await page.getByLabel("Your name").fill("Example Seller");
    await page.getByLabel("Email address").fill("seller@example.com");
    await page.getByLabel("Password", { exact: true }).fill("example-password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
    if (mode === "register") {
      await page.getByLabel("Confirm password").fill("wrong");
      await submit.click();
      await expect(page.getByText("Passwords do not match.")).toBeVisible();
      await page.getByLabel("Confirm password").fill("example-password");
    }
    await submit.click();
    await expect(page.getByRole("status")).toContainText(
      "Nothing was sent or saved",
    );
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  expect(writes).toEqual([]);
  expect(await page.context().cookies()).toEqual([]);
});
for (const width of [1440, 1280, 1024, 768, 430, 390])
  test(`combined visual review ${width}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/",
      "/login",
      "/register",
      "/dashboard",
      "/onboarding",
      "/store/not-a-real-shop",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (route === "/onboarding")
        await expect(page.getByText("Loading saved setup…")).not.toBeVisible({
          timeout: 30000,
        });
      if (route.startsWith("/store"))
        await expect(page.getByText("Opening the shop…")).not.toBeVisible({
          timeout: 30000,
        });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} ${width}`,
      ).toBe(true);
      const name =
        route === "/" ? "public" : route.replaceAll("/", "-").slice(1);
      await page.screenshot({
        path: `docs/screenshots/combined/${name}-${width}.png`,
        fullPage: true,
        caret: "initial",
      });
      if (route === "/") {
        await page.locator(".studio-hero").screenshot({
          path: `docs/screenshots/combined/hero-${width}.png`,
          style: ".launch-header,.launch-skip{visibility:hidden!important}",
        });
        await page
          .getByRole("button", { name: "Try an example draft" })
          .click();
        await page.getByRole("button", { name: "Approve draft" }).click();
        for (const id of ["ai-replies", "workflow"]) {
          await page.locator(`#${id}`).screenshot({
            path: `docs/screenshots/combined/${id}-${width}.png`,
            style: ".launch-header,.launch-skip{visibility:hidden!important}",
          });
        }
      }
      if (width === 390 || width === 1440)
        expect(
          (await new AxeBuilder({ page }).analyze()).violations,
          `${route} accessibility`,
        ).toEqual([]);
    }
  });
