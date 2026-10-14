import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/modules/dashboard/dashboard.routes.ts", import.meta.url),
  "utf8",
);

assert(source.includes("DASHBOARD_CACHE_TTL_MS = 5_000"));
assert(source.includes("const cached = dashboardCache.get(shopId)"));
assert(source.includes("dashboardCache.set(shopId"));

console.log("Dashboard cache regression checks passed.");
