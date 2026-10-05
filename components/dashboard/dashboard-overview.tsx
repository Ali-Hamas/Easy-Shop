"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  Copy,
  Inbox,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { apiRequest } from "@/lib/api/client";
import { onboardingService } from "@/services/commerce";
import { rememberedShop, subscribeShop } from "@/adapters/commerce";
import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnboardingState } from "@/types/commerce";
import type { DashboardSummary } from "@/types/dashboard";
import "@/styles/dashboard-focus.css";
const actionLabels: Record<string, string> = {
  "onboarding.started": "Shop created",
  "shop.updated": "Shop details updated",
  "product.created": "First product added",
  "shop.launched": "Storefront published",
  "template.selected": "Storefront template selected",
  "ai_mode.updated": "AI preference updated",
  "channel.meta_skipped": "Storefront-only setup selected",
  "inventory.product_created": "Product added to inventory",
  "inventory.product_updated": "Product facts updated",
  "inventory.stock_adjusted": "Stock adjusted",
  "inbox.draft_generated": "AI reply drafted for review",
  "inbox.draft_edited": "Reply draft edited",
  "inbox.draft_approved": "Reply approved by you",
  "inbox.draft_rejected": "Reply draft rejected",
  "inbox.reply_sent": "Approved reply sent to customer",
  "storefront.message_received": "Customer sent a storefront message",
  "inbox.message_staff": "Staff reply sent",
  "customer.created": "Customer added",
  "customer.updated": "Customer details updated",
  "customer.note_added": "Customer note added",
};
export default function DashboardOverview() {
  const { user } = useSession();
  const shopId = useSyncExternalStore(
    subscribeShop,
    rememberedShop,
    () => null,
  );
  const [data, setData] = useState<{
    state: OnboardingState;
    summary: DashboardSummary;
  } | null>(null);
  const [failure, setFailure] = useState<{
    shopId: string;
    message: string;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copyStoreLink() {
    if (!data?.state.shop.subdomain) return;
    const url = `${window.location.origin}/store/${data.state.shop.subdomain}`;
    try {
      setCopyError(false);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }
  useEffect(() => {
    if (!shopId) return;
    const controller = new AbortController();
    Promise.all([
      onboardingService.get(shopId, controller.signal),
      apiRequest<DashboardSummary>(`dashboard/${shopId}`, {
        signal: controller.signal,
      }),
    ])
      .then(([state, summary]) => {
        if (!controller.signal.aborted) {
          setData({ state, summary });
          setFailure(null);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setFailure({
            shopId,
            message:
              e instanceof Error
                ? e.message
                : "Your workspace could not be refreshed.",
          });
      });
    return () => controller.abort();
  }, [shopId, revision]);
  const current = data?.state.shop.id === shopId ? data : null;
  const state = current?.state,
    summary = current?.summary;
  const error = failure?.shopId === shopId ? failure.message : "";
  const launched = state?.shop.status === "launched";
  const steps = [
    { title: "Create your shop", done: !!state },
    { title: "Add your first product", done: !!state?.products.length },
    { title: "Choose a storefront", done: !!state?.shop.selectedTemplateId },
    { title: "Review and launch", done: !!launched },
  ];
  const attention = summary
    ? summary.openConversations + summary.inventory.low + summary.inventory.out
    : 0;
  return (
    <div className="page focus-dashboard">
      <header className="focus-masthead">
        <div>
          <p>{state?.shop.displayName ?? "Your workspace"}</p>
          <h1>
            {launched
              ? "Your shop, at a glance."
              : `Welcome${user.name ? `, ${user.name.split(" ")[0]}` : ""}.`}
          </h1>
          <span>
            {launched
              ? "Conversations, stock and your next move."
              : "A few thoughtful steps. A shop that’s yours."}
          </span>
        </div>
        <div className="focus-masthead-actions">
          {launched && state?.shop.subdomain && (
            <Link
              href={`/store/${state.shop.subdomain}`}
              className="button button-secondary quick-store-link"
            >
              <Store size={15} /> View Store <ArrowUpRight size={14} />
            </Link>
          )}
          <Button
            variant="secondary"
            onClick={() => setRevision((n) => n + 1)}
            disabled={!shopId}
          >
            <RefreshCw size={15} /> Refresh
          </Button>
        </div>
      </header>
      {error && (
        <div className="focus-error" role="alert">
          <p>{error}</p>
          <Button variant="secondary" onClick={() => setRevision((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}
      {shopId && !current && !error ? (
        <div className="focus-loading" role="status">
          Loading your shop’s latest activity…
        </div>
      ) : (
        <>
            <section className="focus-storefront">
              <div className="focus-storefront-header">
                <Store size={24} strokeWidth={1.3} />
                <span
                  className={cn(
                    "store-status-badge",
                    launched
                      ? "status-live"
                      : state
                        ? "status-draft"
                        : "status-none",
                  )}
                >
                  <span
                    className={cn(
                      "status-dot",
                      launched ? "live" : state ? "draft" : "none",
                    )}
                  />
                  {launched ? "Live" : state ? "Draft" : "Not set up"}
                </span>
              </div>

              <h2 className="focus-shop-name">
                {state?.shop.displayName ??
                  (shopId ? "Your shop" : "Your storefront")}
              </h2>

              <p className="focus-storefront-desc">
                {launched
                  ? "Your customer-facing boutique is active and accessible online."
                  : state
                    ? "Your storefront is currently in draft. Complete setup to publish."
                    : "Create a shop and add your first product to open your storefront."}
              </p>

              <div className="store-url-box">
                <span className="store-url-label">Storefront address</span>
                <code className="store-url-text">
                  {state?.shop.subdomain
                    ? `/store/${state.shop.subdomain}`
                    : "No store address yet"}
                </code>
              </div>

              <div className="focus-storefront-actions">
                {launched ? (
                  <>
                    <Link
                      className="button button-primary view-store-button focus-storefront-btn"
                      href={`/store/${state.shop.subdomain}`}
                    >
                      View Store
                      <ArrowUpRight size={15} />
                    </Link>
                    <button
                      type="button"
                      onClick={copyStoreLink}
                      className="button button-secondary copy-store-link-button store-copy-link-btn"
                      aria-label="Copy customer-facing storefront URL"
                    >
                      <Copy size={14} />
                      {copied ? "Store link copied." : "Copy Link"}
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className="view-store-disabled-wrapper"
                      title="Please set up your store first."
                      tabIndex={0}
                      aria-label="View Store unavailable. Please set up your store first."
                    >
                      <button
                        type="button"
                        disabled
                        className="button button-primary view-store-button disabled focus-storefront-btn-disabled"
                        aria-disabled="true"
                        title="Please set up your store first."
                      >
                        View Store
                        <ArrowUpRight size={15} />
                      </button>
                      <span className="view-store-disabled-hint" role="note">
                        Please set up your store first.
                      </span>
                    </div>
                    <Link
                      className="button button-secondary setup-store-button focus-setup-store-btn"
                      href="/onboarding"
                    >
                      {state ? "Complete Setup / Launch" : "Set Up Store"}
                      <ArrowUpRight size={15} />
                    </Link>
                    {state?.shop?.subdomain && (
                      <Link
                        className="button button-secondary view-store-preview-button store-preview-action-btn"
                        href={`/store/${state.shop.subdomain}?preview=true`}
                      >
                        Preview Store
                        <ArrowUpRight size={14} />
                      </Link>
                    )}
                  </>
                )}
              </div>

              {copyError && <p role="alert">Copy is unavailable. Select and copy the store address above.</p>}
              {copied && (
                <p role="status" className="store-copy-status">
                  Store link copied.
                </p>
              )}

              <small className="focus-storefront-note">
                {launched
                  ? "Ready to share with customers via bio link or direct message."
                  : "View Store becomes active as soon as your storefront is published."}
              </small>
            </section>
          <div className="focus-primary-grid">
            <section className="focus-attention">
              <div className="focus-section-top">
                <span>
                  <Inbox size={18} /> Your next move
                </span>
                {launched && (
                  <span className="focus-status">
                    <Check size={13} /> Storefront live
                  </span>
                )}
              </div>
              {!launched ? (
                <>
                  <h2>
                    Make room for your
                    <br />
                    first conversation.
                  </h2>
                  <p>
                    Your products give AI its facts. Your storefront gives
                    customers a place to ask.
                  </p>
                  <Link className="button button-primary" href="/onboarding">
                    {state ? "Continue shop setup" : "Set up your shop"}
                    <ArrowUpRight size={16} />
                  </Link>
                  <ol className="focus-setup">
                    {steps.map((step, i) => (
                      <li key={step.title} data-complete={step.done}>
                        <span>{step.done ? <Check size={14} /> : i + 1}</span>
                        {step.title}
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <>
                  <h2>
                    {attention ? (
                      <>
                        A little attention.
                        <br />A better customer day.
                      </>
                    ) : (
                      <>
                        Everything has
                        <br />
                        room to move.
                      </>
                    )}
                  </h2>
                  <p>
                    {attention
                      ? "Start where a customer is waiting, then keep your product facts current."
                      : "No open conversations or stock alerts. Your next customer message will appear in Inbox."}
                  </p>
                  <div className="focus-task-list">
                    <Link href="/inbox">
                      <span>
                        <Inbox size={17} /> Open conversations
                      </span>
                      <strong>
                        {summary?.openConversations ?? 0}
                        <ArrowUpRight size={16} />
                      </strong>
                    </Link>
                    <Link href="/products">
                      <span>
                        <Package size={17} /> Low or unavailable stock
                      </span>
                      <strong>
                        {(summary?.inventory.low ?? 0) +
                          (summary?.inventory.out ?? 0)}
                        <ArrowUpRight size={16} />
                      </strong>
                    </Link>
                  </div>
                </>
              )}
            </section>
            <motion.section
              className="focus-ai"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
            >
              <div className="focus-section-top">
                <span>
                  <Sparkles size={18} /> AI, with your judgment
                </span>
              </div>
              <div className="focus-ai-orbit" aria-hidden="true">
                <ShieldCheck size={40} strokeWidth={1.2} />
                <span>Review → approve → send</span>
              </div>
              <h2>
                {summary?.pendingDrafts
                  ? `${summary.pendingDrafts} draft${summary.pendingDrafts === 1 ? "" : "s"} to review`
                  : "A second pair of eyes."}
              </h2>
              <p>
                {state?.shop.aiMode === "off"
                  ? "AI is currently off for this shop."
                  : "Drafts use your product and stock facts. Every reply waits for your approval and explicit send."}
              </p>
              <div className="focus-ai-count">
                <strong>{summary?.sentReplies ?? 0}</strong>
                <span>reviewed AI replies sent</span>
              </div>
              <Link
                href={shopId ? "/inbox" : "/onboarding"}
                className="text-link"
              >
                {shopId ? "Open reply workspace" : "Set up your shop first"}
                <ArrowUpRight size={15} />
              </Link>
            </motion.section>
          </div>
          {summary && summary.inventory.products > 0 && <section className="focus-facts" aria-label="Current shop totals">
            {[
              {
                label: "Products",
                value: summary?.inventory.products ?? 0,
                href: "/products",
                icon: Package,
              },
              {
                label: "Available units",
                value: summary?.inventory.available ?? 0,
                href: "/products",
                icon: Store,
              },
              {
                label: "Customers",
                value: summary?.customers ?? 0,
                href: "/customers",
                icon: Users,
              },
            ].map(({ label, value, href, icon: Icon }) => (
              <Link href={href} key={label}>
                <span>
                  <Icon size={16} />
                  {label}
                </span>
                <strong>{value.toLocaleString()}</strong>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </section>}
          <div className="focus-secondary-grid">
            <section className="focus-activity">
              <h2>What changed</h2>
              {summary?.activity.length ? (
                <ol>
                  {summary.activity.map((event) => (
                    <li key={event.id}>
                      <span className="focus-event-dot" />
                      <div>
                        <p>
                          {actionLabels[event.action] ??
                            "Shop activity recorded"}
                        </p>
                        <time dateTime={event.createdAt}>
                          {new Date(event.createdAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>
                  Your saved shop changes and reviewed replies will appear here.
                </p>
              )}
            </section>

          </div>
        </>
      )}
    </div>
  );
}
