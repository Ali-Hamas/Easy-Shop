# Settings and Reviews — 15 October 2026

Settings now replaces the foundation placeholder with editable shop name, category, business address and language using the existing authenticated shop-update endpoint. Country, currency and store address are displayed as context. Account name and email come from the authenticated session. Team, billing and advanced security are explicitly left for a future release; no controls or account states are fabricated.

The prominent **WhatsApp & Messenger messages** shortcut opens `/website?section=contact` at **Homepage → Contact & policies**. Store Design also has a **Contact buttons** shortcut. The existing 500-word buyer-message editor and draft/publish workflow are unchanged.

Shop saves send only changed fields, preserve failed edits, disable duplicate submits and warn on browser close/refresh with unsaved edits. The optional business address now accepts an empty string to clear it, with the existing 200-character limit retained. The frontend uses the same limit. No authentication or database architecture changed.

Reviews now has a summary, rating distribution, search, review-type/reply filters, rating filter, sorting, empty/no-match/loading/error states and collapsible public reply editors. Metrics describe the latest 100 returned reviews, not all-time totals. A failed refresh keeps the previous list; failed replies retain the draft. Publishing updates the list and unanswered count. Buyers' reviews cannot be modified or deleted by sellers.

The empty state explains the existing delivered-order receipt verification requirement. With checkout hidden, existing eligible receipts remain usable; external WhatsApp/Messenger conversations do not automatically establish verified purchases. No verification rules were weakened and no review data was fabricated.

`tests/settings-reviews.spec.ts` uses an isolated Atlas shop for authentication and shop-setting persistence. Review examples and reply failures/success are intercepted in the browser only. It covers save failure/retry, reload persistence, optional address clearing and maximum length, direct message-editor navigation, empty and populated review layouts, combined filters, sorting, reply editing, retained failed drafts, stale-data errors, mobile overflow and accessibility. Screenshots are saved under `docs/screenshots/settings-reviews` and use test data only.
