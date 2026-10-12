# Orders API

Purpose: Capture real storefront COD order requests and list the current shop's newest orders. This is the first order workflow slice only; it does not book couriers, collect payments or mark delivery.

Auth: Public buyers may submit `POST /storefront/:subdomain/orders` for launched shops through the Next proxy with Origin checks and route rate limiting. Merchant order listing requires an HttpOnly owner session and shop ownership validation through the shared auth hook.

Request: JSON, Zod validation. Prefix `/api/v1/orders`.

| Method | Path | Input |
|---|---|---|
| POST | /storefront/:subdomain/orders | requestId UUID, buyer name/phone/address/notes, 1-30 product variant lines |
| GET | /:shopId | shop UUID |

Checkout lines contain productId, variantId and quantity. If a storefront card only knows the product ID, the backend resolves the first active variant for that product. Prices and delivery charge are always read server-side from the live shop catalog; client prices are ignored.

Response: POST and GET return order ID, orderNumber, status, buyer, items, currency, subtotal, deliveryCharge, total, source and timestamps. Money is returned as numbers. GET returns the newest 100 orders.

Side effects: A successful checkout creates an order, reserves inventory per variant, writes inventory ledger reserve entries and records `order.created` in auditEvents inside one Mongo transaction. Repeated requestIds with the same body return the existing order; reuse with different data returns a conflict.

Audit/timeline: Order creation writes a shop audit event with actor `buyer`. Inventory reservation ledger rows include before/after counters, reason, source and request ID. No customer timeline, payment ledger or courier timeline is written yet.

Cache: no-store.

Errors: Stable `{code,message,issues?}`. 400 VALIDATION_ERROR; 404 SHOP_NOT_FOUND / PRODUCT_NOT_FOUND; 409 INSUFFICIENT_STOCK / VERSION_CONFLICT / IDEMPOTENCY_CONFLICT; 429 RATE_LIMITED; 503 DATABASE_UNAVAILABLE. Validation errors include field issues.

Limitations: No payment collection, COD reconciliation, courier booking, order status pipeline, cancellation/release flow, invoice, customer merge, analytics or Meta CAPI event yet. Reservations are created at checkout and need the next order-pipeline phase to release, sell or return stock.
