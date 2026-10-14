import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");

assert(config.includes('source: "/uploads/products/:path*"'));
assert(config.includes("public, max-age=31536000, immutable"));

console.log("Product upload cache regression checks passed.");
