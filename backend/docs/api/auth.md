# Account and session API

Purpose: Minimal merchant registration, login, logout and current-account access.

Auth: Opaque 256-bit `easy_shop_session` cookie; HttpOnly, SameSite=Lax, seven-day expiry and Secure when APP_ORIGIN is HTTPS. Only the SHA-256 token digest is stored. Passwords use salted scrypt (N=32768, r=8, p=1). Production must use HTTPS and the exact public APP_ORIGIN in both services. The Next bridge forwards cookies server-to-server; no session token is returned in JSON or browser storage.

Request:

| Method | Path | Body |
| --- | --- | --- |
| POST | /api/v1/auth/register | name (2–100), email, password (12–128) |
| POST | /api/v1/auth/login | email, password |
| POST | /api/v1/auth/logout | {} |
| GET | /api/v1/auth/me | none |

Response: Registration/login return `{ user: { id, name, email } }` and Set-Cookie. `me` includes the user's owned shops. Logout expires the cookie and revokes the stored session. No password hash or raw token is serialized.

Side effects: Registration and session creation commit atomically. Login rotates the current session. Expired sessions are denied immediately, independently of TTL cleanup. All protected module requests validate both the session and shop ownership. Mutation requests require the configured Origin. Login and registration are limited to ten requests per IP per fifteen minutes.

Audit/timeline: Authenticated module actions use the server-resolved owner ID. Authentication does not add customer timeline entries or log credentials.

Cache: no-store.

Errors: 400 VALIDATION_ERROR, 401 INVALID_CREDENTIALS/AUTH_REQUIRED, 403 ORIGIN_REJECTED, 409 ACCOUNT_EXISTS, 429 rate limit, 503 DATABASE_UNAVAILABLE. Existing development-only users without a password are not automatically claimed by email. Any legacy-data reassignment needs a separate verified migration. Password reset, email verification and multi-staff IAM are not implemented.
