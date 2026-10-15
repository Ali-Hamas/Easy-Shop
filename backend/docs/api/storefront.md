# Storefront API

Base path: `/api/v1/storefront`

Purpose:
- Public shop/catalog reads, guest messaging and receipt-verified reviews used by the storefront renderer.
- Looks up a launched MongoDB shop by subdomain.
- Returns shop profile, selected template metadata, active products, and stock from inventory ledger.

Auth:
- Catalog/review reads do not require buyer login. Public access returns only launched shops; an authenticated owner can preview a saved design draft.
- Review mutations verify order credentials. Seller review management requires the existing seller session and shop ownership.

## `GET /:subdomain`

Request:
- Path param `subdomain`: published shop subdomain.
- No body.

Example:

```txt
GET /api/v1/storefront/nafis-fashion
```

Response:

```json
{
  "shop": {
    "id": "uuid",
    "displayName": "Nafis Fashion",
    "subdomain": "nafis-fashion",
    "category": "fashion",
    "country": "Bangladesh",
    "currency": "BDT",
    "language": "bn-en",
    "policyDefaults": {
      "deliveryCharge": 0,
      "returnDays": 3,
      "codAllowed": true
    },
    "selectedTemplateId": "fashion-lifestyle"
  },
  "template": {
    "id": "fashion-lifestyle",
    "status": "available"
  },
  "products": []
}
```

Side effects:
- None.

Audit/timeline:
- None. Public read only.

Cache:
- The frontend API bridge uses `no-store`, so inventory and published design changes are fetched fresh.
- Owner previews, messaging and reviews must not be shared through a public cache.

Errors:
- `404 SHOP_NOT_FOUND` when shop is missing or not launched.

## `GET /:subdomain/products/:slug`

Purpose: public product detail for an active product in a launched shop.

Response: product description, image URL, active variants, prices, and current ledger stock. Address, customer, and internal shop data are never returned.

Side effects: None.

Errors: `404 PRODUCT_NOT_FOUND` when the shop is unpublished or product is unavailable.


Database failures return 503 DATABASE_UNAVAILABLE with no database connection details.
# Inventory compatibility update

Catalog product objects now include their canonical `slug` as an additive field. Product renames retain the existing slug, keeping detail URLs stable. Existing fields and routes remain unchanged. Inventory ledger deltas continue to represent available-stock changes.



## Private storefront messaging

- POST `/:subdomain/chat/session`: establishes a 30-day HttpOnly, SameSite=Lax browser capability for this published shop. Secure over HTTPS. Only its digest is stored. Returns `{ ready: true }`.
- GET `/:subdomain/chat/messages`: reads only this capability's conversation, up to the latest 100 messages. Public DTO includes id, sender, text and createdAt; drafts, internal notes and audit records are never exposed.
- POST `/:subdomain/chat/messages`: `{ name, text, requestId }`. Name 2–100 characters, text 1–4,000, UUID request ID. Atomically creates a new guest customer/conversation on the first message and appends the message, customer activity and audit event. Unverified guest details never merge with an existing customer.

Auth: Shop-specific browser capability, separate from merchant login. Mutations require APP_ORIGIN. A different browser has a different private conversation. Clearing cookies loses guest access; cross-device chat recovery is outside this minimal flow.

Side effects: Incoming messages appear in the merchant Inbox. Staff messages are transactionally persisted to the same stream, which the buyer UI polls while visible. This is real in-platform delivery, not email, Meta or push delivery. Replaying a request ID with the same body returns the original message; changed content conflicts. Session and message creation are rate limited.

Audit/timeline: Buyer messages and staff replies append scoped events and update lastActivityAt. Buyer output excludes internal records.

Cache: no-store for all chat requests.

Errors: 400 validation, 401 BUYER_SESSION_REQUIRED, 403 ORIGIN_REJECTED, 404 unpublished/missing shop, 409 IDEMPOTENCY_CONFLICT, 429 rate limit, 503 database unavailable. Failed sends retain text and their request ID in the UI for retry.

## Seller-authored content and previews

`shop.content` contains the validated public storefront content (brand, hero, collections, story, contact, policies, FAQs and controlled theme design settings). Raw `storefrontConfig` and unpublished draft content are not returned to buyers. Missing content is normalized to defaults; optional empty sections are hidden by the frontend. A published `storeName` overrides the public display name without changing the seller's internal shop record.

`?preview=true` reads saved draft content only when the request contains its owner's valid session, and also permits that owner to read an unpublished shop. Anonymous callers and other sellers still receive 404 for unpublished stores. The same owner restriction applies to individual product reads. A preview header alone does not bypass publication checks. The storefront UI disables checkout in owner preview.

Theme IDs are `fashion-lifestyle`, `beauty-cosmetics`, `electronics-gadgets`, `food-restaurant`, and `modern-general`. All themes render the same catalog, variant and inventory records. Legacy theme references are mapped by the template catalog; switching a theme does not duplicate or delete products. Draft/publish behavior and schema limits are documented in [onboarding.md](onboarding.md).

## Guest checkout and tracking

