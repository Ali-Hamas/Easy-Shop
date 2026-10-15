# Backend: Fastify + TypeScript + MongoDB

This is the imported onboarding-backend slice, migrated to the native MongoDB driver. Authentication and the Inventory, Customer and AI Reply modules are not implemented in this branch. Do not expose unauthenticated onboarding mutations as a production seller administration API.

## Development

From `D:\eshop\backend`:

```powershell
npm ci
# Create .env from .env.example, then set the server-only MONGODB_URI.
npm run db:indexes
npm run dev
```

The existing local backend .env has been prepared privately from the workspace credentials. Do not overwrite it with the example. Frontend stays independent: run `npm run dev` from `D:\eshop` (port 3000). Backend defaults to loopback port 4000. APP_ORIGIN allows only the configured frontend origin; use an explicit HTTPS origin in production.

MONGODB_URI is required to start. MONGODB_DB_NAME defaults to easy_shop. Atlas must permit the machine's network address, provide valid TLS, and grant the database user access. Multi-document transactions require a replica set or Atlas. No insecure TLS fallback is configured. Connection failure exits startup without printing credentials. MongoClient is pooled and reused; SIGINT/SIGTERM close Fastify and MongoDB.

`GET /api/v1/health` is compatible liveness (`{"status":"ok"}`). `GET /api/v1/health/ready` pings MongoDB and returns 503 when unavailable. Both reveal no connection details.

## Tests

```powershell
npm run check
npm run test:atlas
```

`check` compiles, checks API docs and runs failure tests plus all database-backed API checks against a disposable local MongoDB replica set. The first run downloads a MongoDB test binary. This is a real MongoDB process, not mocked persistence. `test:atlas` uses the configured URI and a uniquely named `easy_shop_test_<uuid>` database; it deletes only that test database in finally. It fails rather than skips when unavailable. The Atlas user must be allowed to create and drop the isolated test database. Neither suite operates on the application's configured database.

Docker Compose now contains only the API and uses the configured Atlas connection. Real env files are excluded from Docker build context and Git. SQL is retained in legacy/postgresql strictly for reference and is never executed by active scripts.

## Known contract limitations retained

- Both template catalog entries are test-only, not production themes.
- Onboarding accepts imageUrl/variants/deliveryNotes, but the original backend did not persist them. This migration retains the default-variant behavior; it does not implement product management.
- Public store lists omit product slugs, so a frontend cannot reliably construct detail links from the listing alone. No slug contract extension was silently added.
- AI mode is stored configuration, not an AI execution engine.
- UUID API identifiers are retained. Duplicate owner identifiers now return explicit OWNER_CONFLICT instead of being mislabeled as a subdomain conflict. Decimal amounts retain two-decimal SQL numeric semantics.
- See docs/mongodb-migration.md for collection mappings and docs/environment-audit.md for credential boundaries.
