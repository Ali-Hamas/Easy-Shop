import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/api/commerce/[...path]/route.ts", import.meta.url), "utf8");
const permitted = source.slice(source.indexOf("function permitted"), source.indexOf("async function forward"));

assert(!permitted.includes("new RegExp"));
assert(permitted.includes("inboxDraftActionPath.test(path)"));
assert(permitted.includes("publicPostPath.test(path)"));

console.log("API proxy allow-list regression checks passed.");
