# Storefront refinement — 14 October 2026

The five theme presentations now share a denser catalog component, with four columns from 1200px, three from 768–1199px and two below 768px. Actual product counts are preserved: a two-product store shows two compact cards, never invented filler products. The dedicated single-product composition remains.

Atelier uses portrait photography and serif product titles; Bloom uses arch-shaped media and centered details; Circuit uses contained product images and structured cards; Gather uses circular images; Forma uses square images with an asymmetric corner. Featured single-product collections use a larger image-and-copy composition. Mobile headers give the shop name its own row and search the full width.

Motion includes scroll-driven cover zoom/parallax, cover-frame cropping and heading movement, section scale/translation tied to viewport entry, staggered product entrances, a subtle catalog image shift and hover feedback. All scroll transforms respect reduced-motion settings. No scroll hijacking, gradients or synthetic testimonials were introduced.

Ordering is temporarily hidden by `commerceUi.orders` in `config/commerce-ui.ts`: bag, purchase/quantity controls, checkout, tracking, editor tracking controls, Orders navigation and command search. Direct `/orders` navigation redirects to Dashboard. This is a UI release setting, not an API security control. No order records, stock workflows or backend routes were deleted or changed.

The browser suite `tests/storefront-browse.spec.ts` uses intercepted fixture data only. It checks all five themes at 1440, 1024, 390 and 320px; validates grid columns, real-item counts, absent ordering controls, product detail browsing, axe accessibility, scroll motion, reduced motion and absence of write requests/browser errors. Screenshots are saved to `docs/screenshots/storefront-browse` and are explicitly example fixtures, not published seller data.

The existing editor journey and visual verification script respect the visibility switch, retaining their order-flow checks for when ordering is re-enabled.

Validation completed: all five browse-only Playwright theme tests passed, scoped ESLint passed, TypeScript passed, and the production build passed. The local backend readiness endpoint also reported a connected database. These UI checks used browser fixtures; this change did not rerun the full Atlas integration suite or modify backend behavior.
