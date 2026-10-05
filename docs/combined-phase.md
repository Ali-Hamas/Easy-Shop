# Combined phase — 3 October 2026

Historical phase report. The user subsequently approved this phase functionally. See [Inventory and motion](inventory-motion-phase.md) for the following phase, including the new Inventory backend and frontend.

This phase supersedes the earlier gate postponing Dashboard Phase 3. It awaits visual and functional approval. No Inventory, Customer Management or AI Reply backend was added; backend contracts and MongoDB architecture remain unchanged.

## Visual changes

The public site follows a conversation through the business: open connected hero strips, large Geist typography, a pinned conversation, interactive workspace, layered storefront, stock signal, customer context, supervised reply, workflow and trust statement. White, cool gray and indigo support the SaaS identity. The storefront has its own sage identity. No gradients or glass effects.

Two desktop scroll narratives progressively reveal conversation → facts → human decision and storefront → customer → AI reply → inventory → customer record → dashboard. Mobile and reduced-motion layouts remove pinning and keep manual controls. Hero choreography and shared layout transitions support focus changes. Public scenes remain fictional and local; approval never sends a message.

Login is quiet and editorial. Registration introduces the planned account-to-store journey with validation, password visibility and loading/error feedback. Typed auth adapters remain unavailable: no requests, sessions, cookies, saved passwords or fabricated successful authentication.

The dashboard combines compact metrics, a dominant next-step section, attention, disconnected AI status, operational context and actual saved setup events. New users see four setup milestones instead of zero metrics. Saved shops show real launch state, catalog stock and progress. Delivery, Payments and Growth stay hidden.

## Implementation map

- `components/public/commerce-launch.tsx`: public composition and two scroll narratives.
- `components/public/public-experience.tsx`: header and reply demonstration.
- `components/auth/auth-experience.tsx`: account UI.
- `components/dashboard/dashboard-overview.tsx`: new-user and saved-shop states.
- `components/onboarding/onboarding-experience.tsx`: real setup journey.
- `components/storefront/storefront-experience.tsx`: catalog/product reads.
- `types/commerce.ts`, `services/commerce.ts`, `lib/api/client.ts`, `adapters/commerce.ts`: contracts, service methods, request/error handling and presentation adapters.
- `app/api/commerce/[...path]/route.ts`: allowlisted backend bridge.
- `styles/studio.css`, `styles/auth.css`, `styles/dashboard.css`, `styles/commerce.css`: scoped treatments.
- New routes: `/onboarding`, `/store/:subdomain`, `/store/:subdomain/products/:slug`.

## API status

All existing onboarding operations are connected: start, address check, templates, retrieval/resume, shop update, first product, Meta skip, AI preference, template selection and launch. Both existing storefront GET endpoints are connected.

Setup handles loading, validation, service/network failure, retained in-memory input, saved-state resume and success. A tab-scoped shop ID/display name and URL shop ID support resume; these are not authentication. Unsaved edits do not survive refresh. Writes are not automatically retried after ambiguous timeouts.

Catalog/product views handle loading, missing shop/product, empty catalog, service errors, retry, real prices/stock and missing images. Catalog responses omit slugs: the adapter mirrors existing backend normalization and validates returned product IDs to avoid showing the wrong product. Missing pages currently render client error states rather than page-level HTTP 404 responses.

## Remaining backend gaps

- Authentication, sessions and shop ownership authorization are absent. Onboarding proxy operations require local development and loopback Host; production returns 503 AUTH_REQUIRED. This is a development boundary, not authentication. Backend administration must remain private until authorization exists.
- Public storefront reads remain available in production. BACKEND_API_URL is server-only; database credentials never reach the browser.
- Templates are test metadata, not complete production themes; the buyer view uses one separate identity.
- First-product persistence supports the name, price and opening-stock path. Optional image/description/variant editing is not exposed because current persistence does not support the complete contract.
- No Meta OAuth, live replies, customer messaging, inventory/CRM management, checkout or payments were added.
- Start/product writes need idempotency. An ambiguous timed-out start may require backend assistance to recover its ID.
- Dashboard data is limited to onboarding snapshots; sales metrics, customer counts and AI history are not invented.

## Verification

- Next.js production build, TypeScript compilation and ESLint passed.
- Full browser suite: 24 passed, one opt-in Atlas test skipped. The Atlas test was subsequently run explicitly and passed.
- Final public/commerce run after shell refinements: 12 passed, including the Atlas journey.
- Final typography and shell checks: nine additional tests passed; formatting check passed.
- Actual Atlas UI verification covered every connected setup operation, refresh/resume, launch, catalog, product detail and saved dashboard, using an isolated generated Atlas database.
- Tests include both scroll narratives, keyboard interaction, local-only auth, retained input, empty catalog, network recovery, bridge path/origin rejection, overflow and desktop/mobile automated accessibility.
- Screenshots reviewed at 1440, 1280, 1024, 768, 430 and 390 for public, login, registration, dashboard, setup, catalog and product. See `docs/screenshots/combined/review`.
- Production port 3001 independently returned 503 AUTH_REQUIRED for onboarding GET/POST and the backend's 404 SHOP_NOT_FOUND for a missing public storefront.
- The generated Atlas verification database was checked against its two known test shops and removed after testing. Normal databases were not removed. Screenshots preserve the live verification results; those disposable shops no longer exist.
- Automated accessibility checks do not replace an assistive-technology audit or user visual approval.

## Image provenance

`public/images/olive-tote.webp` is a fictional product image generated with the built-in imagegen tool. Direction: plain olive canvas tote, premium editorial studio photograph, cool gray seamless background, no logo, text, people or props. Optimized with Sharp to a 900px WebP. Real merchant catalogs never receive this image as a substitute for missing photos.

## Run

Frontend: `npm install`, `npm run dev` from the root. Backend: configure the existing private environment, then `npm install`, `npm run dev` from `backend`. The bridge defaults to http://127.0.0.1:4000; `.env.example` documents the server override.

For isolated verification, stop any backend on port 4000, run `node scripts/verify-ui-backend.mjs`, then run commerce tests with EASY_SHOP_LIVE_VERIFY=1. Type `stop` into that runner to remove only its generated test database and close it. Requires Atlas connectivity and database creation permissions; no URI is printed.

Next step: review this combined phase. Do not begin postponed backend modules until approval.
