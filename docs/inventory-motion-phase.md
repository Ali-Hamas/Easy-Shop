# Inventory and motion phase

Implemented 4 October 2026 against the Products and Inventory Management PRD (03) and the approved phase brief. Customer Management, AI Reply Automation, Delivery, Payments and Growth remain outside this phase.

## Motion design

- Hero: scroll-linked product rise and scale, progressive product/customer/stock facts and draft reveal, a moving headline and desktop pinning. No permanent dimming of readable text.
- Existing conversation story: pinned question → facts → decision sequence, with manual controls and reduced-motion support.
- Storefront: seller selection → desktop preview → buyer mobile view. Position, scale and selection emphasis communicate continuity; text keeps its contrast.
- Inventory: healthy → reduced stock → low stock → affected row → review action. Uses the real Inventory StockSignal primitive with explicitly fictional quantities. No marketing interaction writes business data.
- AI: context and stock-lookup emphasis, draft transition and explicit approval. No generated answer, message sending or generic typing simulation.
- Workflow: progress line and shared-layout focus ring travel through all six system areas.
- Dashboard: metric value transitions, attention entrance, expandable setup guidance, milestone hover/focus feedback and status changes.
- Shell/data surfaces: retained active navigation and collapse behavior, stronger drawer entry/exit, menu/popover entry/exit, shop-switcher feedback, filter-to-results transitions, row hover/selection and stock-status changes.
- Motion preference uses a hydration-safe subscription. Server markup starts static, then browser preferences activate permitted motion. Reduced-motion users retain complete content and explicit controls. Large scroll transformations use motion values rather than React updates per frame.

## Inventory experience

`/products` now contains the real Inventory slice. It has search by product/SKU, status/category/stock filters, paginated desktop table, tablet compression and mobile product cards. The overview summarizes the filtered catalog, available units, reserved units and active low-stock products.

The editor is a large drawer with keyboard-operable sections: Basics, Media, Pricing, Variants & stock, Delivery & SEO, and AI facts. A desktop product card previews the entered facts. Product status supports draft, active and inactive/archived. Hiding a product requires confirmation. Existing variants retain their identity/history; new variants have explicit opening stock.

The detail drawer shows on-hand, reserved, available, sold, returned, thresholds, variants and paginated history. Adjustments require quantity, reason, before/after review and explicit confirmation. Invalid changes are blocked by both UI and backend. Failed saves retain the current editor values. Version conflicts require reloading current data rather than silently overwriting it.

Image URLs persist and feed the public storefront. Upload storage is not implemented. Cost stays private to management. Delivery, SEO and approved AI facts are stored metadata; this phase does not add downstream courier, SEO rendering or AI automation.

## Backend/API

Prefix: `/api/v1/inventory/:shopId`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /products | Search, filters, pagination and summary |
| GET | /products/:productId | Product, variants and stock counters |
| POST | /products | Transactional product creation and opening stock |
| PATCH | /products/:productId | Versioned facts, status and variant updates |
| POST | /products/:productId/adjustments | Versioned, idempotent stock operation |
| GET | /products/:productId/history | Paginated immutable ledger |

See `backend/docs/api/inventory.md` for field limits, request bodies, errors and counter semantics. Zod validates strict request objects. Money uses existing Decimal128 helpers. Product and variant SKUs are unique within a shop; identifiers are UUIDs.

Existing collections are extended rather than duplicated: products, productVariants, inventoryLedger, assetObjects, productImages and auditEvents. `inventoryBalances` adds an authoritative per-variant snapshot. New indexes cover product SKU, create-request IDs, category/time, balance shop/product, ledger product/time and adjustment-request IDs; existing variant SKU and identifier indexes remain.

Every stock operation transaction writes the balance, immutable ledger and audit. Ledger stores product, variant, before/after counters, difference, reason, fixed development actor/source and timestamp. Available = on hand − reserved. Corrections/receipts alter on-hand; reservations/releases alter reserved; a manual sale consumes reserved and on-hand; a return restores previously sold stock. Negative stock and excess returns are rejected. Per-variant write locking plus expected versions prevent lost concurrent updates. Create/adjust request IDs prevent duplicate writes after ambiguous retries.

