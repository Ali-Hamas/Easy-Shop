# AI Reply Automation & Inbox API

Purpose: Provide a human-in-the-loop social messaging inbox and grounded AI reply assistance for commerce conversations. Allows merchants to receive customer inquiries, retrieve relevant customer and product/inventory facts, generate deterministic stock-grounded reply drafts with explicit rationale, edit drafts, approve/reject drafts, and explicitly send approved replies to conversation threads. Excludes external Meta/Instagram/WhatsApp webhook ingestion and automated unapproved external transmission.

Auth: Requires an HttpOnly merchant session and server-side shop ownership validation. Mutations require the configured Origin. See auth.md. Account IDs are resolved by the server; production is supported.

Request: Prefix `/api/v1/inbox`. UUID shop, customer, conversation, message, and draft IDs. Strict Zod validation on all input bodies and query parameters. Supported channels: `messenger`, `instagram`, `storefront`. WhatsApp and future channels remain reserved in data modeling but unexposed in this phase.

| Method | Path | Body / Query | Description |
| --- | --- | --- | --- |
| GET | /:shopId/conversations | `q`, `channel`, `status`, `aiStatus`, `page`, `limit` | List conversations with search and filter tokens |
| POST | /:shopId/conversations | `{ requestId, customerId, channel, title? }` | Initialize or find existing conversation for customer |
| GET | /:shopId/conversations/:conversationId | — | Retrieve single conversation details |
| GET | /:shopId/conversations/:conversationId/messages | `limit?` (default 50) | Retrieve conversation message history (chronological) |
| POST | /:shopId/conversations/:conversationId/messages | `{ requestId, sender, text, channel? }` | Append customer message or manual staff reply |
| POST | /:shopId/conversations/:conversationId/drafts | `{ requestId, triggerMessageId?, languageHint? }` | Context retrieval & AI reply draft generation |
| GET | /:shopId/conversations/:conversationId/drafts | — | Get active draft and history for conversation |
| PATCH | /:shopId/conversations/:conversationId/drafts/:draftId | `{ requestId, text }` | Edit draft text (transitions state to `edited`) |
| POST | /:shopId/conversations/:conversationId/drafts/:draftId/review | `{ requestId, action: "approve" \| "reject", reason? }` | Approve or reject draft (SEPARATE from send) |
| POST | /:shopId/conversations/:conversationId/drafts/:draftId/send | `{ requestId }` | Explicitly send an approved draft as outgoing reply |

Response:
- Conversation: id, shopId, customerId, channel, status (`open`, `pending`, `closed`), aiStatus (`idle`, `generating`, `draft_ready`, `review_needed`, `replied`), unreadCount, lastMessage, lastActivityAt, createdAt, updatedAt.
- Message: id, shopId, conversationId, customerId, sender (`customer`, `staff`), text, source (`incoming`, `staff_manual`, `staff_approved_ai`), draftId, createdAt.
- AiDraft: id, shopId, conversationId, customerId, originalText, editedText, confidence (`high`, `review`, `missing`), groundingSummary (user-facing explanation, never chain-of-thought), needsHumanAttention, escalationReason, contextSources (types: `customer`, `product`, `inventory`, `staff_note`, `policy`), status (`ready`, `edited`, `approved`, `rejected`, `sending`, `sent`, `send_failed`), reviewedBy, reviewedAt, sentAt, createdAt, updatedAt.
- Strict zero-fabrication: Never fabricates order totals, lifetime value, or courier promises.

Side effects:
- Multi-collection MongoDB atomic transactions ensure conversation updates, message appending, draft state transitions, audit logging, and customer timeline synchronization commit or abort together.
- Product retrieval extracts keywords from customer inquiries and queries only matching active products; does not inject the entire catalog.
- Separate approval and send: Approval marks draft as `approved`. Sending checks `status === "approved"` and rejects unapproved/rejected/draft_ready drafts with 400 DRAFT_NOT_APPROVED. If simulated internal send fails, draft transitions to `send_failed` while retaining approval for safe retry.
- Manual staff messages and approved AI sends automatically append `conversation` timeline events to `customerEvents` referencing the conversation.
- Request idempotency: All mutating endpoints enforce `requestId` idempotency with SHA-256 fingerprint verification, preventing double drafts or duplicate messages.

Audit/timeline:
- Emits structured audit events into `auditEvents`: `inbox.conversation_created`, `inbox.message_appended`, `inbox.draft_generated`, `inbox.draft_edited`, `inbox.draft_reviewed`, `inbox.reply_sent`.
- Writes customer timeline events into `customerEvents` with `type: "conversation"`, keeping Customer CRM and Inbox synchronously connected.

Indexes:
- `conversations`: `(shopId, lastActivityAt desc)`, `(shopId, status, lastActivityAt desc)`, `(shopId, customerId)`, unique `(shopId, requestId)`.
- `messages`: `(shopId, conversationId, createdAt asc)`, unique `(shopId, requestId)`.
- `aiDrafts`: `(shopId, conversationId, createdAt desc)`, `(shopId, status)`, unique `(shopId, requestId)`.

Cache: `no-store, no-cache, must-revalidate` on all API endpoints and Next.js bridge routes.

Errors:
- 400 `VALIDATION_ERROR`: Malformed input or schema violation.
- 400 `DRAFT_NOT_APPROVED`: Attempting to send a draft that is not in `approved` state.
- 400 `INVALID_TRANSITION`: Attempting an invalid draft state transition.
- 404 `SHOP_NOT_FOUND`, `CONVERSATION_NOT_FOUND`, `DRAFT_NOT_FOUND`, `CUSTOMER_NOT_FOUND`.
- 409 `IDEMPOTENCY_CONFLICT`: Reused requestId with different payload.
- 503 `AUTH_REQUIRED`: Non-loopback or production access without enterprise auth.
- 503 `DATABASE_UNAVAILABLE`: MongoDB failure or connection loss.


## Current handoff corrections (supersedes legacy contract descriptions above)

- Conversation states are `open`, `needs_attention`, `resolved`. AI states are `idle`, `generating`, `draft_ready`, `approved`, `rejected`, `sent`, `needs_human`.
- Merchant message POST accepts only sender `staff`. Real incoming messages use the private storefront capability API. External channel sends return 409 CHANNEL_UNAVAILABLE; no fake delivery success.
- Draft editing requires `{ editedText, version }`; approval requires `{ requestId, version }`. Approval is separate from send. A changed revision returns VERSION_CONFLICT. A newer incoming message or changed product/stock facts returns DRAFT_STALE and requires fresh review.
- Actual provider is recorded as `openai` or `fallback`. The backend uses the configured OPENAI_MODEL, strict JSON Schema output, local validation, an eight-second timeout covering headers and body, and fixed safe failure reason codes. No raw provider errors, prompts, keys or bodies are logged. Missing configuration, refusal, truncation, invalid output, 429 and other failures use a conservative clearly marked fallback requiring review.
- Product prices and availability come from the same inventory reader used by the workspace, including Decimal128 conversion and legacy ledger balances. No hardcoded delivery promises or restock notifications are supplied.
- Customer and staff notes are visible to the merchant. Private staff notes and contact details are not sent to the model. Only a customer name/language, recent conversation and relevant products are included.
- Replay-safe sends commit the message, draft state, customer activity, timeline and audit together. The storefront buyer can then read the outgoing message through their scoped chat endpoint.

Structured output reference: https://developers.openai.com/api/docs/guides/structured-outputs
