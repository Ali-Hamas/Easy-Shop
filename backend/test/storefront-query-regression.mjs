import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/modules/storefront/storefront.routes.ts", import.meta.url),
  "utf8",
);
const catalogRoute = source.slice(
  source.indexOf('app.get("/:subdomain"'),
  source.indexOf('app.get("/:subdomain/products/:slug"'),
);

assert(catalogRoute.includes("const [variants, imgDocs] = await Promise.all"));
assert(catalogRoute.includes('collection<{ _id: string; shopId: string; onHand: number; reserved: number }>("inventoryBalances")'));
assert(!catalogRoute.includes("for (const p of documents)"));
assert(source.includes("STOREFRONT_CACHE_TTL_MS = 15_000"));
assert(catalogRoute.includes('"public, max-age=15, stale-while-revalidate=45"'));

console.log("Storefront bulk-query regression checks passed.");