Legacy onboarding opening stock is read from its ledger and initializes a balance on first adjustment. Ledger deltaQuantity remains the available-stock delta, preserving existing storefront/onboarding readers. Catalog responses add canonical `slug` so Inventory renames keep public product links valid. Existing response fields and URLs remain intact; older servers retain a frontend normalization fallback.

## Boundaries and dependencies

- Authentication and ownership authorization still do not exist. The new Fastify Inventory routes reject production mode and non-loopback callers. The Next bridge also blocks Inventory administration in production. Local actor labels are explicitly development identities, never fabricated authenticated staff names. This slice must not be exposed as authenticated production software before authorization is implemented.
- Manual reservations/sales/returns are inventory operations. Automatic order creation/reservation/cancellation is not implemented because Orders is a separate dependency.
- Import has a typed service boundary and a visible upload → map → validate → preview → confirm → result outline, clearly marked unavailable. No file is uploaded and no import writes are simulated. CSV export exports the current visible page only. Bulk edit/merge/import writes are deferred.
- Existing variants cannot be removed, preserving history. No destructive product deletion, warehouses, BOM or barcodes.
- Queries are bounded to 2,000 matched products before stock filtering; larger catalogs must narrow filters. This is not a claim of unbounded catalog scalability.
- External image metadata is stored; image hosting/availability and old asset cleanup are separate work.
- Product stock is real API data. Public marketing scenes remain explicitly fictional demonstrations.

## Verification and review artifacts

Validation passed: frontend production build, TypeScript, ESLint and formatting; backend TypeScript build and documentation checks for five route modules; 39 Inventory Atlas API checks; 36 existing onboarding API checks; 25 browser regression checks (two opt-in checks skipped in that run), plus both opt-in real Inventory UI/motion checks in a separate run. The Inventory suite also verifies canonical storefront links after product renaming.

Final runtime checks: regular frontend and backend restored; health and database readiness both return 200. Production Next Inventory GET and POST both return 503 AUTH_REQUIRED. The isolated Inventory API database was removed by its test runner. The earlier UI runner process ended before its cleanup could be confirmed; no unknown Atlas database was deleted during final cleanup.

Atlas tests use isolated generated databases and never substitute a local replica set. Inventory API coverage includes create/read/update/archive, variants, validation failures, idempotency, concurrent stock writes, unique-SKU transaction rollback, balance/ledger equality, legacy onboarding stock, storefront visibility and production access guards. Existing onboarding checks also pass.

Browser checks cover real Atlas product editing, safe adjustment, ledger history, filters, responsive cards/table/editor, keyboard navigation, accessibility, scroll-driven changes and reduced-motion controls. Review widths: 1440, 1280, 1024, 768, 430 and 390.

A headed Chromium session performs real mouse-wheel scrolling and interactions. `docs/screenshots/inventory/motion-review.webm` preserves the recording; `motion/observations.json` records changing transforms and active stages. Screenshots/contact sheets live in `docs/screenshots/inventory` and its `review` folder. This is browser interaction verification, not only code inspection.

## Key files and commands

- `backend/src/modules/inventory/`: routes, validation and transaction service.
- `backend/test/inventory.integration.mjs`: isolated Atlas verification.
- `components/inventory/`: workspace, product editor and shared stock status.
- `services/inventory.ts`, `types/inventory.ts`, `adapters/inventory.ts`: typed API boundary and presentation mapping.
- `components/public/motion-scenes.tsx`, `styles/motion-elevation.css`, `hooks/use-motion-preference.ts`: motion sequences and accessibility behavior.
- `tests/inventory.spec.ts`, `scripts/review-motion.mjs`: UI and real browser motion verification.

Run frontend with `npm run dev` from the root and backend with `npm run dev` from `backend`. Existing private Atlas configuration remains unchanged. Run `npm run test:inventory` from `backend` for isolated Atlas API checks. UI tests with EASY_SHOP_LIVE_VERIFY=1 require the isolated runner described in `combined-phase.md`; do not point write tests at business data.

Next recommended product module: Customer Management, after this phase's review. Production exposure also requires real authentication and shop ownership authorization.
