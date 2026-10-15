import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { emptyStorefrontContent } from "../types/storefront-content";
import { storefrontThemeIds } from "../config/storefront-themes";

for (const themeId of storefrontThemeIds) {
  test(`${themeId}: seller-written WhatsApp draft and honest Messenger copy flow`, async ({
    page,
  }) => {
    const errors: string[] = [],
      writes: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let configured = true;
    const content = {
      ...emptyStorefrontContent,
      design: { ...emptyStorefrontContent.design, themeId },
      whatsappNumber: "+880 1700 000000",
      messengerUrl: "https://m.me/example.test.page",
      contactMessage:
        "Hi {shop_name}! 🌿\nI’m interested in {product_name} ({product_price}). Option: {variant}\n{product_url}\nCan you help? A&B + 50% #details",
    };
    const product = {
      id: "contact-product",
      slug: "canvas-tote",
      name: "Canvas & cotton tote",
      price: 850,
      stock: 10,
      imageUrl: "/images/olive-tote.webp",
      images: ["/images/olive-tote.webp"],
      description: "Everyday carry.",
      category: "Bags",
      currency: "BDT",
      variants: [
        { id: "olive", title: "Olive", price: 850, stock: 5, sku: null },
        { id: "natural", title: "Natural", price: 950, stock: 5, sku: null },
      ],
    };
    await page.route(
      "**/api/commerce/storefront/contact-fixture**",
      (route) => {
        if (route.request().method() !== "GET")
          writes.push(route.request().url());
        const url = new URL(route.request().url());
        if (url.pathname.endsWith("/reviews"))
          return route.fulfill({
            json: {
              reviews: [],
              count: 0,
              average: null,
              distribution: [5, 4, 3, 2, 1].map((rating) => ({
                rating,
                count: 0,
              })),
              page: 1,
              hasMore: false,
            },
          });
        if (url.pathname.includes("/products/"))
          return route.fulfill({ json: { product } });
        return route.fulfill({
          json: {
            shop: {
              id: "fixture",
              displayName: "Sunday Studio",
              subdomain: "contact-fixture",
              category: "Bags",
              country: "Bangladesh",
              currency: "BDT",
              language: "en",
              status: "launched",
              content: configured ? content : emptyStorefrontContent,
              selectedTemplateId: themeId,
              policyDefaults: {
                deliveryCharge: 80,
                returnDays: 3,
                codAllowed: true,
              },
            },
            template: { id: themeId },
            products: [product],
          },
        });
      },
    );
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as unknown as { copiedMessage: string }).copiedMessage =
              value;
          },
        },
      }),
    );
    await page.goto("/store/contact-fixture/products/canvas-tote");
    const whatsapp = page.getByRole("link", { name: "Contact via WhatsApp" });
    await expect(whatsapp).toBeVisible();
    let href = new URL((await whatsapp.getAttribute("href"))!);
    expect(href.origin + href.pathname).toBe("https://wa.me/8801700000000");
    expect(href.searchParams.get("text")).toContain("Hi Sunday Studio! 🌿");
    expect(href.searchParams.get("text")).toContain("Option: Olive");
    expect(href.searchParams.get("text")).toContain("A&B + 50% #details");
    expect(href.searchParams.get("text")).toContain(
      "http://localhost:3000/store/contact-fixture/products/",
    );
    await page.getByRole("button", { name: /Natural/ }).click();
    href = new URL((await whatsapp.getAttribute("href"))!);
    expect(href.searchParams.get("text")).toContain("Option: Natural");
    expect(href.searchParams.get("text")).toContain("950");
    await expect(page.locator(".buyer-purchase-actions")).toHaveCount(0);
    await page.getByRole("button", { name: "Contact via Messenger" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("status")).toContainText("Message copied");
    await expect(dialog.getByLabel("Message", { exact: true })).toHaveValue(
      href.searchParams.get("text")!,
    );
    expect(
      await page.evaluate(
        () => (window as unknown as { copiedMessage: string }).copiedMessage,
      ),
    ).toBe(href.searchParams.get("text"));
    await expect(
      dialog.getByRole("link", { name: "Open Messenger" }),
    ).toHaveAttribute("href", "https://m.me/example.test.page");
    await expect(
      dialog.getByRole("link", { name: "Open Messenger" }),
    ).toHaveAttribute("target", "_blank");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
    await mkdir("docs/screenshots/product-contact", { recursive: true });
    await page.screenshot({
      path: `docs/screenshots/product-contact/${themeId}-messenger-390.png`,
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Contact via Messenger" }),
    ).toBeFocused();
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Blocked by browser");
          },
        },
      }),
    );
    await page.getByRole("button", { name: "Contact via Messenger" }).click();
    await expect(dialog.getByRole("status")).toContainText(
      "Automatic copying was blocked",
    );
    await expect(dialog.getByRole("status")).not.toContainText(
      "Message copied",
    );
    await expect(dialog.getByLabel("Message", { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Copy message" }),
    ).toBeEnabled();
    await page.keyboard.press("Escape");
    configured = false;
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      product.name,
    );
    await expect(
      page.getByRole("link", { name: "Contact via WhatsApp" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Contact via Messenger" }),
    ).toHaveCount(0);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}
