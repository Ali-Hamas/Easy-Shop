# Customer Management API

Purpose: Maintain an accurate customer directory, contact details, manual tags and an auditable timeline. This focused release excludes campaigns, coupons, merge, scraping and AI automation.

Auth: Requires an HttpOnly merchant session and server-side shop ownership validation. Mutations require the configured Origin. See auth.md. Account IDs are resolved by the server; production is supported.

Request: Prefix `/api/v1/customers`. UUID shop and customer IDs. JSON strict validation. Customer input: name (required, 120), phone (optional, normalized spaces/dashes/parentheses, 7–15 digits, explicit + preserved), email (optional, lowercase), addresses (up to 8: label, line, city, region, postalCode, country), language (`unspecified`, `en`, `bn`, `banglish`, `ur`, `roman-urdu`), tags (up to 20, lowercase deduplicated, 40 characters), source (`manual`, `facebook`, `instagram`, `storefront`, `other`), status (`active`, `inactive`). No automatic country-code inference or global identity merging.

| Method | Path | Body/query |
| --- | --- | --- |
| GET | /:shopId | q, status, source, tag, page, limit (default 30, max 100) |
| POST | /:shopId | `{requestId: UUID, customer: CustomerInput}` |
| GET | /:shopId/:customerId | — |
| PATCH | /:shopId/:customerId | `{version: integer, customer: CustomerInput}` (complete facts replacement) |
| GET | /:shopId/:customerId/history | page, 30 events per page |
| POST | /:shopId/:customerId/notes | `{requestId: UUID, text: string}` (1–4,000 characters) |

Response: Customer includes id, shopId, input fields, version, createdAt, updatedAt and lastActivityAt. `orderSummary` and `riskContext` are explicitly null because upstream modules are not connected. List returns customers, total, page, limit. History returns entries, total, page. Note returns event id. Requests/credentials/internal phone keys are omitted from responses. Creation/note writes return 201. Reads and updates return 200.

Side effects: Transactions write customer facts, timeline and audit together. Create/note request IDs are idempotent; reusing a key for different content returns 409. An update requires the current version and increments it only when facts change. Notes update lastActivityAt without replacing facts or incrementing fact version. Concurrent writes retry through the existing Mongo transaction layer; stale fact versions return 409. Normalized phone uniqueness is shop-scoped, optional and partial. A conflict never silently merges or overwrites records. Query text is escaped before regex matching. Search uses case-insensitive substring matching; large-directory search optimization is deferred.

Audit/timeline: `customers`, `customerEvents` and existing `auditEvents`. Customer-created, details-updated and staff-note events have immutable text, fixed author/source and timestamp; updates identify changed field names without duplicating private contact data. No delete/edit-event API. Future trusted Orders/Inbox integrations can use the typed event envelope for order, conversation, return and complaint with a reference; this phase exposes no arbitrary event-creation endpoint and fabricates no events. Payments/campaign events remain future extension work. Customer status does not imply messaging consent.

Indexes: customers(shopId,lastActivityAt desc,_id), (shopId,status,source), (shopId,tags), unique partial (shopId,phoneKey), unique (shopId,requestId). customerEvents(shopId,customerId,createdAt desc,_id desc), unique partial (shopId,requestId). Existing audit index retained.

Cache: no-store on all routes and Next bridge.

Errors: 400 VALIDATION_ERROR (field issues); 404 SHOP_NOT_FOUND/CUSTOMER_NOT_FOUND; 409 CUSTOMER_CONFLICT, VERSION_CONFLICT, IDEMPOTENCY_CONFLICT; 503 AUTH_REQUIRED/DATABASE_UNAVAILABLE. No database error/credential is returned. No customer data in application error logging. Frontend keeps form/note drafts for failed requests.
