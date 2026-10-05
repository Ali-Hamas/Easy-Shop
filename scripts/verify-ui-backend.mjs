import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { loadEnvFile } from "../backend/dist/shared/load-env.js";
loadEnvFile("backend/.env");
const database = `easy_shop_ui_verify_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
process.env.MONGODB_DB_NAME = database;
process.env.LOG_LEVEL = "silent";
const { buildApp } = await import("../backend/dist/app.js");
const { connectDb, closeDb } = await import("../backend/dist/shared/db.js");
const { ensureIndexes } = await import("../backend/dist/shared/models.js");
const db = await connectDb();
await ensureIndexes(db);
const app = await buildApp();
await app.listen({ port: 4000, host: "127.0.0.1" });
console.log(
  "Isolated Atlas verification backend ready on port 4000. Type stop to remove only its generated test database.",
);
let stopped = false;
async function stop() {
  if (stopped) return;
  stopped = true;
  await app.close();
  if (
    !database.startsWith("easy_shop_ui_verify_") ||
    db.databaseName !== database
  )
    throw Error("Cleanup scope mismatch");
  await db.dropDatabase();
  await closeDb();
  console.log("Isolated verification database removed.");
  process.exit(0);
}
createInterface({ input: process.stdin }).on("line", (line) => {
  if (line.trim() === "stop") void stop();
});
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
