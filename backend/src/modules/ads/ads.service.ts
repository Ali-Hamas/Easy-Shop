import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { z } from "zod";
import { connectDb } from "../../shared/db.js";
import { config } from "../../shared/config.js";

type Connection = {
  _id: string;
  shopId: string;
  status: "disconnected" | "pending" | "connected" | "error";
  token?: string;
  tokenExpiresAt?: string;
  adAccounts: Array<{ id: string; name: string; currency?: string }>;
  pixels: Array<{ id: string; name: string }>;
  catalogs: Array<{ id: string; name: string }>;
  adAccountId?: string;
  pixelId?: string;
  catalogId?: string;
  lastSyncAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};
type OAuthState = { _id: string; shopId: string; actorId: string; expiresAt: Date };
type InsightSnapshot = {
  _id: string;
  shopId: string;
  level: string;
  dateStart: string;
  dateStop: string;
  rows: unknown[];
  syncedAt: string;
};

const accountSchema = z.object({ id: z.string(), name: z.string().default("Meta ad account"), currency: z.string().optional() });
const pixelSchema = z.object({ id: z.string(), name: z.string().default("Meta pixel") });
const catalogSchema = z.object({ id: z.string(), name: z.string().default("Meta catalog") });
const graphList = z.object({ data: z.array(z.unknown()).default([]) });

export class AdsError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}

