# AI Vision Lab API

Purpose: Authenticated owner-only test bench for catalog image embeddings, buyer-image matching and grounded reply generation. Prefix `/api/v1/test-lab`.

| Method | Path | Input |
|---|---|---|
| GET | /ui | Browser test bench |
| GET | /status | Current owner's launched shop and vectorized image count |
| POST | /products | Product name, price, stock, description and `data:image/...;base64` image |
| POST | /chat | Optional text and buyer `data:image/...;base64` image |

Flow: Product images are embedded with Gemini `gemini-embedding-2` and stored per shop/product/image in MongoDB. Buyer images use the same embedding model, cosine-search the shop catalog, then use Gemini vision for ambiguous matches. Groq receives only the matched product facts and writes the reply.

Safety: Requires owner session. Keys stay in backend environment. No automatic send occurs. Low-confidence or unmatched images produce no product match.

Auth: HttpOnly owner session. The owner must have a launched shop.

Request: JSON. Product images and buyer images use data URLs. Maximum request body follows backend image limits.

Response: Status, vectorized product count, product save result, or grounded reply with matched product and visual confidence.

Side effects: Product saves create normal inventory records and asynchronously create image embeddings. Chat creates no customer message or order.

Audit/timeline: Test requests do not write inbox messages, customer events or outbound sends.

Cache: no-store.

Errors: 401 AUTH_REQUIRED; 400 validation or no launched shop; 502 provider/download failures are returned as test errors.

Limitations: Test bench uses the first launched shop owned by the current user. It is for staging validation, not customer-facing traffic.
