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

console.log("Storefront bulk-query regression checks passed.");
