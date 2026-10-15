import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
const repl = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
  binary: { version: "8.2.6" },
});
try {
  const exit = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["test/onboarding.integration.mjs"], {
      stdio: "inherit",
      env: { ...process.env, MONGODB_URI: repl.getUri() },
    });
    child.on("error", reject);
    child.on("exit", resolve);
  });
  process.exitCode = exit ?? 1;
} finally {
  await repl.stop();
}
