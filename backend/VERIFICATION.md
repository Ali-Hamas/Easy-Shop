# Migration verification — 2026-10-02

## Completed

- MongoDB native driver, typed collections, unique indexes, UUID API identifiers and Decimal128 prices.
- Shared connection pool; transaction sessions; startup index creation; SIGINT/SIGTERM shutdown; liveness and readiness endpoints.
- Existing 14 endpoint paths retained. Added GET /api/v1/health/ready. No authentication or missing product-domain backend added.
- PostgreSQL pool, queries and DATABASE_URL removed from active source. pg and @types/pg removed from package and lockfile. SQL and old migration script retained only under legacy/postgresql; upstream source remains in ../.backend-source.
- Docker Compose no longer provisions PostgreSQL. Backend env and Docker ignore rules exclude secrets.
- Frontend preserved except centralized navigation visibility for Delivery, Payments and Growth. Their routes remain available directly.

## Evidence

- Backend API documentation coverage: passed for all four route files.
- Backend strict TypeScript: passed.
- Real MongoDB replica-set tests: 36 API checks passed, plus concurrent subdomain uniqueness, transaction rollback, durable reconnect, isolation, decimal rounding and live HTTP health/storefront checks.
- Database-unavailable tests: passed for liveness, readiness, invalid UUID and sanitized 503 responses.
- Frontend: 13 Playwright tests passed; typecheck, ESLint, formatting and production build passed.
- All eight responsive widths covered. Runtime test reported no hydration/browser errors. Screenshot automation was adjusted to avoid its caret-style mutation during hydration; no frontend hydration suppression was added.
- Git ignore matching checked against both real credential files. Secret-value scan across frontend sources and generated browser assets: zero matches. No credentials printed.

## Atlas verification — successful retry

After the user updated Atlas Network Access, the existing backend connection succeeded with no URI, TLS or application-architecture change. MONGODB_URI and MONGODB_DB_NAME are loaded by the backend; the selected application database is easy_shop. No surrounding quote or whitespace problem, malformed credential encoding, or active DATABASE_URL was found.

Verified SRV resolution (three servers), certificate-authorized TLS 1.3, Atlas authentication, CRUD, index creation/listing, transaction commit and intentional rollback, connection reuse and clean shutdown. The temporary verification collection in easy_shop was removed. Runtime: Node v25.2.1, OpenSSL 3.5.4, MongoDB driver 7.7.0.

All 36 API checks passed against real Atlas over HTTP with VERIFY_HTTP=1, including concurrent uniqueness, rollback, reconnect and tenant data isolation assertions. The uniquely named test database was dropped afterward. No local replica set was used for this verification. Atlas rejected the previous 47-character generated test database name (code 8000); the test harness now uses a 35-character name. Production database configuration is unchanged.

The original TLS failure was most likely related to the prior Atlas IP access restriction, based on success immediately after that change; historical server-side logs were not available to prove the cause. No insecure TLS options were used.

Remaining configuration work: the current database user reports atlasAdmin, which is broader than needed. Replace it with an application-scoped role such as readWrite on easy_shop, and separately scoped test-database access where needed. Replace temporary 0.0.0.0/0 access with approved development/deployment egress IP ranges before production. No Atlas permissions or network rules were changed by this verification.

## Remaining upstream limitations

- Authentication is absent in this branch; onboarding administration is not production-secured.
- Storefront listing lacks slugs, and optional onboarding product image/variant inputs are not persisted by the original contract implementation.
- npm audit reports two existing Swagger UI/static dependency advisories (one high, one moderate). No forced major-version upgrade was made during the persistence migration.
- No historical PostgreSQL dataset was supplied, so this is a code/schema migration, not a completed data transfer.

See README.md for setup, docs/mongodb-migration.md for table/collection mappings, and docs/environment-audit.md for current and future credential requirements.
