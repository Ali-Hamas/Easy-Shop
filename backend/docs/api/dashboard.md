# Dashboard summary

Purpose: Return real operational counts for the current implemented modules.

Auth: Authenticated shop owner; same ownership boundary as Inventory and Inbox.

Request: GET `/api/v1/dashboard/:shopId`.

Response: Shop ID, product/available/reserved/low/out totals, customer count, open conversation count, pending draft count, reviewed replies sent, and eight recent audit events. Inventory retains its existing 2,000-product query safety limit. Counts are current totals, not invented revenue or growth statistics.

Side effects: None.

Audit/timeline: Reads recent shop audit records without exposing credentials or customer message bodies.

Cache: no-store.

Errors: 400 invalid ID, 401 AUTH_REQUIRED, 404 SHOP_NOT_FOUND, 422 inventory safety limit, 503 DATABASE_UNAVAILABLE.