function encryptionKey() {
  if (!config.metaTokenEncryptionKey)
    throw new AdsError(503, "ADS_NOT_CONFIGURED", "Set META_TOKEN_ENCRYPTION_KEY before connecting Meta Ads.");
  return Buffer.from(config.metaTokenEncryptionKey, "hex");
}
function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
function open(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new AdsError(500, "ADS_TOKEN_INVALID", "Saved Meta Ads credentials are invalid. Reconnect Meta Ads.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
async function graph<T>(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`https://graph.facebook.com/${config.metaGraphVersion}/${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new AdsError(502, "META_ADS_REQUEST_FAILED", typeof data?.error?.message === "string" ? data.error.message : "Meta Ads could not complete this request.");
  return data as T;
}
const publicConnection = (connection?: Connection) => ({
  connected: connection?.status === "connected",
  status: connection?.status ?? "disconnected",
  adAccounts: connection?.adAccounts ?? [],
  pixels: connection?.pixels ?? [],
  catalogs: connection?.catalogs ?? [],
  selection: {
    adAccountId: connection?.adAccountId ?? null,
    pixelId: connection?.pixelId ?? null,
    catalogId: connection?.catalogId ?? null,
  },
  lastSyncAt: connection?.lastSyncAt ?? null,
  lastError: connection?.lastError ?? null,
});

export const adsService = {
  async overview(shopId: string) {
    const db = await connectDb();
    const connection = await db.collection<Connection>("metaAdsConnections").findOne({ shopId });
    const [snapshot, drafts, events] = await Promise.all([
      db.collection("metaAdsInsights").find({ shopId }).sort({ dateStart: -1, _id: -1 }).limit(30).toArray(),
      db.collection("metaAdsCampaignDrafts").find({ shopId }).sort({ updatedAt: -1 }).limit(20).toArray(),
      db.collection("metaCapiEvents").countDocuments({ shopId, status: "failed" }),
    ]);
    return { connection: publicConnection(connection ?? undefined), insights: snapshot, drafts, tracking: { failedEvents: events } };
  },

  async startConnection(shopId: string, actorId: string) {
    if (!config.metaAppId || !config.metaAppSecret)
      throw new AdsError(503, "META_NOT_CONFIGURED", "Set META_APP_ID and META_APP_SECRET before connecting Meta Ads.");
    encryptionKey();
    const db = await connectDb();
    const state = randomBytes(24).toString("hex");
    const now = new Date();
    await db.collection<OAuthState>("metaAdsOAuthStates").insertOne({ _id: state, shopId, actorId, expiresAt: new Date(now.getTime() + 10 * 60_000) });
    await db.collection<Connection>("metaAdsConnections").updateOne(
      { shopId },
      { $set: { status: "pending", updatedAt: now.toISOString(), lastError: "" }, $setOnInsert: { _id: randomUUID(), shopId, adAccounts: [], pixels: [], catalogs: [], createdAt: now.toISOString() } },
      { upsert: true },
    );
    const url = new URL(`https://www.facebook.com/${config.metaGraphVersion}/dialog/oauth`);
    url.searchParams.set("client_id", config.metaAppId);
    url.searchParams.set("redirect_uri", `${config.appOrigin}/api/meta/ads/callback`);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.metaAdsOAuthScopes);
    return { authUrl: url.toString() };
  },

  async completeConnection(code: string, state: string, actorId: string) {
    const db = await connectDb();
    const saved = await db.collection<OAuthState>("metaAdsOAuthStates").findOneAndDelete({ _id: state, expiresAt: { $gt: new Date() } });
    if (!saved || saved.actorId !== actorId) throw new AdsError(400, "META_ADS_STATE_INVALID", "Meta Ads authorization expired. Start again from Ads.");
    const tokenUrl = new URL(`https://graph.facebook.com/${config.metaGraphVersion}/oauth/access_token`);
    tokenUrl.search = new URLSearchParams({ client_id: config.metaAppId, client_secret: config.metaAppSecret, redirect_uri: `${config.appOrigin}/api/meta/ads/callback`, code }).toString();
    const response = await fetch(tokenUrl, { signal: AbortSignal.timeout(12_000) });
    const tokenData = await response.json().catch(() => ({}));
    if (!response.ok || typeof tokenData.access_token !== "string") throw new AdsError(502, "META_TOKEN_FAILED", "Meta did not return an Ads access token.");
    const token = tokenData.access_token;
    const [accounts, pixels, catalogs] = await Promise.all([
      graph<z.infer<typeof graphList>>("me/adaccounts?fields=id,name,currency&limit=100", token),
      graph<z.infer<typeof graphList>>("me/adspixels?fields=id,name&limit=100", token).catch(() => ({ data: [] })),
      graph<z.infer<typeof graphList>>("me/product_catalogs?fields=id,name&limit=100", token).catch(() => ({ data: [] })),
    ]);
    const now = new Date().toISOString();
    await db.collection<Connection>("metaAdsConnections").updateOne(
      { shopId: saved.shopId },
      { $set: { status: "connected", token: seal(token), adAccounts: accounts.data.map((item) => accountSchema.parse(item)), pixels: pixels.data.map((item) => pixelSchema.parse(item)), catalogs: catalogs.data.map((item) => catalogSchema.parse(item)), updatedAt: now, lastError: "" } },
    );
    return { shopId: saved.shopId };
  },

  async selectAssets(shopId: string, selection: { adAccountId: string; pixelId?: string; catalogId?: string }) {
    const db = await connectDb();
    const connection = await db.collection<Connection>("metaAdsConnections").findOne({ shopId, status: "connected" });
    if (!connection) throw new AdsError(409, "META_ADS_NOT_CONNECTED", "Connect Meta Ads before selecting assets.");
    if (!connection.adAccounts.some((item) => item.id === selection.adAccountId)) throw new AdsError(400, "META_AD_ACCOUNT_INVALID", "Choose an ad account from this shop's Meta connection.");
    if (selection.pixelId && !connection.pixels.some((item) => item.id === selection.pixelId)) throw new AdsError(400, "META_PIXEL_INVALID", "Choose a pixel from this shop's Meta connection.");
    if (selection.catalogId && !connection.catalogs.some((item) => item.id === selection.catalogId)) throw new AdsError(400, "META_CATALOG_INVALID", "Choose a catalog from this shop's Meta connection.");
    await db.collection<Connection>("metaAdsConnections").updateOne({ shopId }, { $set: { ...selection, updatedAt: new Date().toISOString() } });
    return this.overview(shopId);
  },

  async syncInsights(shopId: string, since: string, until: string) {
    const db = await connectDb();
    const connection = await db.collection<Connection>("metaAdsConnections").findOne({ shopId, status: "connected" });
    if (!connection?.token || !connection.adAccountId) throw new AdsError(409, "META_ADS_NOT_READY", "Connect Meta Ads and select an ad account first.");
    const data = await graph<{ data?: unknown[] }>(`${connection.adAccountId}/insights?${new URLSearchParams({ level: "campaign", fields: "campaign_id,campaign_name,spend,impressions,reach,clicks,ctr,cpc,cpm,actions,action_values", time_range: JSON.stringify({ since, until }), limit: "500" })}`, open(connection.token));
    const snapshot = { _id: randomUUID(), shopId, level: "campaign", dateStart: since, dateStop: until, rows: data.data ?? [], syncedAt: new Date().toISOString() };
    await db.collection<InsightSnapshot>("metaAdsInsights").insertOne(snapshot);
    await db.collection<Connection>("metaAdsConnections").updateOne({ shopId }, { $set: { lastSyncAt: snapshot.syncedAt, lastError: "" } });
    return snapshot;
  },
};
