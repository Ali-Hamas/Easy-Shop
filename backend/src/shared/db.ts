import { MongoClient, MongoError, type Db, type ClientSession } from "mongodb";
import { config } from "./config.js";
export class DatabaseUnavailable extends Error {
  constructor() {
    super("Database temporarily unavailable.");
  }
}
const globalState = globalThis as typeof globalThis & {
  easyShopMongo?: { client?: MongoClient; ready?: Promise<Db> };
};
const state = (globalState.easyShopMongo ??= {});
export async function connectDb(): Promise<Db> {
  if (!state.ready) {
    state.ready = (async () => {
      if (!config.mongoUri) throw new DatabaseUnavailable();
      const client = new MongoClient(config.mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 0,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 10000,
        waitQueueTimeoutMS: 5000,
      });
      state.client = client;
      try {
        await client.connect();
        const db = client.db(config.mongoDatabase);
        await db.command({ ping: 1 });
        return db;
      } catch {
        await client.close().catch(() => undefined);
        state.client = undefined;
        throw new DatabaseUnavailable();
      }
    })().catch(() => {
      state.ready = undefined;
      throw new DatabaseUnavailable();
    });
  }
  return state.ready;
}
export async function transaction<T>(
  run: (db: Db, session: ClientSession) => Promise<T>,
): Promise<T> {
  const db = await connectDb();
  const session = state.client!.startSession();
  try {
    return await session.withTransaction(() => run(db, session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      maxCommitTimeMS: 10000,
      timeoutMS: 15000,
    });
  } finally {
    await session.endSession();
  }
}
export async function closeDb() {
  const client = state.client;
  state.ready = undefined;
  state.client = undefined;
  await client?.close();
}
export function isDatabaseError(error: unknown) {
  return error instanceof MongoError || error instanceof DatabaseUnavailable;
}
export async function databaseReady() {
  try {
    const db = await connectDb();
    await db.command({ ping: 1 }, { timeoutMS: 3000 });
    return true;
  } catch {
    return false;
  }
}
