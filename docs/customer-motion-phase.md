# Customer Management and public motion revision

4 October 2026. Based on PDF 10 (Customers, CRM, Coupons and Retention) and the user's focused release brief. PDF 10 labels CRM P1; this phase explicitly promotes the directory/profile slice. Its campaign, coupon, segmentation, merge and retention work remains deferred. Inventory is preserved. AI Reply Automation is the next recommended phase, not part of this implementation.

## Motion audit and corrections

The second section used `visibility: hidden` on facts/draft containers, so crossing a discrete step made whole panels appear. It now keeps the composition mounted and uses continuous, overlapping opacity/translate/scale ranges: frame, customer question, product, stock, customer note, reviewed draft. The narrative is established first. Manual story controls navigate the same scroll position on desktop; compact/reduced-motion layouts show complete content.

The old storefront animated across `start 75%` to `end 30%` with no matching pinned duration. Selection changes also ran shared-layout animation and replaced UI emphasis. The revised desktop section has a 210vh target, a sticky composition, `start start` → `end end` mapping and fixed geometry. The hero bag establishes first, then shirt, organiser, sandals and hand balm enter in staggered ranges, then the selected/in-stock state resolves. Supporting images are original lightweight SVG product illustrations, not empty swatches. Name, variant/material and price finish each card. The existing bag photograph remains central. Other preview swatches now depict actual products too.

Desktop pinning is enabled only at 1000px+ width and 800px+ height, without reduced motion. Tablet, mobile, short screens and reduced-motion users receive a complete naturally scrolling collection. No horizontal-scroll dependency, hidden products or dead pinned range on compact layouts.

The hero previously invoked state setters from scroll at the page root, allowing repeated work and re-rendering unrelated scenes. Its continuous transforms now remain MotionValues; the content is established without discrete root state. Other step labels update only when a boundary changes. The workflow's scroll-driven shared-layout ring was replaced by local focus styling, reducing geometry work. Large storefront shadows were removed along with the old overlapping preview stack. No animated dimensions, filters, blur or shadows were added.

Live testing found another mapping problem in the installed Motion version: accelerated ViewTimeline transforms on the nested opacity ranges did not match the JS scroll position, leaving panels faded near the scene's end. The shared ScrollLayer now derives opacity and transforms using function MotionValues. This avoids that accelerated mapping path; it does not add per-frame React state or layout queries. Forward and reverse scroll are tested. This is a project-specific observed compatibility issue, not a claim about all Motion versions.

The finale keeps the existing statement and primary CTA, but replaces the generic closing block with a connected product/person/review scene. The supporting rows settle before the CTA resolves; one strong wordmark closes the page. Mobile retains one readable vertical composition. No live messaging, AI, fabricated business metrics, gradients or new business actions were added to public scenes.

## Customer slice

`/customers` is now a real directory with debounced name/phone/email search; status, source and tag filters; paginated desktop table; compressed tablet columns; and mobile customer records. One empty-state action starts a customer record. Loading, retry, validation, no results, missing contact data and not-found states are handled.

The large profile drawer is one continuous record: identity, explicit data-availability context, contact/addresses, tags/status, timeline, staff notes and a clearly disconnected future AI area. A structured editor supports name, phone, email, addresses, language, manual tags, source and active/inactive status. Inactivation requires confirmation. Failed saves keep drafts. Version conflicts require reloading rather than overwriting current facts. Notes are immutable, timestamped and attributed to the real development context rather than a fabricated logged-in staff member.

There are no revenue/order counters, fabricated history or calculated return-risk scores. `orderSummary` and `riskContext` are null until authoritative integrations exist. A manual high-return tag is a staff label, not inferred evidence. No messaging consent is implied by customer status or tags.

## API and data

Prefix `/api/v1/customers`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /:shopId | Filtered, paginated directory |
| POST | /:shopId | Idempotent create |
| GET | /:shopId/:customerId | Customer record |
| PATCH | /:shopId/:customerId | Versioned facts, tags and status |
| GET | /:shopId/:customerId/history | Paginated timeline |
| POST | /:shopId/:customerId/notes | Idempotent immutable staff note |

