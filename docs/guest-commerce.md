# Guest commerce and reviews

**Current UI release (14 October 2026): ordering is temporarily hidden.** `config/commerce-ui.ts` sets `orders: false`. Storefront bag, quantity/purchase controls, checkout, tracking, the tracking editor option and seller Orders navigation are not rendered. The direct seller Orders page redirects to Dashboard. Existing order data and backend APIs are retained; the workflows below describe the preserved implementation, not currently available UI. Verified reviews remain available for existing eligible orders.

Buyers browse a published shop, view products, choose available variants, use their bag and check out without a buyer login or dashboard. Seller authentication, onboarding, inventory, customer records, AI Reply and MongoDB remain the existing systems.

## Buyer journey

1. Open the seller's `/store/:subdomain` storefront. Its selected published theme presents the same real catalog and store content.
2. View a product's real gallery, description, price, variants and availability. Add a selected variant to the bag; edit quantities or remove items.
3. Check out as a guest with name, phone, city/district and delivery address. Checkout currently supports cash on delivery only when the shop enables it. The server checks current product/variant availability, prices and delivery charge.
4. A successful checkout creates an order **awaiting seller confirmation**. No payment is collected and checkout itself does not reserve stock.
5. Save the downloadable receipt. It contains the order reference and a private receipt key. The current browser tab also retains the latest receipt credentials in session storage for review entry; this is not an account or durable recovery service.
6. Track an order with its reference and matching checkout phone. Tracking exposes only a limited order/status view, not the buyer's address or other private details. Matching a phone is not an SMS/OTP ownership check.

The bag is scoped to the shop in browser storage. Quantities are capped at 99 per line and at most 30 selections are retained. Current catalog prices and variant names replace saved display values when the catalog loads. The backend remains authoritative and checks stock and totals again at checkout.

## Seller fulfillment

The authenticated **Orders** area lists the latest 100 orders. The seller confirms availability and delivery arrangements, then moves the order through:

`Awaiting confirmation → Confirmed → Packed → Shipped → Delivered`

Confirmation reserves inventory through the existing stock system. Cancelling a new order has no inventory effect; cancelling a confirmed or packed order releases its reservation. Delivery records the sale. Status and inventory updates run in one transaction. The seller cannot cancel after shipment or change a terminal order through this minimal workflow.

These are manual seller status updates. No courier, payment processor or SMS provider is connected by this phase.

## Real product and store reviews

The storefront has separate store reviews and product reviews. Ratings, totals and distribution come only from stored reviews; an empty review list shows no invented average or testimonial.

A review requires all of:

- A real order for this shop that is marked delivered.
- Its order reference and matching normalized checkout phone.
- Possession of the private receipt key generated at checkout.
- For a product review, that product must be included in the delivered order.

Each delivered order can review the store once and each purchased product once. Exact retries are safe; an attempt to replace an existing review conflicts. The public display name, rating and review text are published immediately, and the form explains that these fields are public. Private order credentials are never included in public review responses.

“Verified purchase” means checked against the platform's delivered order and private receipt credentials. Delivery is entered by the seller; it is not independently verified by a courier/payment service. Phone ownership is not independently verified. Lost receipt keys cannot currently be recovered.

In the authenticated **Reviews** area, the seller can filter store/product/unanswered reviews and publish or update a public reply. Sellers cannot edit buyer ratings or delete critical reviews through this area. Lists show the latest 100 reviews; the public review list is paginated in groups of six. There is no separate moderation, review editing, photo review or buyer account system in this phase.

## Store Design themes

Store Design at `/website` controls presentation independently from products, orders and reviews. Five prebuilt themes share the same commerce data:

| Theme | Direction |
| --- | --- |
| Atelier | Fashion and lifestyle, editorial imagery and portrait products |
| Bloom | Beauty and cosmetics, centered brand story and soft framing |
| Circuit | Electronics and gadgets, structured catalog and purchase detail |
| Gather | Food and restaurant, menu-inspired browsing and mobile ordering |
| Forma | General commerce, flexible collections and responsive product grid |

The editor supports approved color/font presets, brand and homepage copy, selected real products/collections, safe section visibility/order, and desktop/mobile previews. A saved design draft is separate from published content. Publishing updates the shop's presentation and selected theme; it never copies, deletes or duplicates catalog items. See [storefront-editor.md](storefront-editor.md) for limits and publication rules.

## Implementation reference

- API contracts: [orders](../backend/docs/api/orders.md), [reviews and storefront](../backend/docs/api/storefront.md), [Store Design persistence](../backend/docs/api/onboarding.md).
- Backend coverage: `backend/test/storefront-reviews.integration.mjs` uses a generated isolated MongoDB database and cleans it in `finally`. Build the backend first, then run it from `backend`; it must not target a seller's normal database.
- End-to-end browser tests should use the isolated verification backend. Do not seed demonstration products, reviews or order delivery states into real seller shops.
