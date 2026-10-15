# Store Design verification

Verified on 13 October 2026. All data created for browser/API testing lived in generated, isolated Atlas databases. The storefront browser database and the known empty leftover test database were removed. The normal backend is restored on port 4000, with the frontend on port 3000.

## Delivered

- Five distinct storefront presentations: Atelier, Bloom, Circuit, Gather and Forma. They share the real catalog and commerce APIs.
- Store Design at `/website`: Themes, Branding, Homepage, Sections, desktop/mobile Preview, Save draft and Publish changes.
- Saved drafts remain private. Product navigation retains owner preview and selected theme; preview checkout stays disabled. Publication does not replace products.
- Guest product details, persistent bag, cash-on-delivery checkout, downloadable receipt and limited order tracking.
- Product and store reviews backed by a delivered order and private receipt key, plus authenticated seller replies and manual order fulfillment.
- Scroll-responsive cover imagery, section motion and a reduced-motion path without hydration errors.

## Passing checks

| Check | Result |
| --- | --- |
| Frontend production build | Passed, including TypeScript and 21 generated pages |
| Backend TypeScript build and API documentation | Passed; 12 route files checked |
| Changed frontend components, adapters and tests | Targeted ESLint and TypeScript passed |
| Store Design Atlas integration | 63 API checks passed, including all five themes, draft privacy, publication, ownership, conflict handling and catalog preservation |
| Guest commerce Atlas integration | 69 checks passed, including idempotency, stock races, rollback, verified reviews, privacy and seller replies |
| Browser seller-to-buyer journey | Passed: content editing, failed-save retention, images, launch, responsive layouts, checkout, tracking, delivered-order reviews, seller reply, theme draft/preview/publish and section controls |
| Five-theme presentation QA | Passed at 1440, 390 and 320px; home/product/cart/checkout inspected; no reported WCAG A/AA axe violations in checked surfaces |
| Catalog size and motion | Passed for empty, 1, 2 and 8-product browser fixtures; scroll transforms respond, reduced motion disables them without browser errors |
| Onboarding Atlas regression | 36 API checks plus race, rollback, reconnect and isolation passed |
| Authentication Atlas regression | 21 API checks passed |
| Inventory Atlas regression | 39 API checks passed |
| Customers Atlas regression | 39 API checks passed |
| Current storefront messaging regression | 26 checks passed with a real OpenAI draft, approval and actual delivery to the isolated guest chat |
| Commerce browser smoke tests | 2 passed; one separately gated real-Atlas test skipped (covered by the dedicated integration/journey above) |

Screenshots and machine-readable theme results are in `docs/screenshots/storefront-themes`; the gallery and full buyer journey are in `docs/screenshots/storefront-editor`. Images use a disposable example shop, not fabricated content in a real seller store.

## Limits and remaining test maintenance

The old `backend/test/ai-replies.integration.mjs` script predates seller authentication. It fails at onboarding setup with `403 ORIGIN_REJECTED` because it does not establish a session or send the required origin. Application security was not weakened to accommodate it. The current authenticated storefront messaging suite passes; the legacy Inbox script still needs migration to current contracts.

Checkout currently uses cash on delivery and manual seller fulfillment. Review verification checks platform delivery status and private receipt credentials, not independent courier/payment proof. Order-reference and phone matching is not SMS verification. No buyer account, payment gateway, courier integration, arbitrary page builder or favicon editor was added.

## Repeating the checks

- `npm run build`
- `npm --prefix backend run check:api-docs`
- `npm --prefix backend run test:storefront-editor`
- `npm --prefix backend run test:guest-commerce`
- Start `node scripts/verify-editor-backend.mjs`, run the frontend with `BACKEND_API_URL=http://127.0.0.1:4002`, then `npx playwright test tests/storefront-editor.spec.ts --workers=1`.
- Set `THEME_QA_SHOP` to the disposable `studio-...` storefront printed by the browser test and run `node scripts/verify-storefront-themes.mjs`. Theme and catalog-size overrides only affect the browser, never stored seller data.
- Send `stop` to the verification helper to remove its generated database. Restore the frontend's backend URL to port 4000 afterward.
