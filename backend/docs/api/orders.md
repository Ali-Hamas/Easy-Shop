# Guest checkout and seller orders API

Purpose: Create guest cash-on-delivery orders, expose limited order tracking, and let a shop owner advance orders through the supported manual fulfillment workflow. No buyer account, payment processor, SMS verification or courier integration is introduced.

Auth: Guest endpoints are public for launched shops. Guest POST requests require the configured `APP_ORIGIN`. Seller endpoints require the existing owner session and ownership of `shopId`; another seller receives 404. Seller mutations also require `APP_ORIGIN`.

Cache: `no-store` on guest order endpoints and authenticated seller requests. Do not cache receipt credentials, delivery details or tracking responses.

## `POST /api/v1/storefront/:subdomain/checkout`

Request: Strict JSON containing:

- `requestId`: UUID, retained when retrying the same checkout.
- `receiptKey`: 64 lowercase hexadecimal characters, generated from 32 random bytes in the buyer's browser. It is a private capability, not a public order reference.
- `buyer`: `name` (2–100 characters), `phone` (7–15 digits after formatting is removed), `address` (10–500 characters), and `city` (2–100 characters).
- `items`: 1–30 unique variant selections, each with `productId`, optional `variantId`, and integer `quantity` from 1 to 99. A variant is required when the product has multiple active variants.
- `expectedTotal`: nonnegative number. The server recalculates prices, configured delivery charge and total; it never trusts client prices.

Response: 201 `{ order }`. The public order DTO contains `id`, `status`, items (`name`, `quantity`, `productId`), `total`, `currency`, `timeline`, and `reviewEligible`. It excludes buyer name/address/phone, the receipt hash, request fingerprint and request ID. A successful exact retry returns the same order.

Side effects: Transactionally creates an order with `status: "new"` and version 0. Checkout requires `codAllowed`, active products/variants and sufficient current availability. It does **not** reserve or sell inventory yet. Duplicate checks reject a recent pending order for the same shop, normalized phone and exact item list. The stored receipt value is a SHA-256 digest; the plaintext key is never returned by the order APIs.

Audit/timeline: The order timeline starts with `new`. Seller status changes are audited separately. No payment is collected.

Errors: 400 `VALIDATION_ERROR` or `DUPLICATE_ITEM`; 403 `ORIGIN_REJECTED`; 404 `SHOP_NOT_FOUND`; 409 `IDEMPOTENCY_CONFLICT`, `PAYMENT_UNAVAILABLE`, `PRODUCT_UNAVAILABLE`, `VARIANT_REQUIRED`, `INVALID_STOCK`, `PRICE_CHANGED`, or `DUPLICATE_ORDER`; 429 rate limit (20 requests per 15 minutes); 503 `DATABASE_UNAVAILABLE`.

## `POST /api/v1/storefront/:subdomain/orders/track`

Request: Strict `{ orderId, phone }`. `orderId` is the UUID order reference and `phone` is normalized using the same checkout rules.

Response: `{ order }` using the limited public order DTO above. `reviewEligible` means the platform order is marked delivered; publishing a review additionally requires the private receipt key.

Side effects: None. This matches the reference and phone against an existing order; it does not send an OTP or prove control of the phone number.

Audit/timeline: Read only; returns recorded status events.

Errors: 400 validation; 403 origin; 404 `ORDER_NOT_FOUND` for an unpublished shop or mismatched reference/phone; 429 rate limit (30 requests per 15 minutes); 503 database unavailable.

## `GET /api/v1/orders/:shopId`

Request: Owner session and shop UUID; no body.

Response: `{ orders }`, newest first, limited to the latest 100. Seller records contain buyer delivery details, variant snapshots, subtotal/delivery/total, status, version and timeline. `receiptHash`, `fingerprint` and `requestId` are excluded.

Side effects: None.

Audit/timeline: Read only.

Errors: 400 invalid shop identifier; 401 `AUTH_REQUIRED`; 404 `SHOP_NOT_FOUND`; 503 database unavailable.

## `PATCH /api/v1/orders/:shopId/:orderId`

Request: Strict `{ version, status }`, with a nonnegative integer version from the current order.

| Current status | Allowed next status | Inventory effect |
| --- | --- | --- |
| `new` | `confirmed`, `cancelled` | Confirm reserves stock; cancelling an unconfirmed order has no stock effect. |
| `confirmed` | `packed`, `cancelled` | Cancelling releases the reservation. |
| `packed` | `shipped`, `cancelled` | Cancelling releases the reservation. |
| `shipped` | `delivered` | Delivery records sold stock and clears the reservation. |
| `delivered`, `cancelled` | None | Terminal in this workflow. |

Response: `{ status, version }`, with the incremented version.

Side effects: Status, timeline, inventory balances/ledger and audit update in one MongoDB transaction. Stock is rechecked at confirmation. An invalid transition, stale version or inventory conflict leaves the whole operation unchanged. The seller must confirm real delivery availability and payment arrangements before accepting an order.

Audit/timeline: Appends a status timestamp and `order.status_updated`, identifying the owner and previous/next statuses.

Errors: 400 validation; 401 authentication; 403 origin; 404 shop/order not found; 409 `VERSION_CONFLICT`, `INVALID_TRANSITION`, `INVALID_STOCK` or `VARIANT_NOT_FOUND`; 503 database unavailable.

## Boundaries

Statuses are entered manually by the seller. `delivered` is not an external courier or payment verification. There is no refund, return, post-shipment cancellation, buyer dashboard, receipt-key recovery service or automated customer merge in this phase. Order receipt keys must not be included in URLs, analytics, application logs or public responses. Store and product review eligibility is documented in [storefront.md](storefront.md).
