import { currentActor } from "../auth/auth.js";
import { randomUUID, createHash } from "node:crypto";
import {
  MongoServerError,
  type Db,
  type ClientSession,
  type Filter,
} from "mongodb";
import { connectDb, transaction } from "../../shared/db.js";
import { publicDocument } from "../../shared/models.js";
import type { CustomerInput } from "./customers.validators.js";
export class CustomerError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
type Customer = CustomerInput & {
  _id: string;
  shopId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  requestId: string;
  fingerprint: string;
  phoneKey?: string;
};
// Future trusted module writers can append these event types. No public event-injection API.
export type CustomerEvent = {
  _id: string;
  shopId: string;
  customerId: string;
  type:
    | "customer_created"
    | "customer_updated"
    | "note"
    | "order"
    | "conversation"
    | "return"
    | "complaint";
  text: string;
  source: string;
  author: string;
  createdAt: string;
  changedFields?: string[];
  reference?: { module: string; id: string };
  requestId?: string;
  fingerprint?: string;
};
const customers = (db: Db) => db.collection<Customer>("customers");
const events = (db: Db) => db.collection<CustomerEvent>("customerEvents");
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function view(c: Customer) {
  const { _id, requestId, fingerprint, phoneKey, ...rest } = c;
  return { id: _id, ...rest, orderSummary: null, riskContext: null };
}
async function shop(db: Db, shopId: string, session?: ClientSession) {
  if (
    !(await db
      .collection<{ _id: string }>("shops")
      .findOne({ _id: shopId }, { session, projection: { _id: 1 } }))
  )
    throw new CustomerError(404, "SHOP_NOT_FOUND", "Shop not found.");
}
async function record(
  db: Db,
  shopId: string,
  id: string,
  session?: ClientSession,
) {
  const c = await customers(db).findOne({ _id: id, shopId }, { session });
  if (!c)
    throw new CustomerError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  return c;
}
function conflict(error: unknown): never {
  if (error instanceof MongoServerError && error.code === 11000)
    throw new CustomerError(
      409,
      "CUSTOMER_CONFLICT",
      "That phone number already belongs to a customer in this shop. Review the existing record; merging is not available.",
    );
  throw error;
}
async function append(db: Db, session: ClientSession, event: CustomerEvent) {
  await events(db).insertOne(event, { session });
  await db
    .collection<{
      _id: string;
      shopId: string;
      actorId: string;
      action: string;
      entityType: string;
      entityId: string;
      createdAt: string;
    }>("auditEvents")
    .insertOne(
      {
        _id: randomUUID(),
        shopId: event.shopId,
        actorId: currentActor(),
        action: `customer.${event.type}`,
        entityType: "customer",
        entityId: event.customerId,
        createdAt: event.createdAt,
      },
      { session },
    );
}
export const customerService = {
  async list(
    shopId: string,
    query: {
      q: string;
      status: string;
      source: string;
      tag: string;
      page: number;
      limit: number;
    },
  ) {
    const db = await connectDb();
    await shop(db, shopId);
    const filter: Filter<Customer> = { shopId };
    if (query.status !== "all")
      filter.status = query.status as Customer["status"];
    if (query.source !== "all")
      filter.source = query.source as Customer["source"];
    if (query.tag) filter.tags = query.tag.toLowerCase();
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = ["name", "phone", "email"].map((field) => ({
        [field]: { $regex: escaped, $options: "i" },
      }));
    }
    const [rows, total] = await Promise.all([
      customers(db)
        .find(filter)
        .sort({ lastActivityAt: -1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .toArray(),
      customers(db).countDocuments(filter),
    ]);
    return {
      customers: rows.map(view),
      total,
      page: query.page,
      limit: query.limit,
    };
  },
  async get(shopId: string, id: string) {
    return view(await record(await connectDb(), shopId, id));
  },
  async create(shopId: string, input: CustomerInput, requestId: string) {
    const fingerprint = digest(input);
    const db = await connectDb();
    const replay = async () => {
      const prior = await customers(db).findOne({ shopId, requestId });
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new CustomerError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Save reference already used.",
          );
        return view(prior);
      }
      return null;
    };
    const prior = await replay();
    if (prior) return prior;
    try {
      return await transaction(async (db, session) => {
        await shop(db, shopId, session);
        const now = new Date().toISOString();
        const row: Customer = {
          ...input,
          _id: randomUUID(),
          shopId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          lastActivityAt: now,
          requestId,
          fingerprint,
          ...(input.phone ? { phoneKey: input.phone } : {}),
        };
        await customers(db).insertOne(row, { session });
        await append(db, session, {
          _id: randomUUID(),
          shopId,
          customerId: row._id,
          type: "customer_created",
          text: "Customer record created.",
          source: "customer-management",
          author: currentActor(),
          createdAt: now,
        });
        return view(row);
      });
    } catch (error) {
      const prior = await replay();
      if (prior) return prior;
      conflict(error);
    }
  },
  async update(
    shopId: string,
    id: string,
    input: CustomerInput,
    version: number,
  ) {
    try {
      return await transaction(async (db, session) => {
        const prior = await record(db, shopId, id, session);
        if (prior.version !== version)
          throw new CustomerError(
            409,
            "VERSION_CONFLICT",
            "Customer changed. Reload before saving.",
          );
        const changedFields = Object.keys(input).filter(
          (key) =>
            JSON.stringify(input[key as keyof CustomerInput]) !==
            JSON.stringify(prior[key as keyof CustomerInput]),
        );
        if (!changedFields.length) return view(prior);
        const now = new Date().toISOString();
        const row: Customer = {
          ...prior,
          ...input,
          version: version + 1,
          updatedAt: now,
          lastActivityAt: now,
        };
        if (input.phone) row.phoneKey = input.phone;
        else delete row.phoneKey;
        const result = await customers(db).replaceOne(
          { _id: id, shopId, version },
          row,
          { session },
        );
        if (!result.modifiedCount)
          throw new CustomerError(
            409,
            "VERSION_CONFLICT",
            "Customer changed. Reload before saving.",
          );
        await append(db, session, {
          _id: randomUUID(),
          shopId,
          customerId: id,
          type: "customer_updated",
          text: "Customer details updated.",
          changedFields,
          source: "customer-management",
          author: currentActor(),
          createdAt: now,
        });
        return view(row);
      });
    } catch (error) {
      conflict(error);
    }
  },
  async history(shopId: string, id: string, page: number) {
    const db = await connectDb();
    await record(db, shopId, id);
    const filter = { shopId, customerId: id };
    const [entries, total] = await Promise.all([
      events(db)
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 30)
        .limit(30)
        .toArray(),
      events(db).countDocuments(filter),
    ]);
    return {
      entries: entries.map(({ requestId, fingerprint, ...event }) =>
        publicDocument(event),
      ),
      total,
      page,
    };
  },
  async note(shopId: string, id: string, text: string, requestId: string) {
    const db = await connectDb();
    const fingerprint = digest({ id, text });
    const replay = async () => {
      const old = await events(db).findOne({ shopId, requestId });
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new CustomerError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Note reference already used.",
          );
        return { id: old._id };
      }
      return null;
    };
    const prior = await replay();
    if (prior) return prior;
    try {
      return await transaction(async (db, session) => {
        await record(db, shopId, id, session);
        const now = new Date().toISOString(),
          eventId = randomUUID();
        await customers(db).updateOne(
          { _id: id, shopId },
          { $set: { lastActivityAt: now } },
          { session },
        );
        await append(db, session, {
          _id: eventId,
          shopId,
          customerId: id,
          type: "note",
          text,
          requestId,
          fingerprint,
          source: "staff-note",
          author: currentActor(),
          createdAt: now,
        });
        return { id: eventId };
      });
    } catch (error) {
      const prior = await replay();
      if (prior) return prior;
      conflict(error);
    }
  },
};
