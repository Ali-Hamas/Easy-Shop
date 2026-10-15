# Backend architecture

Fastify + TypeScript modular monolith. Active modules: health, system, onboarding and public storefront. The native MongoDB Node driver owns persistence. No authentication, inventory-management, customer-management or AI-reply module was added.

shared/models.ts defines typed collections and idempotent indexes; shared/db.ts owns a single reusable pool, transaction sessions, readiness and shutdown. Multi-document writes are transactional and sequential. Every onboarding mutation writes the shop revision to serialize against launch. MongoDB unique indexes enforce subdomain and tenant product-slug uniqueness under concurrent requests. Ledger and audit records remain append-only, separate from shop documents.

Public APIs use UUID strings and ISO timestamps; BSON Decimal128 prices serialize as numbers. Zod remains the API validation boundary. Errors are sanitized centrally; raw driver errors/URIs are not logged or returned. See mongodb-migration.md for the complete schema map. No historical PostgreSQL data import was attempted because no source data was provided.
