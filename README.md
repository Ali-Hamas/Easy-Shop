# Easy Shop Backend

Minimal backend slice for the requested PDF scope only:

- `00-Platform-Overview-Roadmap`: foundation API shape, tenant-safe data, audit/timeline rule.
- `01-Onboarding-Store-Setup`: shop draft, subdomain check, first product, channel skip, AI mode, launch.
- `02-Website-Builder-Themes-Storefront`: template metadata and public launched-storefront reads.

## Run

```powershell
cd backend
npm install
copy .env.example .env
npm run db:migrate
npm run dev
```

## Check

```powershell
cd backend
npm run check
```

## APIs

- `GET /api/v1/health`
- `GET /api/v1/system/modules`
- `POST /api/v1/onboarding/start`
- `POST /api/v1/onboarding/subdomain/check`
- `GET /api/v1/onboarding/templates`
- `GET /api/v1/onboarding/:shopId`
- `PATCH /api/v1/onboarding/:shopId/shop`
- `POST /api/v1/onboarding/:shopId/products`
- `POST /api/v1/onboarding/:shopId/channels/meta/skip`
- `PATCH /api/v1/onboarding/:shopId/ai-mode`
- `POST /api/v1/onboarding/:shopId/template`
- `POST /api/v1/onboarding/:shopId/launch`
- `GET /api/v1/storefront/:subdomain`
- `GET /api/v1/storefront/:subdomain/products/:slug`

Docs live in `backend/docs/api/`.
