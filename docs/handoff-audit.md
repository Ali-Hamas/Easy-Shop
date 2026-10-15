# Handoff audit — in progress

The latest handoff request supersedes the earlier development-only scope. Do not treat previous phase reports as verification of the expanded scope.

## Confirmed findings before implementation

* Critical: authentication service returns an unavailable placeholder; workspace routes have no authenticated boundary.
* Critical: onboarding accepts an email and can attach a shop to that existing user without proving ownership.
* High: Inventory, Customers and Inbox use local-development guards instead of authenticated shop authorization.
* High: AI Send records a database message without a customer delivery transport. User selected **Easy Shop storefront messaging** as the required delivery path.
* High: onboarding owner serialization must use an explicit allowlist before adding password hashes.
* High: AI retrieval treats Decimal128 prices as numbers and ignores legacy stock ledgers; this can misstate product facts.
* High: rule and OpenAI context invent delivery times. Remove unsupported promises.
* High: draft review lacks a revision/staleness guard; Inbox selection and swallowed save errors can lose edits or target stale content.
* Medium: public website and dashboard require a fresh visual and responsive review; historical screenshots are not current acceptance evidence.

The current AI Reply/provider module is additional work relative to the earlier foundation. Exact authorship cannot be established from the working files alone. Original repository history remains under `.backend-source`; it will not be overwritten.

## Completion gate

Authentication, owned onboarding, storefront conversation delivery, grounded reviewed replies, existing commerce modules, visual redesign and current end-to-end verification must all pass before declaring the assigned scope complete. Delivery, Payments, Growth, Ads and advanced analytics remain postponed.
