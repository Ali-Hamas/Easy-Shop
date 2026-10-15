# Product contact through WhatsApp and Messenger

In **Website → Homepage → Contact & policies → Product contact buttons**, the seller can enter a WhatsApp business number, an HTTPS `m.me` page link and a buyer-message template. The message is limited to 500 whitespace-separated words, validated in the editor and backend. The editor retains over-limit text for correction; it does not silently truncate it. A message is required when either channel is configured. Blank channels remain hidden.

Supported placeholders: `{shop_name}`, `{product_name}`, `{product_price}`, `{product_url}` and `{variant}`. Product prices and options come from the selected product. The public product URL omits owner-preview parameters. Placeholder expansion happens once and all content is rendered as plain text. The 500-word limit applies to the seller's template before expansion.

Settings use the existing owner-authorized, versioned draft and publish flow and MongoDB storage. Older stores default to empty settings. Nothing is automatically published or sent.

WhatsApp uses the documented `https://wa.me/<international-number>?text=<encoded-message>` format. The buyer reviews and sends the draft in WhatsApp. See [WhatsApp's click-to-chat documentation](https://faq.whatsapp.com/5913398998672934).

Messenger opens a themed, keyboard-accessible dialog and attempts to copy the message. Success is shown only after the clipboard promise resolves. If access is denied or unavailable, the message remains selectable and the dialog explains manual copying. **Open Messenger** opens the configured page chat in a new tab; the buyer pastes and sends the message. There is no unsupported text-prefill parameter, automatic send, or automatic external navigation.

Both buttons appear in product details and the single-product homepage spotlight. They inherit each storefront theme. Cart, checkout and tracking remain hidden under the existing release setting. Existing Easy Shop chat and review functionality are preserved.

Validation coverage: `tests/product-contact.spec.ts` uses browser-only fixtures across all five themes for special characters, selected variants, destinations, clipboard success/failure, mobile overflow, accessibility, focus restoration, missing settings and absence of write requests. `backend/test/storefront-editor.integration.mjs` verifies ownership, invalid destinations, 500/501-word boundaries, draft privacy and published persistence in an isolated Atlas database. The editor UI journey additionally checks the over-limit validation state.

Verified 14 October 2026: 74 isolated Atlas checks, the seller editor browser journey, and all five contact-flow browser tests passed. TypeScript, scoped ESLint, backend compilation and the frontend production build passed. Contact-flow tests were completed against the production build after the development server emitted intermittent internal router/hydration warnings. The tests inspect link destinations and use simulated clipboard success/denial; they do not send messages or verify a seller’s external account.
