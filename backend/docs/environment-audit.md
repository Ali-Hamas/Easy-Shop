# Environment and external credentials audit

No credential values are included here. Audited current backend source/config, env example, workspace credential variable names and ignore patterns.

| Variable | Use | Secret |
| --- | --- | --- |
| MONGODB_URI | Required server-only Atlas connection | Yes |
| MONGODB_DB_NAME | Database selection, default easy_shop | No |
| NODE_ENV | development / test / production | No |
| PORT | API port, default 4000 | No |
| HOST | Loopback by default; container binds 0.0.0.0 | No |
| LOG_LEVEL | Backend logging | No |
| APP_ORIGIN | Explicit allowed frontend CORS origin | No |
| BACKEND_ENV_FILE | Optional explicit server env-file path, default .env | No |

The workspace credential file contains MONGODB_URI, MONGODB_USERNAME and MONGODB_PASSWORD. The driver uses only MONGODB_URI; standalone username/password variables are not duplicated into runtime configuration. No NEXT_PUBLIC MongoDB variable is used. backend/.env is private and ignored. The root ignores both dot-prefixed env files and files ending in .env; backend/.dockerignore excludes them from build contexts. No root Git repository exists, so no claim of Git commit-history secret scanning is made. The upstream clone is untouched and contains no imported local credentials.

Current external API keys: none. Atlas database credentials are the only external service credentials used. Front Store, Inventory and Customer Management are internal API domains, not external API-key products. The latter two remain unimplemented in this branch. Authentication remains absent.

Future, only when those integrations are implemented:

- AI replies may need credentials for an explicitly selected LLM provider. None selected or hardcoded.
- Meta/Facebook and Instagram integrations may need Meta app credentials, scoped OAuth/page access tokens and a webhook verification secret, depending on the chosen Meta integration.
- WhatsApp integration may need WhatsApp Business/Meta access credentials and webhook verification, or credentials for an explicitly selected provider.
- Email/SMS delivery for future authentication may require the selected delivery provider's credentials. No provider chosen.

These are planning dependencies, not new required env variables or active integrations. No arbitrary FRONT_STORE_API_KEY, INVENTORY_API_KEY or CUSTOMER_API_KEY has been added.
