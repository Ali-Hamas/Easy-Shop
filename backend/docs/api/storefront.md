# Storefront API

Base path: `/api/v1/storefront`

Purpose:
- Public read API used by the live-test storefront renderer.
- Looks up a launched MongoDB shop by subdomain.
- Returns shop profile, selected template metadata, active products, and stock from inventory ledger.

Auth:
- Public read.
- Only launched shops are returned.

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
    "selectedTemplateId": "test-fashion-basic"
  },
  "template": {
    "id": "test-fashion-basic",
    "status": "test_only"
  },
  "products": []
}
```

Side effects:
- None.

Audit/timeline:
- None. Public read only.

Cache:
- CDN/storefront can cache briefly.
- Invalidate when products, shop settings, or selected template change.

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
