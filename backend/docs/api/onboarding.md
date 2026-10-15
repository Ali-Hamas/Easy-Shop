# Onboarding API

Base path: `/api/v1/onboarding`

Purpose:
- Powers the Shopify-style first setup flow: account, shop basics, products, channels, AI mode, launch.
- Allows website-only launch when Meta is skipped.
- Keeps draft state, audit events, and launch checklist.
- Provides test-only template references for storefront selection.

Auth: Requires an HttpOnly merchant session and server-side shop ownership validation. Mutations require the configured Origin. See auth.md. Account IDs are resolved by the server; production is supported.
- This branch has no session validation. Bearer tokens are not interpreted.
- Public development start creates an owner user without password. Authentication must be implemented before production administration.
- Production rule: dashboard onboarding must require authenticated owner session.

## `POST /subdomain/check`

Request:

```json
{
  "subdomain": "nafis fashion"
}
```

Response:

```json
{
  "subdomain": "nafis-fashion",
  "available": true,
  "suggestions": []
}
```

Side effects:
- None.

Audit/timeline:
- None.

Cache:
- Do not cache. Availability is live state.

Errors:
- `400 SUBDOMAIN_TOO_SHORT`

## `GET /templates`

Purpose:
- Lists online template references added to the system.
- Includes storefront/admin/fullstack candidates, source URL, license note, stack, best-fit categories, and reuse status.

Response:

```json
{
  "templates": [
    {
      "id": "test-fashion-basic",
      "name": "Test Fashion Basic",
      "type": "storefront",
      "sourceUrl": "internal:test-template",
      "license": "Internal test-only, not for production",
      "stack": ["Backend catalog metadata only"],
      "bestFor": ["fashion", "clothing", "beauty"],
      "notes": "Basic test template for onboarding flow only. No external source code. Replace before production.",
      "status": "test_only"
    }
  ]
}
```

Side effects:
- None.

Audit/timeline:
- None.

Cache:
- Client can cache. Refetch when template catalog changes.

Errors:
- None expected.

## `POST /start`

Request:

```json
{
  "ownerName": "Nafis",
  "phone": "+8801700000000",
  "language": "bn-en",
  "shopName": "Nafis Fashion",
  "category": "fashion",
  "country": "Bangladesh",
  "currency": "BDT"
}
```

Response:
- `201`
- Full onboarding state: owner, shop, products, channels, audit, launchChecklist.

Side effects:
- Creates or reuses owner user.
- Creates draft shop in MongoDB.
- Creates `shop_staff` owner membership.
- Reserves subdomain.
- Sets default COD policy and suggest-only AI mode.

Audit/timeline:
- Writes `onboarding.started`.

Cache:
- Invalidate onboarding state and subdomain checks.

Errors:
- `400 VALIDATION_ERROR`
- `409 SUBDOMAIN_TAKEN`

## `GET /:shopId`

Purpose:
- Reads current onboarding state.

Response:
- Full onboarding state.

Side effects:
- None.

Audit/timeline:
- None.

Cache:
- Client can cache briefly, refetch after mutations.

Errors:
- `404 SHOP_NOT_FOUND`

## `PATCH /:shopId/shop`

Purpose:
- Updates shop basics and policy defaults before launch.

Request:

```json
{
  "displayName": "Nafis Fashion",
  "address": "Dhaka",
  "policyDefaults": {
    "deliveryCharge": 80,
    "returnDays": 3,
    "codAllowed": true
  }
}
```

Side effects:
- Updates draft shop.
- Can change subdomain if available.

Audit/timeline:
- Writes `shop.updated`.

Cache:
- Invalidate shop/onboarding state and subdomain checks if subdomain changed.

Errors:
- `404 SHOP_NOT_FOUND`
- `409 SHOP_LAUNCHED`
- `409 SUBDOMAIN_TAKEN`

## `POST /:shopId/products`

Purpose:
- Adds first product during onboarding so AI and storefront have real data.

Request:

```json
{
  "name": "Black Panjabi",
  "price": 1200,
  "stock": 10
}
```

Side effects:
- Creates active product and default variant in MongoDB.
- Writes opening stock to `inventory_ledger`.
- Moves onboarding step to `channels`.

Audit/timeline:
- Writes `product.created`.

Cache:
- Invalidate onboarding state and product reads.

Errors:
- `400 VALIDATION_ERROR`
- `404 SHOP_NOT_FOUND`
- `409 SHOP_LAUNCHED`

## `POST /:shopId/channels/meta/skip`

Purpose:
- Lets seller continue website-only without Meta connection.

Side effects:
- Creates skipped Meta channel record if missing.
- Moves onboarding step to `ai_mode`.

Audit/timeline:
- Writes `channel.meta_skipped`.

Cache:
- Invalidate onboarding state.

Errors:
- `404 SHOP_NOT_FOUND`

## `PATCH /:shopId/ai-mode`

Purpose:
- Sets initial AI mode: `off`, `suggest`, or `auto_low_risk`.

Request:

```json
{
  "aiMode": "suggest"
}
```

Side effects:
- Updates shop AI mode.
- Moves onboarding step to `launch`.

