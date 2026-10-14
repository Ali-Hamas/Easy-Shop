import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/modules/inventory/inventory.service.ts", import.meta.url),
  "utf8",
);
const list = source.slice(source.indexOf("async list("), source.indexOf("async get("));

assert(source.includes("async function details("));
assert(source.includes('productId: { $in: products.map((p) => p._id) }'));
assert(!list.includes("docs.map((p) => detail"));
assert(list.includes("await details(db, shopId, docs)"));

console.log("Inventory bulk-detail regression checks passed.");
