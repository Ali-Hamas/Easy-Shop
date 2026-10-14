import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/modules/ai-replies/ai-replies.service.ts", import.meta.url),
  "utf8",
);
const sendMetaReply = source.slice(source.indexOf("async function sendMetaReply"), source.indexOf("async function syncMetaConversations"));

assert(!sendMetaReply.includes("fetchWithRetry"), "Meta message sends must not retry non-idempotent POSTs.");
assert(sendMetaReply.includes("response = await fetch("), "Meta message sends must use one request.");
assert(sendMetaReply.includes("AbortSignal.timeout(12000)"), "Meta message sends must still time out.");

console.log("Meta send regression checks passed.");
