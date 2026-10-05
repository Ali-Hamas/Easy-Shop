import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Inbox 3-column architecture, zero-fabrication customer card and accessibility", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inbox");

  // Page Heading
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByText("Customer Inquiries & AI Replies", { exact: false }),
  ).toBeVisible();

  // 3-Column Desktop Layout validation
  await expect(page.locator(".inbox-list-col")).toBeVisible();
  await expect(page.locator(".inbox-thread-col")).toBeVisible();
  await expect(page.locator(".inbox-assist-col")).toBeVisible();

  // Left column search and filter elements
  await expect(page.getByPlaceholder("Search inquiries…")).toBeVisible();
  await expect(page.getByRole("button", { name: "Messenger" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Instagram" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Storefront" })).toBeVisible();

  // Right column AI assistance primitives
  await expect(page.getByText("AI Grounded Reply")).toBeVisible();
  await expect(page.getByText("Reply Draft")).toBeVisible();

  // Accessibility audit
  const axe = await new AxeBuilder({ page }).analyze();
  const critical = axe.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(critical).toEqual([]);
});

test("Real live inbox workflow: customer inquiry -> context retrieval -> draft -> edit -> approve -> send", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.EASY_SHOP_LIVE_VERIFY !== "1",
    "Requires isolated Atlas backend",
  );
  test.setTimeout(240000);

  // 1. Onboarding
  const setup = await request.post("/api/commerce/onboarding/start", {
    headers: { origin: "http://localhost:3000" },
    data: {
      ownerName: "Inbox Reviewer",
      shopName: "Inbox Studio",
      subdomain: `inbox-ui-${Date.now().toString(36)}`,
      category: "Fashion",
      country: "Bangladesh",
      currency: "BDT",
      language: "en",
    },
  });
  expect(setup.status()).toBe(201);
  const { shop } = await setup.json();

  // 2. Seed product
  const prodRes = await request.post(
    `/api/commerce/inventory/${shop.id}/products`,
    {
      headers: { origin: "http://localhost:3000" },
      data: {
        requestId: crypto.randomUUID(),
        product: {
          name: "Linen Kurta",
          sku: "KURTA-01",
          category: "Fashion",
          description: "Pure breathable linen kurta",
          price: 2200,
          comparePrice: null,
          cost: 1400,
          images: [],
          status: "active",
          aiFacts: {
            sellingPoints: "100% linen",
            audience: "Summer wear",
            care: "Hand wash",
            policyExceptions: "",
          },
          seo: { title: "Linen Kurta", description: "" },
          delivery: { weightGrams: 300, note: "" },
          variants: [
            {
              title: "Medium",
              sku: "KURTA-M",
              size: "M",
              color: "White",
              material: "Linen",
              image: "",
              priceOverride: null,
              openingStock: 12,
              lowStockThreshold: 2,
            },
          ],
        },
      },
    },
  );
  expect(prodRes.status()).toBe(201);

  // 3. Seed customer
  const custRes = await request.post(`/api/commerce/customers/${shop.id}`, {
    headers: { origin: "http://localhost:3000" },
    data: {
      requestId: crypto.randomUUID(),
      customer: {
        name: "Rashid Karim",
        phone: "+880 1812-345678",
        email: "rashid@example.test",
        addresses: [],
        language: "bn",
        tags: ["repeat-buyer"],
        source: "facebook",
        status: "active",
      },
    },
  });
  expect(custRes.status()).toBe(201);
  const customer = await custRes.json();

  // 4. Create conversation & append customer message
  const convRes = await request.post(
    `/api/commerce/inbox/${shop.id}/conversations`,
    {
      headers: { origin: "http://localhost:3000" },
      data: {
        requestId: crypto.randomUUID(),
        customerId: customer.id,
        channel: "messenger",
      },
    },
  );
  expect(convRes.status()).toBe(201);
  const conv = await convRes.json();

  await request.post(
    `/api/commerce/inbox/${shop.id}/conversations/${conv.id}/messages`,
    {
      headers: { origin: "http://localhost:3000" },
      data: {
        requestId: crypto.randomUUID(),
        sender: "customer",
        text: "আপনার কাছে লিনেন কুর্তা M সাইজ স্টকে আছে?",
      },
    },
  );

  // Open inbox in browser
  await page.addInitScript((id) => {
    sessionStorage.setItem("easy-shop:onboarding-id", id);
    sessionStorage.setItem("easy-shop:onboarding-id:name", "Inbox Studio");
  }, shop.id);

  await page.goto("/inbox");

  // Select conversation
  await expect(page.locator(".inbox-item").first()).toBeVisible();
  await page.locator(".inbox-item").first().click();

  // Check customer inquiry in thread
  await expect(
    page
      .locator(".inbox-bubble")
      .filter({ hasText: "আপনার কাছে লিনেন কুর্তা M সাইজ স্টকে আছে?" }),
  ).toBeVisible();

  // Verify Zero-fabrication customer card
  await expect(page.getByText("Verified Customer Facts")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rashid Karim" })).toBeVisible();
  await expect(page.getByText("+8801812345678")).toBeVisible();

  // Trigger AI Draft Generation
  await page.getByRole("button", { name: "Generate AI draft" }).first().click();

  // Verify draft appears with Grounding rationale
  await expect(page.getByText("Reply rationale")).toBeVisible();
  await expect(page.getByText("Approve draft")).toBeVisible();

  // Approve Draft (Separate step!)
  await page.getByRole("button", { name: "Approve draft" }).click();
  await expect(page.getByText("Approved by local-development")).toBeVisible();

  // Explicit Send
  await page.getByRole("button", { name: "Send approved reply" }).click();

  // Verify outgoing message appended to thread
  await expect(
    page.locator('.inbox-message[data-sender="staff"]').first(),
  ).toBeVisible();
  await expect(page.getByText("AI Approved").first()).toBeVisible();
});
