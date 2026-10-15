# Inventory API

Purpose: Manage the current shop's product facts, variants and stock with an immutable inventory ledger. No warehouse, BOM, barcode, customer or AI automation implementation.

Auth: Requires an HttpOnly merchant session and server-side shop ownership validation. Mutations require the configured Origin. See auth.md. Account IDs are resolved by the server; production is supported.

Request: JSON, Zod strict validation. Prefix `/api/v1/inventory/:shopId`.

| Method | Path | Input |
|---|---|---|
| GET | /products | q, status=all/draft/active/archived, category, stock=all/healthy/low/out, page, limit (1–100, default 30) |
| GET | /products/:productId | UUID identifiers |
| POST | /products | requestId UUID, product object |
| PATCH | /products/:productId | version, complete product object |
| POST | /products/:productId/adjustments | requestId UUID, variantId, version, kind, quantity, reason (3–500 chars) |
| GET | /products/:productId/history | page; 50 entries per page |

Product: name, SKU, category, description, price, nullable comparePrice/cost, image URL array (max 8), status, 1–50 variants, aiFacts (sellingPoints/audience/care/policyExceptions), SEO title/description, delivery weightGrams/note. Money is nonnegative with two decimal places. SKU is normalized uppercase. Compare price cannot be below price. Variants have title, SKU, size, color, material, image URL, nullable priceOverride, openingStock and lowStockThreshold. Existing variants require their ID; openingStock must be zero on updates. Existing variants cannot be deleted because ledger references must survive. Archive the product instead. An active product requires a name and valid price.

Response: Product detail includes canonical slug, currency, version, variants with onHand/reserved/available/sold/returned/version, and aggregate available/reserved/lowStock/outOfStock. List returns products, total, page, categories and summary for the search/status/category view before stock filtering. Queries exceeding 2,000 matched products require narrower filters. History returns entries, total and page. Legacy opening entries are normalized for display.

Side effects: Product, variants, images, audit and opening balances/ledger are transactional. Adjustments atomically update the variant lock, balance, ledger and audit. Image URLs are metadata references; no uploads or server fetching. Existing storefront response shapes remain unchanged. Ledger deltaQuantity represents the available-stock delta for compatibility with existing storefront/onboarding readers.

Kinds: correction applies signed on-hand change; receive increases on-hand; reserve increases reserved; release decreases reserved; sale consumes reserved and on-hand while increasing sold; return increases on-hand/returned. Returns cannot exceed sold. No negative on-hand/reserved/available stock or backorders. These are explicit manual inventory operations; no Orders workflow or automatic reservation exists yet.

Audit/timeline: Every stock change records product, variant, before/after on-hand and counters, difference, reason, fixed development actor/source, timestamp and requestId. No ledger edit/delete endpoint exists. Existing onboarding ledger quantities lazily initialize balances on the first adjustment. Transactions and version checks serialize concurrent modifications. Repeated create/adjust requestIds with identical input return the existing result; reuse with differing data returns a conflict. Concurrent first attempts may return a uniqueness conflict and can safely retry the same requestId.

Indexes: Existing shop/product/variant indexes remain. Added shop+product SKU uniqueness (partial), shop+requestId uniqueness (partial), shop+category+timestamp, balance shop+product, ledger shop+product+timestamp and partial shop+requestId uniqueness. Existing variant SKU uniqueness applies across a shop.

Cache: no-store.

Errors: Stable `{code,message,issues?}`. 400 VALIDATION_ERROR / INVALID_QUANTITY / USE_ADJUSTMENT; 404 SHOP_NOT_FOUND / PRODUCT_NOT_FOUND / VARIANT_NOT_FOUND; 409 VERSION_CONFLICT / SKU_CONFLICT / INVALID_STOCK / IDEMPOTENCY_CONFLICT / VARIANT_HISTORY_REQUIRED; 422 FILTER_REQUIRED; 503 AUTH_REQUIRED / DATABASE_UNAVAILABLE. Infrastructure details and credentials are never returned.

Limitations: No file upload, bulk import writes, bulk edits, warehouse management, automatic order reservation, deletion or authenticated actor identity. SEO/delivery/AI facts persist as approved metadata; no new downstream automation is implemented. External image changes retain old asset metadata for traceability. CSV export currently exports the visible frontend page only.
