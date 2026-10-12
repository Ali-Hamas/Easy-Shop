"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { rememberedShop, subscribeShop, formatMoney } from "@/adapters/commerce";
import { orderService } from "@/services/orders";
import type { OrderSummary } from "@/types/orders";
import "@/styles/orders.css";

export function OrdersWorkspace() {
  const shopId = useSyncExternalStore(subscribeShop, rememberedShop, () => null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shopId) return;
    const ac = new AbortController();
    orderService
      .list(shopId, ac.signal)
      .then((res) => {
        if (!ac.signal.aborted) setOrders(res.orders);
      })
      .catch((err) => {
        if (!ac.signal.aborted)
          setError(err instanceof Error ? err.message : "Orders could not load.");
      });
    return () => ac.abort();
  }, [shopId]);

  return (
    <main className="orders-workspace">
      <header className="orders-header">
        <div>
          <p>Orders</p>
          <h1>Storefront orders</h1>
        </div>
        <span>{orders.length} received</span>
      </header>

      {error && <p className="orders-alert">{error}</p>}
      {!shopId && <p className="orders-empty">Open a shop first.</p>}
      {shopId && orders.length === 0 && !error && (
        <p className="orders-empty">No orders yet.</p>
      )}

      <div className="orders-list">
        {orders.map((order) => (
          <article className="order-row" key={order.id}>
            <div>
              <strong>{order.orderNumber}</strong>
              <span>
                {order.buyer.name} · {order.buyer.phone}
              </span>
              <small>{order.buyer.address}</small>
            </div>
            <div>
              <strong>{formatMoney(order.total, order.currency)}</strong>
              <span>{order.items.length} item{order.items.length === 1 ? "" : "s"}</span>
              <small>{new Date(order.createdAt).toLocaleString()}</small>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
