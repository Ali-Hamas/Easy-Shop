"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  rememberedShop,
  subscribeShop,
  formatMoney,
} from "@/adapters/commerce";
import { apiRequest } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import "@/styles/seller-commerce.css";
type Order = {
  id: string;
  buyer: { name: string; phone: string; city: string; address: string };
  items: { name: string; quantity: number; variantTitle: string }[];
  status: string;
  total: number;
  currency: string;
  version: number;
  timeline: { status: string; at: string }[];
};
const labels: Record<string, string> = {
  new: "Awaiting confirmation",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const next: Record<string, string[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};
export default function SellerOrders() {
  const shopId = useSyncExternalStore(
    subscribeShop,
    rememberedShop,
    () => null,
  );
  return <OrderList key={shopId} shopId={shopId} />;
}
function OrderList({ shopId }: { shopId: string | null }) {
  const [orders, setOrders] = useState<Order[] | null>(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(""),
    [filter, setFilter] = useState("all");
  useEffect(() => {
    if (!shopId) return;
    const controller = new AbortController();
    apiRequest<{ orders: Order[] }>(`orders/${shopId}`, {
      signal: controller.signal,
    })
      .then((d) => {
        setOrders(d.orders);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [shopId, reload]);
  async function update(o: Order, status: string) {
    if (
      !window.confirm(
        status === "cancelled"
          ? "Cancel this order? Reserved stock will be released."
          : status === "delivered"
            ? "Confirm this order was delivered? Stock will be recorded as sold and the buyer can leave verified reviews."
            : status === "confirmed"
              ? "Confirm delivery availability, buyer details and payment arrangements before accepting this order. Stock will be reserved."
              : `Mark this order ${status}?`,
      )
    )
      return;
    setBusy(o.id);
    setError("");
    try {
      await apiRequest(`orders/${shopId}/${o.id}`, {
        method: "PATCH",
        body: { version: o.version, status },
      });
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update order.");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="seller-commerce">
      <header>
        <div>
          <h1>Orders</h1>
          <p>
            Review guest orders, confirm availability and keep buyers informed.
          </p>
        </div>
        <Link href="/reviews">Manage reviews</Link>
      </header>
      {!shopId ? (
        <p>Choose a shop to manage orders.</p>
      ) : (
        <>
          <div className="seller-commerce-filter">
            <label>
              Order status
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All orders</option>
                {Object.entries(labels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="secondary" onClick={() => setReload((n) => n + 1)}>
              Refresh
            </Button>
          </div>
          {error && <p role="alert">{error}</p>}
          {!orders && !error ? (
            <p role="status">Loading orders…</p>
          ) : (
            orders
              ?.filter((o) => filter === "all" || o.status === filter)
              .map((o) => (
                <article key={o.id} className="seller-order">
                  <div className="seller-order-heading">
                    <div>
                      <strong>{o.buyer.name}</strong>
                      <span>{labels[o.status]}</span>
                    </div>
                    <strong>{formatMoney(o.total, o.currency)}</strong>
                  </div>
                  <p className="seller-order-reference">{o.id}</p>
                  <div className="seller-order-columns">
                    <div>
                      <h2>Items</h2>
                      {o.items.map((i, n) => (
                        <p key={n}>
                          {i.name} · {i.variantTitle} × {i.quantity}
                        </p>
                      ))}
                    </div>
                    <div>
                      <h2>Delivery details</h2>
                      <p>
                        {o.buyer.phone}
                        <br />
                        {o.buyer.address}
                        <br />
                        {o.buyer.city}
                      </p>
                    </div>
                  </div>
                  <details>
                    <summary>Status history</summary>
                    <ol>
                      {o.timeline.map((t, i) => (
                        <li key={i}>
                          {labels[t.status]} · {new Date(t.at).toLocaleString()}
                        </li>
                      ))}
                    </ol>
                  </details>
                  <div className="seller-order-actions">
                    {next[o.status]?.map((s) => (
                      <Button
                        key={s}
                        variant={s === "cancelled" ? "secondary" : "primary"}
                        disabled={Boolean(busy)}
                        loading={busy === o.id && s !== "cancelled"}
                        onClick={() => void update(o, s)}
                      >
                        {s === "cancelled" ? "Cancel order" : `Mark ${s}`}
                      </Button>
                    ))}
                  </div>
                </article>
              ))
          )}
          {orders?.length === 0 && (
            <div className="seller-commerce-empty">
              <h2>Your orders will appear here.</h2>
              <p>
                Guest checkout creates an order awaiting your confirmation.
                Buyers do not need an account.
              </p>
              <Link href="/website">Open your website editor</Link>
            </div>
          )}
          <p className="seller-commerce-note">
            Latest 100 orders. Status updates are manual; no courier or payment
            processor is connected. Confirmation reserves stock; delivery
            records the sale.
          </p>
        </>
      )}
    </div>
  );
}
