import assert from "node:assert/strict";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1";
process.env.MONGODB_DB_NAME = "failure_test";
process.env.LOG_LEVEL = "silent";
const { buildApp } = await import("../dist/app.js");
const { closeDb } = await import("../dist/shared/db.js");
const app = await buildApp();
try {
  const live = await app.inject({ url: "/api/v1/health" });
  assert.equal(live.statusCode, 200);
  for (const url of ["/api/v1/health/ready", "/api/v1/storefront/missing"]) {
    const r = await app.inject({ url });
    assert.equal(r.statusCode, 503);
    assert.ok(!r.body.includes("mongodb://"));
    assert.ok(!r.body.includes("127.0.0.1"));
  }
  const bad = await app.inject({ url: "/api/v1/onboarding/invalid" });
  assert.equal(bad.statusCode, 401);
  console.log(
    "PASS: unavailable database, liveness, readiness, invalid ID and sanitized errors.",
  );
} finally {
  await app.close();
  await closeDb();
}
