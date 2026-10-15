# Backend test environment

npm run check runs API documentation coverage, TypeScript, database failure tests and real MongoDB API integration tests on an isolated local replica set. No PostgreSQL or JSON persistence remains active. npm run test:atlas performs the same integration checks against Atlas using a unique test database and guaranteed cleanup attempt; an unavailable database fails the suite instead of silently skipping it.

Coverage: health/readiness/system/templates, onboarding creation, reads, shop update, normalized subdomains, unique-index races, transaction rollback, product/default variant/opening stock, Meta skip, AI mode, template selection, launch gates, template-only launch, launched-shop edit rejection, public shop and product reads, invalid IDs, missing shops/products, reconnect durability and sanitized database failure responses.
