import { commerceUi } from "../config/commerce-ui";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
test("seller writes store content, saves, previews and publishes a real storefront", async ({
  page,
  browser,
}) => {
  test.setTimeout(300000);
  const suffix = Date.now().toString(36);
  const origin = { Origin: "http://localhost:3000" };
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const register = await page.request.post("/api/commerce/auth/register", {
    headers: origin,
    data: {
      name: "Studio Owner",
      email: `editor-${suffix}@example.test`,
      password: `Test-editor-${suffix}-Only`,
    },
  });
  expect(register.ok()).toBe(true);
  const start = await page.request.post("/api/commerce/onboarding/start", {
    headers: origin,
    data: {
      ownerName: "Studio Owner",
      shopName: "Sunday Studio",
      subdomain: `studio-${suffix}`,
      category: "Everyday essentials",
      country: "Bangladesh",
      currency: "BDT",
      language: "en",
    },
  });
  expect(start.ok()).toBe(true);
  const state = await start.json();
  const id = state.shop.id;
  console.log(`Isolated test storefront: /store/studio-${suffix}`);
  const mutate = async (path: string, data?: object, method = "POST") => {
    const r = await page.request.fetch(
      `/api/commerce/onboarding/${id}/${path}`,
      { method, headers: origin, data },
    );
    expect(r.ok()).toBe(true);
    return r.json();
  };
  await mutate("products", {
    name: "Olive everyday tote",
    price: 850,
    stock: 24,
    imageUrl: "http://localhost:3000/images/olive-tote.webp",
  });
  await mutate("products", {
    name: "Canvas organiser",
    price: 450,
    stock: 12,
    imageUrl: "http://localhost:3000/images/canvas-pouch.svg",
  });
  await page.goto("/website");
  await expect(
    page.getByRole("heading", { name: "Store Design" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Homepage", exact: true }).click();
  await expect(page.getByLabel("Storefront headline")).toBeVisible();
  await page
    .getByLabel("Announcement (optional)")
    .fill("A small collection. Selected with intention.");
  await page
    .getByLabel("Storefront headline")
    .fill("For the things you carry.");
  await page
    .getByLabel("Store description")
    .fill(
      "Thoughtful everyday essentials from Sunday Studio. Discover practical pieces for work, weekends and the moments in between.",
    );
  await page
    .getByLabel("Cover image URL")
    .fill("http://localhost:3000/images/olive-tote.webp");
  await page
    .getByRole("button", { name: "Products & collections", exact: true })
    .click();
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("button", { name: "Add collection", exact: true })
    .click();
  await page.getByLabel("Collection 1 title").fill("The everyday edit");
  await page
    .getByLabel("Collection 1 description")
    .fill("Useful pieces, selected to go together.");
  await page.locator(".website-repeat").getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Our story", exact: true }).click();
  await page
    .getByLabel("Story heading")
    .fill("A little less. A little better.");
  await page
    .getByLabel("About your store")
    .fill(
      "Sunday Studio began with a simple idea: the things we reach for every day deserve a little more thought. We select practical pieces that feel at home in your routine.\n\nHave a question about a product? We are here to help you choose.",
    );
  await page
    .getByRole("button", { name: "Contact & policies", exact: true })
    .click();
  await page.getByLabel("Public contact email").fill("hello@sunday.example");
  await page.getByLabel("Public phone number").fill("+880 1700 000000");
  await page
    .getByLabel("Delivery information", { exact: true })
    .fill(
      "Delivery charge is BDT 80. Contact us to confirm delivery availability for your area.",
    );
  await page.getByLabel("WhatsApp business number").fill("+880 1700 000000");
  await page
    .getByLabel("Messenger link")
    .fill("https://m.me/example.test.page");
  await page
    .getByLabel("Buyer message")
    .fill(Array(501).fill("word").join(" "));
  await page
    .getByRole("button", { name: "Save storefront", exact: true })
    .click();
  await expect(page.getByLabel("Buyer message")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator(".website-error")).toContainText(
    "Check your product contact settings",
  );
  await page
    .getByLabel("Buyer message")
    .fill(
      "Hi {shop_name}! I’m interested in {product_name} ({product_price}).\n{product_url}",
    );
  await page
    .getByLabel("Payment information", { exact: true })
    .fill("Cash on delivery is available. Confirm your order with the shop.");
  await page
    .getByLabel("Returns information", { exact: true })
    .fill(
      "Contact us within 3 days of receiving your order to discuss a return.",
    );
  await page.getByRole("button", { name: "FAQs", exact: true }).click();
  await page.getByRole("button", { name: "Add question" }).click();
  await page
    .getByLabel("Question 1", { exact: true })
    .fill("Can I ask about a product before ordering?");
  await page
    .getByLabel("Answer 1", { exact: true })
    .fill(
      "Of course. Use Message the shop or email us and we will help you choose.",
    );
  await page.route(
    "**/api/commerce/onboarding/*/storefront-content",
    async (route) => {
      if (route.request().method() === "PATCH")
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Temporary test outage. Your changes were not saved.",
          }),
        });
      await route.continue();
    },
  );
  await page
    .getByRole("button", { name: "Save storefront", exact: true })
    .click();
  await expect(page.locator(".website-error")).toContainText(
    "Temporary test outage",
  );
  await expect(page.getByLabel("Question 1", { exact: true })).toHaveValue(
    "Can I ask about a product before ordering?",
  );
  await page.unroute("**/api/commerce/onboarding/*/storefront-content");
  await page
    .getByRole("button", { name: "Save storefront", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Storefront saved");
  await page.reload();
  await page.getByRole("button", { name: "Homepage", exact: true }).click();
  await expect(page.getByLabel("Storefront headline")).toHaveValue(
    "For the things you carry.",
  );
  await mkdir("docs/screenshots/storefront-editor", { recursive: true });
  for (const width of [1440, 1280, 1024, 768, 430, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if ([1440, 390].includes(width))
      await page.screenshot({
        path: `docs/screenshots/storefront-editor/editor-${width}.png`,
        fullPage: true,
      });
  }
  const editorAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(editorAxe.violations).toEqual([]);
  await mutate("channels/meta/skip");
  await mutate("ai-mode", { aiMode: "suggest" }, "PATCH");
  await mutate("template", { templateId: state.templates[0].id });
  await mutate("launch");
  await page.reload();
  await page.getByRole("button", { name: "Homepage", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .nth(1)
    .setInputFiles("public/images/olive-tote.webp");
  await page
    .getByRole("button", { name: "Publish changes", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Your changes are live");
  const savedContent = await (
    await page.request.get(`/api/commerce/onboarding/${id}/storefront-content`)
  ).json();
  expect(savedContent.content.coverImage).toMatch(/^data:image\/webp;base64,/);

  const buyer = await browser.newContext();
  const store = await buyer.newPage();
  await store.goto(`http://localhost:3000/store/studio-${suffix}`);
  await expect(store.getByRole("heading", { level: 1 })).toHaveText(
    "For the things you carry.",
  );
  await expect(
    store.getByRole("heading", { name: "The everyday edit" }),
  ).toBeVisible();
  await expect(
    store.getByRole("heading", { name: "A little less. A little better." }),
  ).toBeVisible();
  await store
    .getByText("Can I ask about a product before ordering?", { exact: true })
    .click();
  await expect(
    store.getByText(
      "Of course. Use Message the shop or email us and we will help you choose.",
      { exact: true },
    ),
  ).toBeVisible();
  for (const width of [1440, 1280, 1024, 768, 430, 390, 375, 320]) {
    await store.setViewportSize({ width, height: 1000 });
    expect(
      await store.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if ([1440, 390].includes(width))
      await store.screenshot({
        path: `docs/screenshots/storefront-editor/store-${width}.png`,
        fullPage: true,
      });
  }
  const buyerAxe = await new AxeBuilder({ page: store })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(buyerAxe.violations).toEqual([]);
  await store.setViewportSize({ width: 390, height: 844 });
  await store
    .getByRole("link", { name: "View details", exact: true })
    .first()
    .click();
  await expect(store.getByRole("heading", { level: 1 })).toBeVisible();
  if (commerceUi.orders) {
    await store.getByRole("button", { name: /Add to Bag/ }).click();
    await store.reload();
    await store
      .getByRole("button", { name: "Shopping bag with 1 items" })
      .click();
    await store.getByRole("button", { name: "Continue to checkout" }).click();
    await store.getByLabel("Full name", { exact: true }).fill("Guest Buyer");
    await store
      .getByLabel("Phone number", { exact: true })
      .fill("+8801700000111");
    await store.getByLabel("City / district").fill("Dhaka");
    await store
      .getByLabel("Delivery address")
      .fill("Test delivery address, street 12");
    await store
      .getByRole("button", { name: "Review order", exact: true })
      .click();
    const checkoutAxe = await new AxeBuilder({ page: store })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(checkoutAxe.violations).toEqual([]);
    await store.getByRole("button", { name: /Place order/ }).click();
    await expect(
      store.getByRole("heading", { name: "Your order is with the shop" }),
    ).toBeVisible();
    const receipt = await store.evaluate(
      (subdomain) =>
        JSON.parse(sessionStorage.getItem(`receipt:${subdomain}`)!),
      `studio-${suffix}`,
    );
    expect(receipt.orderId).toBeTruthy();
    const sellerOrders = await page.request.get(`/api/commerce/orders/${id}`);
    expect(sellerOrders.ok()).toBe(true);
    const order = (await sellerOrders.json()).orders.find(
      (o: { id: string }) => o.id === receipt.orderId,
    );
    expect(order.status).toBe("new");
    await store
      .getByRole("button", { name: "Track order", exact: true })
      .first()
      .click();
    await store
      .locator("#order-tracking")
      .getByLabel("Order reference", { exact: true })
      .fill(receipt.orderId);
    await store
      .locator("#order-tracking")
      .getByLabel("Checkout phone number")
      .fill(receipt.phone);
    await store
      .locator("#order-tracking")
      .getByRole("button", { name: "Track order" })
      .click();
    await expect(store.locator(".guest-tracking-result")).toContainText(
      "Awaiting seller confirmation",
    );
    const statuses = ["confirmed", "packed", "shipped", "delivered"];
    for (let version = 0; version < statuses.length; version++) {
      const r = await page.request.patch(
        `/api/commerce/orders/${id}/${receipt.orderId}`,
        { headers: origin, data: { version, status: statuses[version] } },
      );
      expect(r.ok()).toBe(true);
    }
    await store
      .getByRole("button", { name: "Write a review", exact: true })
      .click();
    await store.getByLabel("5 stars", { exact: true }).check();
    await store.getByLabel("Public display name").fill("Guest Buyer");
    await store
      .getByLabel("Your review", { exact: true })
      .fill("The product arrived as described and the seller was helpful.");
    await store
      .getByRole("button", { name: "Publish review", exact: true })
      .click();
    await expect(store.locator(".review-success")).toBeVisible();
    await expect(
      store.getByText("Verified purchase", { exact: true }),
    ).toBeVisible();
    await store.goto(`http://localhost:3000/store/studio-${suffix}`);
    await store
      .getByRole("button", { name: "Write a review", exact: true })
      .click();
    await store.getByLabel("4 stars", { exact: true }).check();
    await store.getByLabel("Public display name").fill("Guest Buyer");
    await store
      .getByLabel("Your review", { exact: true })
      .fill("A good experience with this seller, from questions to delivery.");
    await store
      .getByRole("button", { name: "Publish review", exact: true })
      .click();
    await expect(store.locator(".review-success")).toBeVisible();
    await page.goto("/reviews");
    await expect(
      page.getByRole("heading", { name: "Reviews", exact: true }),
    ).toBeVisible();
    const card = page
      .locator(".review-item")
      .filter({ hasText: "A good experience with this seller" });
    await card.getByRole("button", { name: "Write a reply" }).click();
    await card
      .getByLabel("Public reply to Guest Buyer")
      .fill("Thank you for choosing our store.");
    await card.getByRole("button", { name: "Publish reply" }).click();
    await expect(page.locator(".review-published")).toContainText(
      "now visible",
    );
    await store.reload();
    await expect(
      store.getByText("Thank you for choosing our store.", { exact: true }),
    ).toBeVisible();
    await store.setViewportSize({ width: 1440, height: 1000 });
    await store.screenshot({
      path: "docs/screenshots/storefront-editor/store-reviews-1440.png",
      fullPage: true,
    });
    await store.setViewportSize({ width: 390, height: 844 });
    await store.screenshot({
      path: "docs/screenshots/storefront-editor/store-reviews-390.png",
      fullPage: true,
    });
    await page.goto("/orders");
    await expect(
      page.locator(".seller-order").filter({ hasText: receipt.orderId }),
    ).toContainText("Delivered");
    const finalAxe = await new AxeBuilder({ page: store })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(finalAxe.violations).toEqual([]);
  } else {
    await expect(
      store.getByRole("button", { name: /bag|checkout|Place order/i }),
    ).toHaveCount(0);
    await expect(store.locator("#order-tracking")).toHaveCount(0);
  }
  // Choosing a theme stages the design without changing the public store.
  await page.goto("/website");
  await expect(page.locator(".store-theme-choice")).toHaveCount(5);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "docs/screenshots/storefront-editor/theme-gallery.png",
    fullPage: true,
  });
  const galleryAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(galleryAxe.violations).toEqual([]);
  const circuit = page.locator(".store-theme-choice").filter({
    has: page.getByRole("heading", { name: "Circuit", exact: true }),
  });
  await circuit.getByRole("button", { name: "Use this theme" }).click();
  await expect(
    page.getByText("Unpublished draft", { exact: true }),
  ).toBeVisible();
  await store.reload();
  await expect(store.locator(".buyer-site")).toHaveAttribute(
    "data-store-theme",
    "fashion-lifestyle",
  );
  await page.reload();
  await expect(
    page.locator('.store-theme-choice[data-selected="true"]'),
  ).toContainText("Circuit");
  await page
    .getByRole("button", { name: "Preview Circuit", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mobile preview", exact: true })
    .click();
  const preview = page.frameLocator('iframe[title="Live storefront preview"]');
  await expect(preview.locator(".buyer-site")).toHaveAttribute(
    "data-store-theme",
    "electronics-gadgets",
  );
  await expect(
    preview.getByText("Draft Preview", { exact: true }),
  ).toBeVisible();
  await preview
    .getByRole("link", { name: "View details", exact: true })
    .first()
    .click();
  await expect(
    preview.getByText("Draft Preview", { exact: true }),
  ).toBeVisible();
  await expect(preview.locator(".buyer-site")).toHaveAttribute(
    "data-store-theme",
    "electronics-gadgets",
  );
  if (commerceUi.orders) {
    await preview.getByRole("button", { name: /Add to Bag/ }).click();
    await expect(
      preview.getByRole("button", { name: "Continue to checkout" }),
    ).toBeDisabled();
  } else {
    await expect(
      preview.getByRole("button", { name: /bag|checkout/i }),
    ).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Sections", exact: true }).click();
  await page.getByRole("checkbox", { name: "Reviews", exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Move about up", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publish changes", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Your changes are live");
  await store.reload();
  await expect(store.locator(".buyer-site")).toHaveAttribute(
    "data-store-theme",
    "electronics-gadgets",
  );
  await expect(store.locator("#store-reviews")).toHaveCount(0);
  await expect(
    store.getByRole("link", { name: "Read customer reviews", exact: true }),
  ).toHaveCount(0);
  const published = await (
    await store.request.get(`/api/commerce/storefront/studio-${suffix}`)
  ).json();
  expect(published.products.map((p: { id: string }) => p.id).sort()).toEqual(
    savedContent.products.map((p: { id: string }) => p.id).sort(),
  );
  await buyer.close();
  expect(errors).toEqual([]);
});
