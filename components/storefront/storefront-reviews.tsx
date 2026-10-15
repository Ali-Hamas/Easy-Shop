"use client";
import { useEffect, useState } from "react";
import { Star, MessageSquare, Check, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/api/client";
import { Input, Textarea } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
type Review = {
  id: string;
  name: string;
  rating: number;
  text: string;
  createdAt: string;
  purchaseVerified: true;
  reply: { text: string; at: string } | null;
};
type Reviews = {
  reviews: Review[];
  count: number;
  average: number | null;
  distribution: { rating: number; count: number }[];
  page: number;
  hasMore: boolean;
};
export function StorefrontReviews({
  subdomain,
  name,
  published,
  productId,
}: {
  subdomain: string;
  name: string;
  published: boolean;
  productId?: string;
}) {
  const [data, setData] = useState<Reviews | null>(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [page, setPage] = useState(1),
    [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [sent, setSent] = useState(false),
    [formError, setFormError] = useState("");
  const [author, setAuthor] = useState(""),
    [rating, setRating] = useState(0),
    [text, setText] = useState(""),
    [orderId, setOrderId] = useState(""),
    [phone, setPhone] = useState(""),
    [receiptKey, setReceiptKey] = useState("");
  function toggleForm() {
    setOpen((v) => !v);
    setFormError("");
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(`receipt:${subdomain}`) || "null",
      );
      if (saved) {
        setOrderId(saved.orderId);
        setPhone(saved.phone);
        setReceiptKey(saved.receiptKey);
      }
    } catch {}
  }
  useEffect(() => {
    if (!published) return;
    const controller = new AbortController();
    apiRequest<Reviews>(
      `storefront/${subdomain}/reviews?page=${page}${productId ? `&productId=${productId}` : ""}`,
      {
        signal: controller.signal,
      },
    )
      .then((v) => {
        if (!controller.signal.aborted) {
          setData(v);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [subdomain, published, page, reload, productId]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) {
      setFormError("Choose a star rating before submitting.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await apiRequest(`storefront/${subdomain}/reviews`, {
        method: "POST",
        body: {
          name: author,
          rating,
          text,
          orderId,
          phone,
          receiptKey,
          ...(productId ? { productId } : {}),
        },
      });
      setSent(true);
      setOpen(false);
      setPage(1);
      setReload((n) => n + 1);
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : "Could not save your review. Your text is still here.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className="store-reviews"
      id="store-reviews"
      aria-labelledby="reviews-title"
    >
      <div className="store-reviews-heading">
        <div>
          <span>Experiences with {name}</span>
          <h2 id="reviews-title">
            {productId ? "Product reviews" : "Store reviews"}
          </h2>
        </div>
        <button
          className="review-write"
          onClick={toggleForm}
          disabled={!published || sent}
          aria-expanded={open}
        >
          <MessageSquare size={17} />
          {sent
            ? "Review submitted"
            : open
              ? "Close review form"
              : "Write a review"}
        </button>
      </div>
      {!published ? (
        <p>Reviews open when this shop launches.</p>
      ) : (
        <>
          {sent && (
            <p className="review-success" role="status">
              <Check size={18} />
              Thank you. Your review is now on the storefront.
            </p>
          )}
          {open && (
            <form className="review-form" onSubmit={submit}>
              <div>
                <h3>How was your experience?</h3>
                <p>
                  Your name, rating and review will be public. Please leave out
                  phone numbers, order details and other private information.
                  Only buyers with a delivered order and their private receipt
                  key can review. No account is needed.
                </p>
              </div>
              <fieldset disabled={saving}>
                <legend className="sr-only">
                  {productId
                    ? "Your review of the product"
                    : "Your review of the seller"}
                </legend>
                <Input
                  label="Order reference"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  required
                  autoComplete="off"
                />
                <Input
                  label="Checkout phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  type="tel"
                />
                <Input
                  label="Private receipt key"
                  value={receiptKey}
                  onChange={(e) => setReceiptKey(e.target.value)}
                  required
                  type="password"
                  autoComplete="off"
                  hint="Saved with your checkout receipt. This key stays private."
                />
                <fieldset className="review-rating">
                  <legend>Your rating</legend>
                  <div>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n}>
                        <input
                          type="radio"
                          name="seller-rating"
                          value={n}
                          checked={rating === n}
                          onChange={() => setRating(n)}
                        />
                        <span>
                          <Star
                            size={27}
                            fill={n <= rating ? "currentColor" : "none"}
                          />
                          <span className="sr-only">
                            {n} {n === 1 ? "star" : "stars"}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Input
                  label="Public display name"
                  required
                  minLength={2}
                  maxLength={60}
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
                <Textarea
                  label="Your review"
                  required
                  minLength={10}
                  maxLength={1500}
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  hint="Describe your experience with the seller (10–1,500 characters)."
                />
                {formError && (
                  <p role="alert" className="review-error">
                    {formError}
                  </p>
                )}
                <Button type="submit" loading={saving}>
                  Publish review
                </Button>
              </fieldset>
            </form>
          )}
          {error ? (
            <div role="alert">
              <p>{error}</p>
              <button
                className="review-write"
                onClick={() => setReload((n) => n + 1)}
              >
                Try loading reviews again
              </button>
            </div>
          ) : !data ? (
            <p role="status">Loading reviews…</p>
          ) : (
            <div className="review-layout">
              <aside className="store-review-summary">
                <div className="review-score">
                  {data.average === null ? "—" : data.average.toFixed(1)}
                  <Star size={28} fill="currentColor" />
                </div>
                <p>
                  {data.count
                    ? `${data.count} ${data.count === 1 ? "review" : "reviews"}`
                    : "No reviews yet"}
                </p>
                <div className="review-bars">
                  {data.distribution.map((d) => (
                    <div key={d.rating}>
                      <span>
                        {d.rating}
                        <Star size={11} />
                      </span>
                      <progress
                        value={d.count}
                        max={data.count || 1}
                        aria-label={`${d.rating} stars: ${d.count} reviews`}
                      />
                      <span>{d.count}</span>
                    </div>
                  ))}
                </div>
                <small>
                  Reviews from delivered orders.
                  <br />
                  Receipt credentials are checked.
                </small>
              </aside>
              <div className="review-list">
                {!data.count ? (
                  <div className="review-empty">
                    <MessageSquare size={30} strokeWidth={1.3} />
                    <h3>The first word could be yours.</h3>
                    <p>
                      Have an experience with this shop? Help other visitors by
                      sharing it.
                    </p>
                    <button className="review-text-button" onClick={toggleForm}>
                      Leave the first review <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  data.reviews.map((r) => (
                    <article key={r.id} className="review-card">
                      <div className="review-card-top">
                        <span className="review-avatar" aria-hidden>
                          {r.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <h3>{r.name}</h3>
                          <span>Verified purchase</span>
                        </div>
                        <time dateTime={r.createdAt}>
                          {new Date(r.createdAt).toLocaleDateString("en", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </time>
                      </div>
                      <div
                        className="review-stars"
                        role="img"
                        aria-label={`${r.rating} out of 5 stars`}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            size={14}
                            aria-hidden
                            fill={n <= r.rating ? "currentColor" : "none"}
                          />
                        ))}
                      </div>
                      <p>{r.text}</p>
                      {r.reply && (
                        <div className="review-seller-reply">
                          <strong>Reply from {name}</strong>
                          <p>{r.reply.text}</p>
                        </div>
                      )}
                    </article>
                  ))
                )}
                {data.count > 6 && (
                  <nav className="review-pagination" aria-label="Review pages">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((n) => n - 1)}
                    >
                      Previous
                    </button>
                    <span>Page {data.page}</span>
                    <button
                      disabled={!data.hasMore}
                      onClick={() => setPage((n) => n + 1)}
                    >
                      Next
                    </button>
                  </nav>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
