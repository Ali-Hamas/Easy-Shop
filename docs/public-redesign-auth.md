# Easy Shop public redesign and Phase 2 auth UI

Historical phase report. The later combined phase supersedes its Dashboard gate and integration status; see [combined-phase.md](combined-phase.md).

## Scope and status

The public website and auth UI are implemented and awaiting visual approval. Dashboard Phase 3 has not started. Existing workspace screens, backend implementation, MongoDB architecture and live API contracts are unchanged.

Official module requirements remain mapped in `product-map.md`; the latest redesign brief governs public presentation. Product fixtures are deliberately fictional. Inventory, customer and AI scenes are previews of later modules, not completed business functionality. No reply reserves stock, modifies a customer record, contacts an AI provider or sends a message.

## Public experience

- Editorial hero with a layered application frame, five interactive module scenes and a human-review fragment.
- Persistent desktop navigation; animated mobile navigation with Escape/focus restoration.
- Scroll-pinned five-step narrative: message, product, stock, customer, supervised draft. Manual step buttons provide an equivalent mobile and reduced-motion experience.
- Storefront composition combining desktop, mobile, product detail and management context. Its sage/sand visual identity stays separate from internal SaaS branding.
- Selectable inventory rows with low-stock and variant context; adjacent customer profile, notes and history.
- Interactive reply workspace: local example generation, edit, approve, preview send, reset. Preview send explicitly confirms that nothing was sent.
- Interactive six-step workflow with a connecting progress line, trust statement and product-led final CTA.

## Motion and responsiveness

Framer Motion uses roughly 150ms control feedback, 220–300ms state changes, 450ms section reveals and a staggered 650ms hero entrance. No perpetual decorative loops. Scroll progress changes only the current story step; it does not drive React state every frame. Transform/opacity carry most motion; layout/height transitions are limited to small controls and menus.

Reduced-motion preference removes reveals, scroll pinning and animated transition time. Mobile uses horizontally scrollable tour controls, a compact workspace preview, rearranged storefront layers, a stacked reply workbench and a 3-by-2 workflow. Desktop story spacing also adapts to shorter viewports.

## Authentication boundary

`/login` and `/register` share a branded composition and reusable form. Supported states: idle, client validation errors, pending/disabled, service error, service success, password visibility and focusable result feedback. Fields have labels, autocomplete and error associations. Sensitive fields are cleared after an attempt.

`types/auth.ts` defines inputs, a discriminated result and `AuthService`. `services/auth.ts` implements only an unavailable adapter. No network request, token, session, cookie or persistent account is created. The success rendering branch is reserved for a future genuine service response; ordinary submission never simulates successful authentication. Pending UI becomes observable when a future adapter performs asynchronous work. No artificial delay or fake login is used.

Validation checks required fields, basic email format and matching confirmation. Password-strength policy, email verification, secure session handling, recovery, CSRF protection and authorization remain backend-contract work. The current workspace preview is intentionally public and is not protected account data. Do not wire a successful UI result to protected operations until server authorization exists.

## Main files

- `app/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx`: routes and metadata.
- `components/public/public-experience.tsx`: public composition, story, reply demo, workflow.
- `components/public/product-scenes.tsx`: reusable illustrative product scenes.
- `config/public-demo.ts`: explicitly fictional fixtures.
- `components/auth/auth-experience.tsx`: shared auth composition and state handling.
- `services/auth.ts`, `types/auth.ts`: typed future integration boundary.
- `styles/launch.css`, `styles/auth.css`: scoped public/auth presentation using semantic tokens.
- `tests/public.spec.ts`: interactions, accessibility, normal/reduced motion, responsive screenshots and auth safety checks.
- `docs/screenshots/redesign/`: desktop/mobile review artifacts.

## Next step

Review and approve the public and authentication visuals. Only then start Dashboard Phase 3 within the agreed product scope. Authentication API integration is still blocked by the absence of a production auth contract; frontend validation is never an authorization boundary.

## Verified in this revision

- Frontend production build and TypeScript passed; ESLint reported no warnings; formatting check passed.
- All 17 browser scenarios passed across the regression run and corrected targeted rerun (13 existing workspace scenarios plus 4 public/auth scenarios). The final public/auth rerun passed 4/4.
- Axe found no violations in the tested desktop/mobile public and auth states. No public runtime/hydration errors were recorded. This does not replace a complete assistive-technology audit.
- Responsive checks covered 320, 375, 390, 430, 768, 1024, 1280 and 1440px. Screenshots were reviewed at 390px and 1440px. Section captures hide sticky navigation only while taking the image, to keep the section unobstructed.
- Backend TypeScript build and API documentation checks passed. The existing real-Atlas HTTP integration suite passed 36 API checks plus unique-index race, rollback, reconnect and isolation assertions. No backend source was changed.
- Auth tests confirm local validation, visibility toggling, unavailable-service feedback, cleared password fields, no account POST requests and no cookies. Future adapter pending/success behavior still needs integration testing when production authentication exists.
