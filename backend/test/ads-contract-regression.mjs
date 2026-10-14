import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [service, routes, config] = await Promise.all([
  readFile(new URL("../src/modules/ads/ads.service.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/modules/ads/ads.routes.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/shared/config.ts", import.meta.url), "utf8"),
]);

assert(service.includes('createCipheriv("aes-256-gcm"'));
assert(!service.includes("token: connection?.token"));
assert(routes.includes('app.patch("/:shopId/selection"'));
assert(routes.includes('app.post("/:shopId/insights/sync"'));
assert(config.includes("META_ADS_OAUTH_SCOPES"));
assert(config.includes("META_TOKEN_ENCRYPTION_KEY"));

console.log("Meta Ads contract regression checks passed.");