Audit/timeline:
- Writes `ai_mode.updated`.

Cache:
- Invalidate onboarding state.

Errors:
- `400 VALIDATION_ERROR`
- `404 SHOP_NOT_FOUND`

## `POST /:shopId/template`

Purpose:
- Selects one prebuilt storefront theme for the shop during onboarding.
- This stores a theme ID; it does not copy products or create a separate catalog.

Request:

```json
{
  "templateId": "fashion-lifestyle"
}
```

Side effects:
- Sets `shop.selectedTemplateId`.
- Makes launch checklist `hasTemplate=true`.

Audit/timeline:
- Writes `template.selected`.

Cache:
- Invalidate onboarding state.

Errors:
- `400 VALIDATION_ERROR`
- `404 SHOP_NOT_FOUND`
- `404 TEMPLATE_NOT_FOUND`
- `409 SHOP_LAUNCHED`

## `POST /:shopId/launch`

Purpose:
- Publishes the shop from onboarding.

Rules:
- Requires display name and subdomain.
- Allows launch with first product.
- Allows launch with a selected theme even when the catalog is empty; the storefront displays an honest empty catalog state.

Side effects:
- Changes shop status to `launched`.
- Sets `launchedAt`.

Audit/timeline:
- Writes `shop.launched`.

Cache:
- Invalidate onboarding state and public storefront reads.

Errors:
- `404 SHOP_NOT_FOUND`
- `409 LAUNCH_BLOCKED`


## Persistence failure
Database-backed endpoints return 503 DATABASE_UNAVAILABLE with a sanitized message. Owner email/phone uniqueness conflicts return 409 OWNER_CONFLICT. All mutations preserve audit/stock writes transactionally.

## Store Design editor

Purpose: Save controlled storefront theme/branding/content drafts and publish the chosen presentation without modifying catalog, order or review data.

Auth: Owner session and shop ownership. Mutations require the configured origin. Other sellers receive 404.

Request: `GET /:shopId/storefront-content` has no body. `PATCH /:shopId/storefront-content` accepts strict `{ version, content, publish? }`, with a nonnegative integer version. `publish` defaults to `true` for compatibility; the editor explicitly sends `false` for Save draft and `true` for Publish changes.

Response: GET returns `{ content, version, hasUnpublishedChanges, shop: { id, name, subdomain, status, selectedTemplateId }, products: [{ id, name, status, imageUrl }] }`. The content is the saved draft when one exists, otherwise published content. PATCH returns `{ content, version, hasUnpublishedChanges }`.

Content schema: `src/modules/storefront/content.schema.ts` defines the strict source of truth.

- `storeName` (up to 120 characters) overrides the customer-facing name only when nonempty.
- `design.themeId`: empty to retain the current selection, or one of `fashion-lifestyle`, `beauty-cosmetics`, `electronics-gadgets`, `food-restaurant`, `modern-general`.
- `design.accent`: `theme`, `neutral`, `violet`, `forest`, `rose`, or `ocean`.
- `design.fontSet`: `theme`, `geist`, `editorial`, or `rounded`.
- `design.sections`: unique ordered list of at most ten IDs: `hero`, `categories`, `featured`, `catalog`, `reviews`, `about`, `policies`, `contact`, `tracking`, `footer`. The renderer keeps footer presentation at the end; hiding a section does not delete its data.
- Brand/homepage content: announcement (140), headline (100), description (500), logo/cover images, story title (100), story (3,000), optional story image.
- Contact and policy content: validated email, phone, address (300), HTTP(S) social links, and delivery/payment/returns text (1,000 each). Policy text does not change actual delivery charges or payment settings.
- Up to eight featured product IDs, six collections (title 1–70, description 200, 1–24 product IDs), and eight FAQs (question 1–160, answer 1–1,000).
- Images accept valid HTTP(S) URLs without URL credentials or PNG/JPEG/WebP data images. The browser caps uploads at 1 MB; the API image string limit is 1,500,000 characters. The frontend bridge limits the editor body to 5 MB.

Side effects: All selected products must belong to the shop and not be archived. A transaction writes `storefrontConfig.draftContent`, increments contentVersion and shop revision, and updates the timestamp. `publish: false` leaves public content/theme unchanged and sets `hasUnpublishedChanges`. `publish: true` also updates published content and, when supplied, `selectedTemplateId`, then clears the unpublished flag. It preserves unrelated configuration and never duplicates/deletes products. Publishing design does not launch an unlaunched shop; the existing onboarding launch endpoint still controls shop publication.

Audit/timeline: Writes `storefront.content_updated` with the new version and publish flag; does not include raw private content in audit metadata.

Cache: `no-store`. An owner preview uses saved draft content; anonymous storefront reads use published content only.

Errors: 400 `VALIDATION_ERROR` with field issues; 401 authentication; 403 origin; 404 `SHOP_NOT_FOUND`; 409 `CONTENT_CONFLICT` for a stale version or `PRODUCT_SELECTION_INVALID` for unavailable product references; 503 database unavailable. Failed saves preserve the editor's local draft.
