import { connectDb, closeDb } from "../dist/shared/db.js";
import { ensureIndexes } from "../dist/shared/models.js";
try {
  await ensureIndexes(await connectDb());
  console.log("MongoDB indexes ready.");
} catch {
  console.error(
    "MongoDB index setup failed. Check server-side configuration and access.",
  );
  process.exitCode = 1;
} finally {
  await closeDb();
}