See [API reference](../backend/docs/api/customers.md) for exact request/response contracts and errors. Frontend types, adapters and service are separate; components call the service, never scattered fetches. The existing Next allowlisted bridge handles Customer requests and normalizes errors.

`customers` stores UUID/shop IDs, validated facts, fact version, timestamps, activity time and private idempotency metadata. `customerEvents` stores typed immutable created/updated/note events with source, author, timestamp, changed-field names and an optional future source reference. Its envelope also supports order/conversation/return/complaint events for future trusted writers; no arbitrary event-injection endpoint exists. Existing `auditEvents` receives each successful change in the same transaction.

Indexes: shop/activity/id; shop/status/source; shop/tags; unique partial shop/normalized phone; unique shop/create request. Timeline uses shop/customer/time/id and unique partial shop/note request. Optional contact fields remain optional. Phone normalization removes formatting only; it does not guess country codes or merge identities. Duplicate-phone attempts preserve both the existing record and its history.

## Boundaries

- Customer administration, like Inventory, is local development only. Fastify blocks production/non-loopback use; the Next bridge blocks production and enforces same-origin writes. Authentication, shop ownership and staff permissions are still prerequisites for production access.
- No merge/delete, saved segments, coupons, campaigns, consent capture, automation, Orders or Inbox ingestion. No delivery, payment, growth or Ads implementation. Existing release navigation continues hiding those modules.
- Notes cannot be edited or deleted; a corrective note can follow. Source is one primary channel; multi-channel external identities are future integration work.
- Search is escaped substring matching with bounded pagination; a large-scale search index is future work. No unsupported performance claim for very large directories.
- Marketing prices, stock and customer scenes are clearly illustrative. Real Customer screens use Atlas data.

## Verification and artifacts

Customer API suite uses a generated Atlas database and removes only that exact database in `finally`. It verifies 39 API checks: creation/read/update, tags, notes, history, strict validation, optional contacts, duplicate rollback, scoped queries, four concurrent updates (one winner), repeated concurrent note requests (one event), pagination, indexes, audit consistency and production guards.

Browser coverage includes real Atlas create/edit/note/status flows, invalid duplicate preservation, API error/retry, directory filters, profile history, accessibility and responsive layouts at 1440/1280/1024/768/430/390. Motion checks exercise partial assembly, completion, reverse scroll and static compact/reduced-motion modes.

Artifacts in `docs/screenshots/customer-motion`: directory/profile/collection/finale screenshots; staged story/storefront frames; `full-scroll-review.webm`; continuous wheel observations; before/after performance JSON. `scripts/measure-scroll.mjs` samples rAF intervals and Chrome layout/script metrics in a headed browser. `scripts/review-customer-motion.mjs` records an uninterrupted wheel pass, then detailed scene replays and AI approval interaction. Frame timing is machine-specific, not a universal FPS guarantee.

The initial development-build storefront segment measured a 50 ms p95 frame interval and 12 layout recalculations. An intermediate revised development run measured 33.3 ms and zero layouts. Final production-build sampling measured 17.0–17.1 ms p95 across hero, story, storefront, AI, workflow and finale, with no sampled intervals above 33.4 ms. Different build modes are reported separately; these numbers are not a controlled percentage-speedup claim. The final production storefront segment performed four layouts totalling 1.4 ms (rather than continuously recalculating layout per frame). The complete production recording includes 145 continuous wheel samples, followed by scene replays and the reviewed AI demo. Automated tests separately verify forward/reverse ranges and all six required widths.

Production bridge verification rejects Customer GET and POST administration with 503 AUTH_REQUIRED. No production write was attempted. The regular frontend/backend are restored after isolated UI verification; current private Atlas configuration is preserved.

## Run

Frontend: `npm run dev` at the root. Backend: `npm run dev` in `backend`. Current private Atlas configuration remains unchanged. Customer API verification: `npm run test:customers` in `backend`. For write UI tests, use `scripts/verify-ui-backend.mjs` as the isolated port-4000 backend and set `EASY_SHOP_LIVE_VERIFY=1`; do not point those write tests at business data. Type `stop` into the isolated runner to close and remove its generated database.

Next recommended task: AI Reply Automation, after this phase's visual review. Production authorization remains a separate prerequisite.
