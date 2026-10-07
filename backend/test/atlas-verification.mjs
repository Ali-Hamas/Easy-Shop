import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveSrv } from "node:dns/promises";
import tls from "node:tls";
import { randomUUID } from "node:crypto";
import { config } from "../dist/shared/config.js";
import { connectDb, closeDb, transaction } from "../dist/shared/db.js";
const report = {};
let collection;
try {
  const raw = readFileSync(process.env.BACKEND_ENV_FILE ?? ".env", "utf8");
  const uri = config.mongoUri;
  const url = new URL(uri);
  const auth = uri.slice(uri.indexOf("://") + 3, uri.lastIndexOf("@"));
  const password = auth.slice(auth.indexOf(":") + 1);
  let valid = true;
  try {
    decodeURIComponent(password);
  } catch {
    valid = false;
  }
  report.environment = {
    uriExists: !!uri,
    databaseVariableExists: !!process.env.MONGODB_DB_NAME,
    loadedByBackend: uri === process.env.MONGODB_URI,
    database: config.mongoDatabase,
    srvScheme: url.protocol === "mongodb+srv:",
    quotesRemain: /^["']|["']$/.test(uri),
    whitespace: /\s/.test(uri),
    usernamePresent: !!url.username,
    passwordPresent: !!url.password,
    credentialEncodingValid: valid && !/[@:/?#]/.test(password),
    postgresVariablePresent: !!process.env.DATABASE_URL,
    uriVariableOccurrences: (raw.match(/^MONGODB_URI=/gm) ?? []).length,
    insecureTlsEnvironment: process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0",
    node: process.version,
    openssl: process.versions.openssl,
    driver: JSON.parse(
      readFileSync("node_modules/mongodb/package.json", "utf8"),
    ).version,
  };
  assert.equal(report.environment.srvScheme, true);
  assert.equal(report.environment.insecureTlsEnvironment, false);
  assert.equal(report.environment.credentialEncodingValid, true);
  const records = await resolveSrv(`_mongodb._tcp.${url.hostname}`);
  report.dns = { srvResolved: records.length > 0, serverCount: records.length };
  report.tls = await new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: records[0].name,
        port: records[0].port,
        servername: records[0].name,
        rejectUnauthorized: true,
      },
      () => {
        resolve({
          authorized: socket.authorized,
          protocol: socket.getProtocol(),
        });
        socket.end();
      },
    );
    socket.setTimeout(10000, () => {
      socket.destroy();
      reject(new Error("TLS_TIMEOUT"));
    });
    socket.on("error", reject);
  });
  const db = await connectDb();
  report.connection = {
    connected: true,
    selectedDatabase: db.databaseName,
    reused: (await connectDb()) === db,
  };
  const status = await db.command({
    connectionStatus: 1,
    showPrivileges: true,
  });
  report.authentication = {
    authenticated: status.authInfo.authenticatedUsers.length > 0,
    roleNames: status.authInfo.authenticatedUserRoles.map((r) => r.role),
  };
  const name = `atlas_verification_${randomUUID().replaceAll("-", "")}`;
  collection = db.collection(name);
  await collection.insertOne({ _id: "probe", value: 1 });
  assert.equal((await collection.findOne({ _id: "probe" })).value, 1);
  await collection.updateOne({ _id: "probe" }, { $set: { value: 2 } });
  assert.equal((await collection.findOne({ _id: "probe" })).value, 2);
  await collection.createIndex({ value: 1 });
  assert.ok((await collection.listIndexes().toArray()).length >= 2);
  await transaction(async (database, session) => {
    await database
      .collection(name)
      .insertOne({ _id: "committed", value: 3 }, { session });
  });
  assert.ok(await collection.findOne({ _id: "committed" }));
  try {
    await transaction(async (database, session) => {
      await database
        .collection(name)
        .insertOne({ _id: "rolled-back", value: 4 }, { session });
      throw new Error("INTENTIONAL_ROLLBACK");
    });
  } catch (e) {
    assert.equal(e.message, "INTENTIONAL_ROLLBACK");
  }
  assert.equal(await collection.findOne({ _id: "rolled-back" }), null);
  await collection.deleteOne({ _id: "probe" });
  assert.equal(await collection.findOne({ _id: "probe" }), null);
  report.operations = {
    read: true,
    write: true,
    update: true,
    delete: true,
    indexCreateAndList: true,
    transactionCommit: true,
    transactionRollback: true,
  };
} catch (error) {
  report.failure = {
    type: error.name,
    code: typeof error.code === "number" ? error.code : undefined,
  };
  process.exitCode = 1;
} finally {
  if (collection) {
    try {
      await collection.drop();
      report.cleanup = true;
    } catch {
      report.cleanup = false;
      process.exitCode = 1;
    }
  }
  await closeDb();
  report.shutdown = true;
  console.log(JSON.stringify(report, null, 2));
}
