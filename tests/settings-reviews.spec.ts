import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

// Run only against the disposable backend from scripts/verify-editor-backend.mjs.
// Review examples are browser-only; no fabricated review is written to MongoDB.
test("settings persist and link to messages; review workspace filters and replies", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const suffix = Date.now().toString(36),
    headers = { Origin: "http://localhost:3000" };
  const registered = await page.request.post("/api/commerce/auth/register", {
    headers,
    data: {
      name: "Studio Owner",
      email: `settings-${suffix}@example.test`,
      password: `Test-settings-${suffix}-Only`,
    },
  });
  expect(registered.ok()).toBe(true);
  const started = await page.request.post("/api/commerce/onboarding/start", {
    headers,
    data: {
      ownerName: "Studio Owner",
      shopName: "Sunday Studio",
      subdomain: `settings-${suffix}`,
      category: "Everyday essentials",
      country: "Bangladesh",
      currency: "BDT",
      language: "en",
    },
  });
  expect(started.ok()).toBe(true);
  const { shop } = await started.json();
  await page.goto("/settings");
  await expect(page.getByLabel("Shop name", { exact: true })).toHaveValue(
    "Sunday Studio",
  );
  await page
    .getByLabel("Shop name", { exact: true })
    .fill("Sunday Studio Updated");
  await page.getByLabel("Business address").fill("Studio 12, Dhaka");
  let failSave = true;
  await page.route(
    `**/api/commerce/onboarding/${shop.id}/shop`,
    async (route) => {
      if (failSave)
        return route.fulfill({
          status: 503,
          json: { message: "Temporary test outage. Try again." },
        });
      return route.continue();
    },
  );
  await page.getByRole("button", { name: "Save shop details" }).click();
  await expect(page.locator(".settings-error")).toContainText(
    "Temporary test outage",
  );
  await expect(page.getByLabel("Business address")).toHaveValue(
    "Studio 12, Dhaka",
  );
  failSave = false;
  await page.getByRole("button", { name: "Save shop details" }).click();
  await expect(page.getByRole("status")).toContainText("Shop details saved");
  await page.reload();
  await expect(page.getByLabel("Shop name", { exact: true })).toHaveValue(
    "Sunday Studio Updated",
  );
  await expect(page.getByLabel("Business address")).toHaveValue(
    "Studio 12, Dhaka",
  );
  await mkdir("docs/screenshots/settings-reviews", { recursive: true });
  async function settleViewport(width: number) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => scrollTo(0, 0));
    await expect
      .poll(() =>
        page.evaluate(() => {
          const sidebar = document
            .querySelector(".sidebar")!
            .getBoundingClientRect();
          const main = document.querySelector("main")!.getBoundingClientRect();
          return (
            document.documentElement.scrollWidth <= innerWidth &&
            main.left >= sidebar.right - 1
          );
        }),
      )
      .toBe(true);
  }
  for (const width of [1440, 390, 320]) {
    await settleViewport(width);
    if (width !== 320)
      await page.screenshot({
        path: `docs/screenshots/settings-reviews/settings-${width}.png`,
        fullPage: true,
      });
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByLabel("Business address").fill("");
  await page.getByRole("button", { name: "Save shop details" }).click();
  await expect(page.getByRole("status")).toContainText("Shop details saved");
  await page.reload();
  await expect(page.getByLabel("Business address")).toHaveValue("");
  const invalidAddress = await page.request.patch(
    `/api/commerce/onboarding/${shop.id}/shop`,
    { headers, data: { address: "x".repeat(201) } },
  );
  expect(invalidAddress.status()).toBe(400);
  await page
    .getByRole("link", { name: /WhatsApp & Messenger messages/ })
    .click();
  await expect(page.getByLabel("Buyer message")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Contact & policies", exact: true }),
  ).toBeVisible();
  await page.goto("/reviews");
  await expect(
    page.getByRole("heading", {
      name: "Your next chapter starts with a review",
    }),
  ).toBeVisible();
  await expect(page.locator(".review-overview")).toContainText("—");
  await settleViewport(1440);
  await page.screenshot({
    path: "docs/screenshots/settings-reviews/reviews-empty-1440.png",
    fullPage: true,
  });
  const reviews = [
    {
      id: "example-1",
      name: "Amina",
      rating: 5,
      productName: "Everyday tote",
      text: "Beautiful material and thoughtful packaging. A lovely everyday bag.",
      createdAt: "2026-10-14T12:00:00Z",
      reply: null as { text: string; at: string } | null,
    },
    {
      id: "example-2",
      name: "Rafi",
      rating: 2,
      productName: null,
      text: "The shop answered quickly, but delivery updates could be clearer.",
      createdAt: "2026-10-13T12:00:00Z",
      reply: {
        text: "Thank you for the feedback. We’re improving our delivery updates.",
        at: "2026-10-14T12:00:00Z",
      },
    },
    {
      id: "example-3",
      name: "Nadia",
      rating: 3,
      productName: "Canvas organiser",
      text: "Useful size. I would love more colour options.",
      createdAt: "2026-10-12T12:00:00Z",
      reply: null,
    },
  ];
  let failReply = true,
    failRead = false;
  await page.route(`**/api/commerce/reviews/${shop.id}**`, async (route) => {
    if (route.request().method() === "PATCH") {
      if (failReply)
        return route.fulfill({
          status: 503,
          json: { message: "Reply could not be saved. Please try again." },
        });
      const text = route.request().postDataJSON().text;
      const row = reviews.find((r) => route.request().url().includes(r.id))!;
      row.reply = { text, at: new Date().toISOString() };
      return route.fulfill({ json: { reply: row.reply } });
    }
    if (failRead)
      return route.fulfill({
        status: 503,
        json: { message: "Review service temporarily unavailable." },
      });
    return route.fulfill({ json: { reviews } });
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".review-item")).toHaveCount(3);
  await expect(page.locator(".review-overview")).toContainText("3.3");
  await page
    .getByRole("button", { name: "Store reviews", exact: true })
    .click();
  await expect(page.locator(".review-item")).toHaveCount(1);
  await expect(page.locator(".review-item")).toContainText("Rafi");
  await page.getByRole("button", { name: "All reviews", exact: true }).click();
  await page.getByLabel("Rating", { exact: true }).selectOption("3");
  await expect(page.locator(".review-item")).toContainText("Nadia");
  await page.getByLabel("Search reviews").fill("unmatched");
  await expect(
    page.getByRole("heading", { name: "No reviews match these filters" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByLabel("Sort by").selectOption("lowest");
  await expect(page.locator(".review-item").first()).toContainText("Rafi");
  await page.getByRole("button", { name: /Needs a reply/ }).click();
  await expect(page.locator(".review-item")).toHaveCount(2);
  const amina = page
    .locator(".review-item")
    .filter({ has: page.getByRole("heading", { name: "Amina", exact: true }) });
  await amina.getByRole("button", { name: "Write a reply" }).click();
  await amina
    .getByLabel("Public reply to Amina")
    .fill("Thank you, Amina. We’re glad you love it!");
  await amina.getByRole("button", { name: "Publish reply" }).click();
  await expect(amina.getByRole("alert")).toContainText(
    "Reply could not be saved",
  );
  await expect(amina.getByLabel("Public reply to Amina")).toHaveValue(
    "Thank you, Amina. We’re glad you love it!",
  );
  failReply = false;
  await amina.getByRole("button", { name: "Publish reply" }).click();
  await expect(page.locator(".review-item")).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText(
    "Your reply is now visible",
  );
  await page.getByRole("button", { name: "All reviews", exact: true }).click();
  await expect(amina).toContainText("Thank you, Amina");
  await amina.getByRole("button", { name: "Edit reply" }).click();
  await expect(amina.getByLabel("Public reply to Amina")).toHaveValue(
    "Thank you, Amina. We’re glad you love it!",
  );
  await amina.getByRole("button", { name: "Cancel", exact: true }).click();
  for (const width of [1440, 390, 320]) {
    await settleViewport(width);
    if (width !== 320)
      await page.screenshot({
        path: `docs/screenshots/settings-reviews/reviews-${width}.png`,
        fullPage: true,
      });
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  failRead = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.locator(".review-main-panel").getByRole("alert"),
  ).toContainText("Showing the last loaded reviews");
  await expect(page.locator(".review-item")).toHaveCount(3);
  expect(errors).toEqual([]);
});
