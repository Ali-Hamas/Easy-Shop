import { buildApp } from "./app.js";
import { config } from "./shared/config.js";
import { connectDb, closeDb } from "./shared/db.js";
import { ensureIndexes } from "./shared/models.js";
const app = await buildApp();
app.addHook("onClose", async () => {
  await closeDb();
});
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  try {
    await app.close();
  } catch {
    process.exitCode = 1;
  }
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
try {
  await ensureIndexes(await connectDb());
  await app.listen({ host: config.host, port: config.port });
} catch {
  app.log.error(
    "Backend startup failed. Check MongoDB configuration, access and indexes.",
  );
  await shutdown();
  process.exitCode = 1;
}
