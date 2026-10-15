# Social commerce workspace

Frontend foundation for an AI-first F-commerce operating system. Read `docs/product-map.md` before extending a feature. Official PDFs in the repository root are the source of truth; extracted text is in `docs/prd-extracted`.

## Run

Use Node.js 22 LTS or newer and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Public demos remain illustrative. Register or log in for the protected workspace and onboarding; each API enforces shop ownership.

```sh
npm run lint
npm run typecheck
npm run build
npm start
npx playwright install chromium
npm run test:e2e
```

Public and auth demonstrations render without external credentials. For connected setup and storefront data, configure the existing private backend environment and run `npm install` and `npm run dev` from `backend/` in a second terminal. The server-only `BACKEND_API_URL` defaults to http://127.0.0.1:4000; see `.env.example`. Geist is packaged locally. Browser automation requires a one-time Chromium download.

## Structure

```text
app/
  layout.tsx                  Root metadata, local Geist font, CSS
  page.tsx                    Public product experience
  (workspace)/
    template.tsx              Visible page-entry transition
    layout.tsx                Shared application shell
    dashboard/page.tsx        New-user and saved-shop overview
    inbox/orders/products/website/delivery/payments/
    customers/marketing/ads/ai/analytics/settings/
    design-system/page.tsx    Local component review surface
    loading.tsx, error.tsx    Shared recovery and loading
components/
  ui/                         Buttons, fields, display, overlays, tabs, toast
  layout/                     Shell, topbar, page header, placeholder template
  navigation/                 Grouped responsive sidebar
  data-display/               Metric placeholder
  forms/                      Semantic form section
  ai/                         Navigation-only command dialog
  commerce/                   Disconnected channel summary
config/                       Typed navigation and motion tokens
hooks/                        Command shortcut lifecycle
lib/api/                      Central request, error and timeout handling
services/                     Typed commerce and unavailable auth adapters
adapters/                     Presentation mapping and saved shop reference
styles/                       Semantic tokens and shared styling
types/                       Shared presentation contracts
docs/                        Product map, specifications, design system
tests/                       Route, keyboard, mobile and accessibility checks
```

## Scope and demonstration behavior

The frontend now connects to the existing Fastify/MongoDB onboarding and storefront APIs through a typed service layer and allowlisted server bridge. Local `/onboarding` saves real development data; `/store/:subdomain` and its product routes read published catalogs. Dashboard shows a saved shop or a guided new-user state. Public product scenes remain fictional demonstrations. Auth forms now use real HttpOnly sessions. Onboarding is linked to the authenticated owner. Public storefront reads remain available.

The command trigger and Ctrl/Cmd+K open a page finder. AI reply drafting is connected to the configured OpenAI provider with explicit human approval and separate storefront send. Setup forms send supported fields to the backend; database credentials remain server-side. Inventory and Customer Management now connect to real Atlas-backed APIs. Administration requires an authenticated shop owner. Storefront messaging is connected to Inbox and reviewed AI replies. See [the Customer and motion report](docs/customer-motion-phase.md).

## Design system

See `docs/design-system.md`. Internal SaaS tokens are isolated in `styles/tokens.css`. Future storefronts must use a separate layout/token scope; never inherit internal branding as a theme requirement. Client components are limited to interactions; route content remains server-rendered. Radix provides interaction behavior; our components own presentation and labels.

## Current phase and next step

Inventory was functionally approved. Public motion has been revised and Customer Management at `/customers` is implemented for review; see `docs/customer-motion-phase.md` and `backend/docs/api/customers.md`. Both management modules now enforce authenticated ownership. Run backend `npm run test:customers` or `npm run test:inventory` for isolated Atlas checks. The current audit and remaining verification are tracked in `docs/handoff-audit.md`.


## Current handoff verification

The expanded handoff is still in progress; historical phase reports are not completion claims for it. See `docs/handoff-audit.md`.

Run backend `npm run test:auth`, `npm run test:storefront-chat`, `npm run test:ai-provider`, `npm run test:inventory`, `npm run test:customers`, and `npm run test:atlas` against Atlas. Each integration suite creates and removes its own test database. To run the browser journey, start `node scripts/verify-ui-backend.mjs`, run Next dev, then set `EASY_SHOP_LIVE_VERIFY=1` and run `npx playwright test tests/handoff.spec.ts`. Enter `stop` in the isolated backend terminal to remove its database.

Production needs HTTPS and matching APP_ORIGIN settings in the Next.js and Fastify environments, plus the server-only BACKEND_API_URL on Next. Never prefix database or OpenAI secrets with NEXT_PUBLIC. Legacy unauthenticated development shops are not claimed by email; migrating those records requires verified ownership.
