"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Star,
  ShieldCheck,
  MessageSquare,
  RefreshCw,
  ArrowUpRight,
  Search,
  Check,
  CornerDownRight,
} from "lucide-react";
import { rememberedShop, subscribeShop } from "@/adapters/commerce";
import { useSession } from "@/components/auth/session-provider";
import { apiRequest } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Textarea, SearchInput, Select } from "@/components/ui/fields";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { commerceUi } from "@/config/commerce-ui";
import "@/styles/review-workspace.css";

type Review = {
  id: string;
  name: string;
  text: string;
  rating: number;
  productName: string | null;
  createdAt: string;
  reply: { text: string; at: string } | null;
};
const filters = [
  ["all", "All reviews"],
  ["unanswered", "Needs a reply"],
  ["store", "Store reviews"],
  ["product", "Product reviews"],
] as const;
export default function SellerReviews() {
  const shopId = useSyncExternalStore(
    subscribeShop,
    rememberedShop,
    () => null,
  );
  return <Reviews key={shopId} shopId={shopId} />;
}
function Reviews({ shopId }: { shopId: string | null }) {
  const { shops } = useSession();
  const shop = shops.find((s) => s.id === shopId);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(!!shopId);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState("all");
  const [sort, setSort] = useState("newest");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!shopId) return;
    const controller = new AbortController();
    apiRequest<{ reviews: Review[] }>(`reviews/${shopId}`, {
      signal: controller.signal,
    })
      .then((d) => {
        if (controller.signal.aborted) return;
        setReviews(d.reviews);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [shopId, reload]);
  const total = reviews?.length ?? 0;
  const unanswered = reviews?.filter((r) => !r.reply).length ?? 0;
  const average = total
    ? (reviews!.reduce((n, r) => n + r.rating, 0) / total).toFixed(1)
    : "—";
  const visible = (reviews || [])
    .filter(
      (r) =>
        (filter === "all" ||
          (filter === "unanswered" && !r.reply) ||
          (filter === "store" && !r.productName) ||
          (filter === "product" && !!r.productName)) &&
        (rating === "all" || r.rating === Number(rating)) &&
        `${r.name} ${r.text} ${r.productName || "Store review"}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "lowest"
        ? a.rating - b.rating
        : sort === "highest"
          ? b.rating - a.rating
          : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  function refresh() {
    setLoading(true);
    setError("");
    setReload((n) => n + 1);
  }
  function resetFilters() {
    setFilter("all");
    setQuery("");
    setRating("all");
    setSort("newest");
  }
  return (
    <PageShell
      variant="data"
      className="review-workspace"
      header={
        <PageHeader
          title="Reviews"
          description="Every conversation is a chance to earn a little more trust."
          actions={
            <>
              {shop?.status === "launched" && (
                <Link
                  className="button button-secondary"
                  href={`/store/${shop.subdomain}#store-reviews`}
                  target="_blank"
                >
                  View storefront <ArrowUpRight size={16} />
                </Link>
              )}
              <Button
                variant="secondary"
                disabled={!shopId || loading}
                onClick={refresh}
              >
                <RefreshCw size={16} className={loading ? "spin" : undefined} />
                Refresh
              </Button>
            </>
          }
        />
      }
    >
      {!shopId ? (
        <section className="review-empty">
          <ReviewIllustration />
          <h2>A home for your customer feedback</h2>
          <p>Set up your shop to manage verified reviews and public replies.</p>
          <Link href="/onboarding" className="button button-primary">
            Set up your shop
          </Link>
        </section>
      ) : (
        <>
          <div className="review-overview" aria-label="Review summary">
            <div>
              <span>Average rating</span>
              <strong>
                {reviews ? average : "—"}
                <Star size={22} aria-hidden />
              </strong>
              <small>
                {total
                  ? "Out of 5 · latest 100 reviews"
                  : "Your first rating will appear here"}
              </small>
            </div>
            <div>
              <span>Verified reviews</span>
              <strong>{reviews ? total : "—"}</strong>
              <small>Across your store and products</small>
            </div>
            <div>
              <span>Needs a reply</span>
              <strong>{reviews ? unanswered : "—"}</strong>
              <small>
                {total && !unanswered
                  ? "You’re all caught up"
                  : "A personal reply makes a difference"}
              </small>
            </div>
          </div>
          <div className="review-workspace-columns">
            <section
              className="review-main-panel"
              aria-label="Customer reviews"
            >
              <div className="review-filter-tabs" aria-label="Review type">
                {filters.map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                    {value === "unanswered" && reviews && (
                      <span>{unanswered}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="review-tools">
                <SearchInput
                  label="Search reviews"
                  placeholder="Search name, product or review…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onClear={() => setQuery("")}
                />
                <Select
                  label="Rating"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                >
                  <option value="all">All ratings</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "star" : "stars"}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Sort by"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="newest">Newest first</option>
                  <option value="lowest">Lowest rating</option>
                  <option value="highest">Highest rating</option>
                </Select>
              </div>
              {error && (
                <div className="review-error" role="alert">
                  {error} {reviews && "Showing the last loaded reviews."}
                  <Button variant="ghost" disabled={loading} onClick={refresh}>
                    Try again
                  </Button>
                </div>
              )}
              {notice && (
                <p className="review-published" role="status">
                  <Check size={16} />
                  {notice}
                </p>
              )}
              {loading && !reviews ? (
                <div className="review-loading" role="status">
                  <span className="review-skeleton" />
                  <span className="review-skeleton" />
                  Loading verified reviews…
                </div>
              ) : reviews && total === 0 ? (
                <div className="review-empty">
                  <ReviewIllustration />
                  <h2>Your next chapter starts with a review</h2>
                  <p>
                    Genuine feedback from your customers will live here. Read
                    their experience, understand what matters, and reply as your
                    shop.
                  </p>
                  <div className="review-empty-caption">
                    <ShieldCheck size={16} />
                    Verified feedback. Real conversations.
                  </div>
                  {shop?.status === "launched" ? (
                    <Link
                      className="button button-primary"
                      href={`/store/${shop.subdomain}#store-reviews`}
                      target="_blank"
                    >
                      View your review section <ArrowUpRight size={16} />
                    </Link>
                  ) : (
                    <Link className="button button-primary" href="/website">
                      Open Store Design
                    </Link>
                  )}
                </div>
              ) : reviews && visible.length === 0 ? (
                <div className="review-empty review-no-results">
                  <Search size={28} />
                  <h2>No reviews match these filters</h2>
                  <p>Try another name, rating or review type.</p>
                  <Button variant="secondary" onClick={resetFilters}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="review-card-list">
                  {visible.map((r) => (
                    <ReviewCard
                      key={r.id}
                      review={r}
                      shopId={shopId}
                      onReply={(reply) => {
                        setReviews(
                          (current) =>
                            current?.map((item) =>
                              item.id === r.id ? { ...item, reply } : item,
                            ) ?? null,
                        );
                        setNotice(
                          "Your reply is now visible on the storefront.",
                        );
                      }}
                    />
                  ))}
                </div>
              )}
              {reviews && total > 0 && (
                <div className="review-list-footer">
                  Showing {visible.length} of {total} loaded reviews · latest
                  100
                </div>
              )}
            </section>
            <aside className="review-context">
              <section className="review-context-panel">
                <h2>Rating breakdown</h2>
                <p>From the latest 100 reviews</p>
                <div className="review-distribution">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const count =
                      reviews?.filter((r) => r.rating === n).length ?? 0;
                    return (
                      <div key={n}>
                        <span>
                          {n}
                          <Star size={12} aria-hidden />
                        </span>
                        <progress
                          value={count}
                          max={total || 1}
                          aria-label={`${n} stars: ${count} reviews`}
                        />
                        <span>{reviews ? count : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="review-context-panel review-trust-panel">
                <ShieldCheck size={22} />
                <h2>Trust begins with real feedback</h2>
                <p>
                  Only buyers with a delivered-order receipt can leave a review.
                </p>
                {!commerceUi.orders && (
                  <p>
                    Checkout is currently hidden. Existing eligible receipts
                    still work; WhatsApp and Messenger conversations alone do
                    not verify a purchase.
                  </p>
                )}
                <div className="review-context-rule" />
                <h3>A thoughtful reply goes a long way</h3>
                <p>
                  Thank the buyer, address their experience, and keep private
                  details out of your public reply.
                </p>
                <small>
                  Buyer ratings and reviews cannot be edited or removed here.
                </small>
              </section>
            </aside>
          </div>
        </>
      )}
    </PageShell>
  );
}
function ReviewIllustration() {
  return (
    <div className="review-empty-art" aria-hidden>
      <MessageSquare size={38} strokeWidth={1.3} />
      <span>
        <Star size={16} fill="currentColor" />
      </span>
    </div>
  );
}
function ReviewCard({
  review: r,
  shopId,
  onReply,
}: {
  review: Review;
  shopId: string;
  onReply: (reply: NonNullable<Review["reply"]>) => void;
}) {
  const [editing, setEditing] = useState(false),
    [text, setText] = useState(""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (text.trim().length < 2) {
      setError("Write a reply of at least 2 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await apiRequest<{ reply: NonNullable<Review["reply"]> }>(
        `reviews/${shopId}/${r.id}/reply`,
        { method: "PATCH", body: { text: text.trim() } },
      );
      onReply(result.reply);
      setEditing(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not publish your reply. Your draft is still here.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <article className="review-item">
      <div className="review-item-heading">
        <span className="review-person-avatar" aria-hidden>
          {r.name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h2>{r.name}</h2>
          <span className="review-verification">
            <ShieldCheck size={13} />
            Verified purchase
          </span>
        </div>
        <time dateTime={r.createdAt}>
          {new Date(r.createdAt).toLocaleDateString("en", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      </div>
      <div className="review-item-meta">
        <span
          className="review-rating-stars"
          role="img"
          aria-label={`${r.rating} out of 5 stars`}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={15}
              fill={n <= r.rating ? "currentColor" : "none"}
              aria-hidden
            />
          ))}
        </span>
        <span className="review-target">{r.productName || "Store review"}</span>
        <span className={`review-reply-state ${r.reply ? "is-replied" : ""}`}>
          {r.reply ? "Replied" : "Needs a reply"}
        </span>
      </div>
      <p className="review-customer-text">{r.text}</p>
      {r.reply && !editing && (
        <div className="review-existing-reply">
          <CornerDownRight size={17} />
          <div>
            <strong>Your public reply</strong>
            <p>{r.reply.text}</p>
          </div>
        </div>
      )}
      {editing ? (
        <form className="review-reply-form" onSubmit={save}>
          <Textarea
            label={`Public reply to ${r.name}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            minLength={2}
            maxLength={1500}
            rows={4}
            hint={`${text.length} / 1,500 characters · Visible to everyone on your storefront`}
          />
          <div>
            <Button type="submit" loading={saving}>
              Publish reply
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
          {error && (
            <p role="alert" className="review-error">
              {error}
            </p>
          )}
        </form>
      ) : (
        <Button
          variant="ghost"
          onClick={() => {
            setText(r.reply?.text || "");
            setEditing(true);
            setError("");
          }}
        >
          <MessageSquare size={15} />
          {r.reply ? "Edit reply" : "Write a reply"}
        </Button>
      )}
    </article>
  );
}
