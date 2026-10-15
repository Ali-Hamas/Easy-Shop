"use client";
import { useState } from "react";
import { CheckCircle2, Download, Truck } from "lucide-react";
import { Modal } from "@/components/ui/overlays";
import { Input, Textarea } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/client";
import { formatMoney } from "@/adapters/commerce";
import { getStorefrontTheme } from "@/config/storefront-themes";
import type { PublicStore } from "@/types/commerce";
export type GuestCartItem = {
  productId: string;
  productName: string;
  variantId?: string;
  variantTitle?: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  slug?: string;
};
type Receipt = {
  id: string;
  status: string;
  total: number;
  currency: string;
  items: { name: string; quantity: number }[];
  timeline: { status: string; at: string }[];
};
export function GuestCheckout({
  open,
  onOpenChange,
  store,
  items,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  store: PublicStore;
  items: GuestCartItem[];
  onComplete: () => void;
}) {
  const [buyer, setBuyer] = useState({
      name: "",
      phone: "",
      city: "",
      address: "",
    }),
    [step, setStep] = useState<"details" | "review">("details"),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [credentials, setCredentials] = useState<{
      requestId: string;
      receiptKey: string;
    } | null>(null);
  const subtotal =
      items.reduce((n, i) => n + Math.round(i.price * 100) * i.quantity, 0) /
      100,
    total =
      Math.round((subtotal + store.shop.policyDefaults.deliveryCharge) * 100) /
      100;
  async function place() {
    setSaving(true);
    setError("");
    const keys = credentials ?? {
      requestId: crypto.randomUUID(),
      receiptKey: Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
        n.toString(16).padStart(2, "0"),
      ).join(""),
    };
    setCredentials(keys);
    try {
      const result = await apiRequest<{ order: Receipt }>(
        `storefront/${store.shop.subdomain}/checkout`,
        {
          method: "POST",
          body: {
            ...keys,
            buyer,
            items: items.map((i) => ({
              productId: i.productId,
              ...(i.variantId ? { variantId: i.variantId } : {}),
              quantity: i.quantity,
            })),
            expectedTotal: total,
          },
        },
      );
      setReceipt(result.order);
      try {
        sessionStorage.setItem(
          `receipt:${store.shop.subdomain}`,
          JSON.stringify({
            orderId: result.order.id,
            phone: buyer.phone,
            receiptKey: keys.receiptKey,
          }),
        );
      } catch {}
      onComplete();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The order could not be placed. Your details are still here.",
      );
    } finally {
      setSaving(false);
    }
  }
  function download() {
    if (!receipt || !credentials) return;
    const text = `${store.shop.displayName}\nOrder: ${receipt.id}\nPhone: ${buyer.phone}\nPrivate receipt key: ${credentials.receiptKey}\nTotal: ${formatMoney(receipt.total, receipt.currency)}\nStatus: Awaiting seller confirmation\n\nKeep this receipt private. The key allows a review after delivery.\nTrack your order at ${location.origin}/store/${store.shop.subdomain}#order-tracking`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `order-${receipt.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Modal
      data-store-theme={
        getStorefrontTheme(
          store.shop.content?.design?.themeId || store.shop.selectedTemplateId,
        ).id
      }
      data-store-accent={store.shop.content?.design?.accent || "theme"}
      data-store-font={store.shop.content?.design?.fontSet || "theme"}
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v);
      }}
      title={
        receipt
          ? "Your order is with the shop"
          : step === "details"
            ? "Checkout as a guest"
            : "Review your order"
      }
      description={
        receipt
          ? "Awaiting seller confirmation. No payment has been collected."
          : "No account needed. Delivery and availability are confirmed by the seller."
      }
      className="guest-checkout"
    >
      {receipt ? (
        <div className="guest-receipt">
          <CheckCircle2 size={40} />
          <h3>Thank you, {buyer.name}.</h3>
          <p>
            Keep your order reference and private receipt key. You’ll need your
            receipt to leave a verified review after delivery.
          </p>
          <dl>
            <dt>Order reference</dt>
            <dd>{receipt.id}</dd>
            <dt>Private receipt key</dt>
            <dd className="receipt-key">{credentials?.receiptKey}</dd>
            <dt>Total on delivery</dt>
            <dd>{formatMoney(receipt.total, receipt.currency)}</dd>
          </dl>
          <Button onClick={download}>
            <Download size={16} />
            Save receipt
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
              document
                .getElementById("order-tracking")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Track order
          </Button>
        </div>
      ) : (
        <div className="guest-checkout-grid">
          <div>
            {step === "details" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep("review");
                  setError("");
                }}
              >
                <Input
                  label="Full name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={buyer.name}
                  onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
                />
                <Input
                  label="Phone number"
                  autoComplete="tel"
                  type="tel"
                  required
                  minLength={7}
                  maxLength={30}
                  value={buyer.phone}
                  onChange={(e) =>
                    setBuyer({ ...buyer, phone: e.target.value })
                  }
                />
                <Input
                  label="City / district"
                  autoComplete="address-level2"
                  required
                  minLength={2}
                  maxLength={100}
                  value={buyer.city}
                  onChange={(e) => setBuyer({ ...buyer, city: e.target.value })}
                />
                <Textarea
                  label="Delivery address"
                  autoComplete="street-address"
                  required
                  minLength={10}
                  maxLength={500}
                  value={buyer.address}
                  onChange={(e) =>
                    setBuyer({ ...buyer, address: e.target.value })
                  }
                />
                <Button
                  type="submit"
                  disabled={!store.shop.policyDefaults.codAllowed}
                >
                  Review order
                </Button>
                {!store.shop.policyDefaults.codAllowed && (
                  <p>
                    Cash on delivery is unavailable. Message the shop about
                    payment.
                  </p>
                )}
              </form>
            ) : (
              <div className="guest-order-review">
                <h3>Deliver to</h3>
                <p>
                  {buyer.name}
                  <br />
                  {buyer.phone}
                  <br />
                  {buyer.address}
                  <br />
                  {buyer.city}
                </p>
                <h3>Payment</h3>
                <p>
                  Cash on delivery. The shop will review stock and delivery
                  availability before confirming.
                </p>
                {store.shop.content?.returns && (
                  <p>{store.shop.content.returns}</p>
                )}
                {error && (
                  <p role="alert" className="review-error">
                    {error}
                  </p>
                )}
                <Button onClick={() => void place()} loading={saving}>
                  Place order · {formatMoney(total, store.shop.currency)}
                </Button>
                <Button
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    setStep("details");
                    setCredentials(null);
                  }}
                >
                  Edit details
                </Button>
              </div>
            )}
          </div>
          <aside className="guest-order-summary">
            <h3>Your order</h3>
            {items.map((i, n) => (
              <div key={n}>
                <span>
                  {i.productName}
                  {i.variantTitle && ` · ${i.variantTitle}`} × {i.quantity}
                </span>
                <strong>
                  {formatMoney(i.price * i.quantity, store.shop.currency)}
                </strong>
              </div>
            ))}
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal, store.shop.currency)}</strong>
            </div>
            <div>
              <span>Delivery</span>
              <strong>
                {formatMoney(
                  store.shop.policyDefaults.deliveryCharge,
                  store.shop.currency,
                )}
              </strong>
            </div>
            <div className="guest-total">
              <span>Total</span>
              <strong>{formatMoney(total, store.shop.currency)}</strong>
            </div>
          </aside>
        </div>
      )}
    </Modal>
  );
}
export function GuestTracking({ subdomain }: { subdomain: string }) {
  const [orderId, setOrderId] = useState(""),
    [phone, setPhone] = useState(""),
    [order, setOrder] = useState<Receipt | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  async function track(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const data = await apiRequest<{ order: Receipt }>(
        `storefront/${subdomain}/orders/track`,
        { method: "POST", body: { orderId, phone } },
      );
      setOrder(data.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find that order.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section id="order-tracking" className="guest-tracking">
      <div>
        <Truck size={26} strokeWidth={1.5} />
        <h2>Follow your order.</h2>
        <p>
          Your order reference and checkout phone number are all you need. No
          account, no password.
        </p>
      </div>
      <form onSubmit={track}>
        <Input
          label="Order reference"
          required
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
        />
        <Input
          label="Checkout phone number"
          required
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Button type="submit" loading={loading}>
          Track order
        </Button>
        {error && <p role="alert">{error}</p>}
        {order && (
          <div className="guest-tracking-result" role="status">
            <strong>
              {order.status === "new"
                ? "Awaiting seller confirmation"
                : order.status}
            </strong>
            <ol>
              {order.timeline.map((t, i) => (
                <li key={i}>
                  <CheckCircle2 size={14} />
                  {t.status === "new" ? "Order received" : t.status}
                  <time>{new Date(t.at).toLocaleDateString()}</time>
                </li>
              ))}
            </ol>
            <p>No delivery date is promised until the shop confirms it.</p>
          </div>
        )}
      </form>
    </section>
  );
}
