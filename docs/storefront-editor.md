# Storefront content editor

Open **Website → Store Design** in the seller dashboard for the selected shop. The editor saves real shop content to MongoDB through the authenticated backend. Choose from Atelier, Bloom, Circuit, Gather and Forma in Themes. Branding provides approved colors, font sets, logo and a public display name. Sections controls visibility and safe ordering; the footer stays last.

- Brand & cover: announcement, headline, description, logo and cover.
- Products & collections: up to eight featured products and six named collections, selected from the shop's real catalog.
- Our story: heading, story and optional image.
- Contact & policies: public contact details, social links and seller-written delivery, payment and returns information.
- Product contact buttons (within Contact & policies): WhatsApp business number, Messenger `m.me` link and a seller-written buyer message (500 words maximum). Supports product/shop placeholders. Save draft first, then publish when ready; details are in [Product contact](product-contact.md).
- FAQs: up to eight question/answer pairs.

Choosing **Use this theme** saves a draft. **Save draft** also persists pending content without changing the public store. Desktop/mobile Preview renders the saved draft with the real catalog; checkout is disabled. **Save storefront** publishes design content for an unlaunched shop; finish existing shop setup to launch. **Publish changes** applies the draft to an already launched storefront. Anonymous visitors only receive published content. Theme changes never duplicate or delete products. Policy copy does not modify shipping charges, payment methods or order behavior.

Optional empty sections stay hidden. No reviews, guarantees or store facts are fabricated. Product selections are validated against the current shop. Archived/unavailable selections require correction. Existing stores without content receive an intentional catalog layout and can add their content from Website.

Images accept HTTPS/HTTP URLs or PNG/JPEG/WebP uploads up to 1 MB each. Uploaded images are currently stored as validated image data in shop content; there is no external media storage integration. The full editor request is limited to 5 MB.

Saves use a version check to prevent silently overwriting changes made in another tab. Failed saves retain edits. Reload saved content explicitly discards local changes after confirmation. Browser refresh/close warns about unsaved edits.

Only an authenticated owner can edit or preview an unpublished shop. Public responses expose the validated content DTO, not arbitrary internal storefront configuration.

Verification: `npm --prefix backend run test:storefront-editor` uses a disposable Atlas database. Browser coverage is in `tests/storefront-editor.spec.ts` and must run against the isolated backend provided by `scripts/verify-editor-backend.mjs`, with the frontend's BACKEND_API_URL set to http://127.0.0.1:4002. Send `stop` to the helper to clean its generated database.
