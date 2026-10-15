# Three-area UI report

Scope: public website, seller storefront and seller dashboard. UI Laboratory and backend business logic were outside this pass.

1. **Public visual improvements.** Replaced the repeated split-layout opening with a wide connected product environment and a full-width pinned story. Existing product, inventory and customer scenes remain connected by the same example shop and product. The current workspace palette and semantic tokens are preserved; no gradients were added.
2. **Hero redesign.** A staged headline/CTA entrance leads into a single framed workspace containing storefront, inventory, customer context and a reviewed reply. Supporting panels enter in sequence; scroll enlarges and moves the environment. Example data is identified in the scene.
3. **Second section.** Six selectable stages follow workspace → storefront → inventory → customer → AI draft → decision. Overlapping MotionValue ranges reveal panels continuously. Reduced-motion mode displays a static, complete scene.
4. **Website animation.** Added the scroll-linked reply preparation path and retained the interactive edit/approve demonstration. Transforms and opacity carry the main movement. Discrete stage state changes occur only at stage boundaries.
5. **Scroll performance.** Local production Chromium/CDP sample at 1440×1000: approximately 16.8 ms p95 in all six sampled scenes. Hero: 3 frames above 33.4 ms; remaining sampled scenes: 0. This is a local measurement, not a guarantee for every device. See `screenshots/customer-motion/performance-three-ui.json`.
6. **Closing scene.** Shortened the closing statement and tied its product and reply back to the opening. Removed misleading live-catalog/COD claims from the illustrative scene. One primary registration action remains, with optional login.
7. **Seller storefront.** Uses actual shop identity, optional logo, product descriptions, stock, prices and existing gallery data. Removed unsupported handcrafted, verified-store and fast-delivery claims. The API does not expose a shop banner or shop description field; the layout uses a clean text fallback rather than inventing them.
8. **Product counts.** Empty catalog receives an empty state; one product gets a feature layout; 2–4 products use an editorial collection; larger catalogs use a grid. No extra products are generated. Count-specific browser checks use explicit test-only API fixtures, never production mock data.
9. **Storefront motion.** Product reveal, filtering layout transitions, gallery changes and a sliding bag remain lightweight. The bag now uses Radix dialog semantics for focus containment and Escape behavior. Reduced-motion preferences are respected.
10. **Mobile storefront.** Stacked product content, readable price/stock, accessible option buttons, search and comfortable bag controls. Fixed a collapsed mobile Add to Bag button. Broken gallery images receive the shared fallback. The bag is explicitly described as a selection, not an order.
11. **Dashboard.** Store identity now leads the page, followed by attention, AI review, operational totals and actual activity. A seller with no products is guided through setup instead of a row of empty totals.
12. **Store actions.** Live: View Store and Copy Link. Draft: Preview Store and Complete Setup / Launch. Not set up: disabled View Store with a focusable explanatory wrapper plus Set Up Store. Clipboard failures report failure rather than a false success.
13. **Dashboard motion.** Number changes use keyed transitions; AI entry honors reduced motion. Existing status and action feedback are preserved.
14. **Responsive verification.** Public website, storefront catalog, product detail and live dashboard checked at 1440, 1280, 1024, 768, 430, 390, 375 and 320 pixels without horizontal document overflow. Screenshots reviewed for desktop and mobile. Automated WCAG A/AA checks passed for the tested public, product-detail and dashboard states; this is not a full accessibility certification.
15. **Verification.** Final three-test Playwright suite passed: storefront counts/search/detail/bag; public scroll/reduced-motion/accessibility; real authenticated dashboard not-set-up/draft/live/copy-link. Dashboard tests used an isolated Atlas database, which was verified and removed. Production build and TypeScript passed. Touched files pass formatting checks. The earlier whole-project lint run had no errors and warnings in the existing Inventory editor; targeted final lint and production browser results are recorded below.

## Main files

- `components/public/connected-opening.tsx`
- `components/public/reply-story.tsx`
- `components/public/commerce-launch.tsx`
- `components/public/closing-scene.tsx`
- `components/storefront/storefront-experience.tsx`
- `components/dashboard/dashboard-overview.tsx`
- `styles/connected-opening.css`
- `styles/storefront.css`
- `styles/dashboard-focus.css`
- `styles/commerce.css`
- `types/commerce.ts`
- `app/page.tsx`
- `tests/three-ui.spec.ts`
- `scripts/measure-scroll.mjs`
- `scripts/review-three-ui.mjs`
- `scripts/verify-three-ui.mjs`

## Reproduce

Run `npm run build` and `npm start`. For public and fixture-based storefront verification run `npx playwright test tests/three-ui.spec.ts --grep "storefront count|public opening" --workers=1`. The dashboard test additionally requires the disposable backend (`node scripts/verify-ui-backend.mjs`) and `EASY_SHOP_LIVE_VERIFY=1`; enter `stop` in that backend terminal to clean its generated database after verification. Do not point that test at a production database.

Final verification update: targeted ESLint passed with no warnings or errors. The final production build (including TypeScript) passed. Both public/storefront tests also passed against `next start` (2 tests, 23.7 seconds); the real-data dashboard test passed in the earlier complete three-test run. `screenshots/three-ui/full-scroll-review.webm` records 150 physical-wheel samples through the page plus the AI approval demonstration. Intermediate story screenshots were inspected to confirm progressive panel appearance. Test-only Atlas database cleanup completed successfully.