`POST /:subdomain/checkout` and `POST /:subdomain/orders/track` are documented in [orders.md](orders.md). They do not require buyer login. Tracking matches an order reference and checkout phone; review submission additionally requires a private receipt key and delivered status.

## `GET /:subdomain/reviews`

Purpose: List real reviews for the store, or for one product when `productId` is supplied. Store and product ratings are kept separate.

Auth: Public, launched shop only.

Request: Optional `page` (integer 1–1,000, default 1) and `productId` (UUID). Omit `productId` to read store reviews.

Response: `{ reviews, count, average, distribution, page, hasMore }`. Pages contain up to six newest reviews. `average` is `null` when there are none. `distribution` contains count entries for ratings 5 through 1. Each review exposes `id`, nullable `productId`, public `name`, integer `rating`, `text`, `createdAt`, `purchaseVerified: true`, and a nullable `{ text, at }` seller reply. Order IDs, buyer phones, receipt keys and hashes are excluded.

Side effects: None.

Audit/timeline: Read only.

Cache: `no-store`.

Errors: 400 `VALIDATION_ERROR`; 404 `SHOP_NOT_FOUND`; 429 general rate limit; 503 `DATABASE_UNAVAILABLE`.

## `POST /:subdomain/reviews`

Purpose: Publish a review backed by the buyer's delivered platform order and private checkout receipt.

Auth: Guest; no account required. Requires `APP_ORIGIN`, a matching order reference/phone/receipt-key digest, and order status `delivered` in this shop. A product review must refer to a product in that order.

Request: Strict `{ orderId, phone, receiptKey, name, rating, text, productId? }`. Order and product IDs are UUIDs; receipt key is 64 lowercase hexadecimal characters; phone uses checkout normalization; public name is 2–60 trimmed characters; rating is an integer 1–5; review text is 10–1,500 trimmed characters. Omitting `productId` creates a store review.

Response: `{ review }` using the public DTO above. The review is immediately visible. Exact retries return the existing review; changed content cannot overwrite a previously submitted review.

Side effects: Transactionally creates one `verifiedReviews` record. A unique index on `{ shopId, orderId, target }` allows one store review and one review per purchased product per order, including concurrent requests. There is no fabricated rating or imported testimonial.

Audit/timeline: The review has a creation timestamp. It does not alter order or stock status. Seller replies create an audit event.

Cache: `no-store`.

Errors: 400 `VALIDATION_ERROR`; 403 `ORIGIN_REJECTED` or `REVIEW_NOT_ELIGIBLE`; 404 `SHOP_NOT_FOUND`; 409 `REVIEW_EXISTS`; 429 rate limit (30 requests per 15 minutes); 503 database unavailable.

Verification boundary: “Verified purchase” means the platform's delivered order and private receipt credentials were checked. Delivery is manually marked by the seller; no independent courier/payment confirmation or SMS ownership check exists in this phase. There is no receipt-key recovery endpoint.

## Seller review management

Base path: `/api/v1/reviews`.

Auth: Existing seller session, ownership of `shopId`, and `APP_ORIGIN` for PATCH. Another seller receives 404.

### `GET /:shopId`

Request: Shop UUID, no body.

Response: `{ reviews }`, newest first, maximum 100. Uses the public review DTO plus `productName` (null for store reviews; a fallback label if the product no longer exists). No private receipt/order credentials are returned.

Side effects: None.

Audit/timeline: Read only.

Cache: `no-store`.

Errors: 400 invalid shop identifier; 401 `AUTH_REQUIRED`; 404 `SHOP_NOT_FOUND`; 503 database unavailable.

### `PATCH /:shopId/:reviewId/reply`

Request: Strict `{ text }`, 2–1,500 trimmed characters.

Response: `{ reply: { text, at } }`. The seller can publish or replace their public reply. This operation does not change the buyer's review or rating.

Side effects: Updates the scoped review and writes an audit record in one transaction. There is no delete-review or edit-buyer-rating endpoint.

Audit/timeline: `review.replied`, owner identity and review target; reply timestamp is public.

Cache: `no-store`.

Errors: 400 validation; 401 authentication; 403 origin; 404 shop/review not found; 503 database unavailable.
# Product contact settings

The existing storefront-content DTO additionally accepts `whatsappNumber`, `messengerUrl` and `contactMessage` (all default to an empty string for existing stores). Settings use the existing owner-only content PATCH, version checks, private draft and publication behavior. Public storefront content exposes only the published settings.

`whatsappNumber` must contain 7–15 digits including a nonzero country code, with optional display punctuation. `messengerUrl` must be HTTPS on `m.me` with one page username/ID path and no credentials, port, query or fragment. `contactMessage` is limited to 500 whitespace-separated words and is required when either channel is set. Invalid settings return the existing `400 VALIDATION_ERROR` with field issues.

The frontend expands `{shop_name}`, `{product_name}`, `{product_price}`, `{product_url}` and `{variant}` as plain text. Contact buttons create no order or inbox message; they hand a draft to the buyer for external review and sending. Existing ordering and messaging APIs are unchanged.

