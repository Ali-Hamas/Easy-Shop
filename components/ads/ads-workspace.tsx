"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BarChart3, Link2, RefreshCw } from "lucide-react";
import { rememberedShop, subscribeShop } from "@/adapters/commerce";
import { adsService, type AdsOverview } from "@/services/ads";
import { Button } from "@/components/ui/button";

const today = () => new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = () => new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);

export default function AdsWorkspace() {
  const shopId = useSyncExternalStore(subscribeShop, rememberedShop, () => null);
  const [data, setData] = useState<AdsOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = () => shopId && adsService.overview(shopId).then(setData).catch((e) => setError(e.message));
  useEffect(() => { void load(); }, [shopId]);
  if (!shopId) return <div className="module-panel">Select your shop to manage Meta Ads.</div>;
  const connection = data?.connection;
  const connect = async () => {
    setBusy(true); setError("");
    try { window.location.assign((await adsService.connect(shopId)).authUrl); } catch (e) { setError(e instanceof Error ? e.message : "Could not start Meta Ads connection."); setBusy(false); }
  };
  const sync = async () => { setBusy(true); setError(""); try { await adsService.sync(shopId, thirtyDaysAgo(), today()); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Could not sync Meta Ads insights."); } finally { setBusy(false); } };
  return <div className="page page-analytics"><header className="page-header"><div><p className="eyebrow">Growth / Ads</p><h1>Meta Ads</h1><p>Spend and campaign data stay separate from placed and delivered orders.</p></div><Button onClick={connection?.connected ? sync : connect} loading={busy}><Link2 size={16}/>{connection?.connected ? "Sync insights" : "Connect Meta Ads"}</Button></header>{error && <p role="alert">{error}</p>}<section className="module-panel"><div className="panel-heading"><div className="inline"><BarChart3 size={18}/><h2>Connection</h2></div><strong>{connection?.status ?? "Loading"}</strong></div>{connection?.connected ? <div><label>Ad account<select value={connection.selection.adAccountId ?? ""} onChange={async (event) => { if (!event.target.value) return; setBusy(true); try { await adsService.select(shopId, { adAccountId: event.target.value, pixelId: connection.selection.pixelId ?? undefined, catalogId: connection.selection.catalogId ?? undefined }); await load(); } finally { setBusy(false); } }}><option value="">Select an ad account</option>{connection.adAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><p>Last synced: {connection.lastSyncAt ?? "Never"}</p></div> : <p>Connect the shop’s Meta Business account to select its ad account, pixel, and catalog. Access tokens remain encrypted on the server.</p>}</section><section className="module-panel"><div className="panel-heading"><div className="inline"><RefreshCw size={18}/><h2>Imported insights</h2></div></div><p>{data?.insights.length ? `${data.insights.length} saved report snapshots.` : "No Meta Ads report has been imported yet."}</p></section></div>;
}
