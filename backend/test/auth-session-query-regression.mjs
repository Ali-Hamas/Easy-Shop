import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/modules/auth/auth.ts", import.meta.url), "utf8");

assert(source.includes('.aggregate<{ user: AuthenticatedUser }>(['));
assert(source.includes('from: "users"'));
assert(!source.includes('.findOne({ _id: digest(token), expiresAt: { $gt: new Date() } })'));

console.log("Auth session single-query regression checks passed.");
