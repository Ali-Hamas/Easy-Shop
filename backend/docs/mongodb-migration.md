# MongoDB persistence migration

Source: onboarding-backend, commit 7e72bbe9ae56ab8b41cbce2459dbfb400398dbb5. The untouched upstream clone remains in ../.backend-source.

## Schema map (reviewed before implementation)

| SQL table | MongoDB collection | Relationships / indexes |
| --- | --- | --- |
| users | users | UUID _id; optional unique email and phone |
| shops | shops | UUID _id; ownerId -> users; unique normalized subdomain; ownerId/createdAt |
| shop_staff | shopStaff | UUID _id; shopId/userId unique membership |
| products | products | UUID _id; shopId/slug unique; shopId/status/createdAt |
| product_variants | productVariants | UUID _id; shopId/productId; optional unique shopId/sku |
| asset_objects | assetObjects | UUID _id; unique storageDriver/bucket/objectKey |
| product_images | productImages | UUID _id; shopId/productId/sortOrder; assetId -> assetObjects |
| inventory_ledger | inventoryLedger | UUID _id; shopId/variantId/createdAt; append-only stock deltas |
| audit_events | auditEvents | UUID _id; shopId/createdAt; append-only action records |
| shop_channels | shopChannels | UUID _id; unique shopId/provider |

Embedded bounded objects: shop policyDefaults and storefrontConfig. Templates remain the existing static catalog. All public IDs stay UUID strings; MongoDB _id never leaks into responses. Timestamps are ISO strings, matching existing API serialization. Prices use BSON Decimal128 and serialize to JSON numbers, preserving the existing numeric API.

Writes touching shop, product, stock or audit records run sequentially in MongoDB transactions. Atlas/replica-set support is required. Every mutation writes the shop document, serializing launch against concurrent draft edits. No foreign-key or cascade-delete API is invented. There is no existing PostgreSQL data export supplied: this migrates code/schema, not historical records. SQL is retained only as reference.
