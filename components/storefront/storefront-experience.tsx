"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { Dialog } from "radix-ui";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Store,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Search,
  X,
  Truck,
  RotateCcw,
  CreditCard,
  Plus,
  Minus,
  Check,
  MessageCircle,
} from "lucide-react";
import { StorefrontChat } from "./storefront-chat";
import { storefrontService } from "@/services/commerce";
import { ApiError } from "@/lib/api/client";
import { formatMoney, productPath } from "@/adapters/commerce";
import type { PublicStore, ProductDetail } from "@/types/commerce";
import "@/styles/storefront.css";

type CartItem = {
  productId: string;
  productName: string;
  slug?: string;
  variantId?: string;
  variantTitle?: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
};

function ProductVisual({
  url,
  name,
  className,
}: {
  url: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const valid =
    !!url &&
    (/^https?:\/\//i.test(url) ||
      url.startsWith("data:image/") ||
      url.startsWith("/uploads/") ||
      url.startsWith("/"));

  return (
    <div className={`buyer-product-visual ${className || ""}`}>
      {valid && !failed ? (
        <img
          src={url!}
          alt={name}
          className="buyer-product-visual-img"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="buyer-visual-fallback">
          <Package size={44} strokeWidth={1.2} />
          <span>{name}</span>
        </div>
      )}
    </div>
  );
}

export default function StorefrontExperience({
  subdomain,
  slug,
  expectedId,
}: {
  subdomain: string;
  slug?: string;
  expectedId?: string;
}) {
  const reduced = useMotionPreference();
  const [store, setStore] = useState<PublicStore | null>(null);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [variant, setVariant] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  // Search & category filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Cart state
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  const isPreview = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("preview") === "true";
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        if (slug) {
          const [catalog, detail] = await Promise.all([
            storefrontService.get(subdomain, controller.signal, isPreview),
            storefrontService.product(
              subdomain,
              slug,
              controller.signal,
              isPreview,
              expectedId,
            ),
          ]);
          if (expectedId && detail.product.id !== expectedId) {
            throw new ApiError(
              404,
              "PRODUCT_NOT_FOUND",
              "This product is not available at this address.",
            );
          }
          setStore(catalog);
          setProduct(detail.product);
          setVariant(detail.product.variants[0]?.id ?? "");
          setQuantity(1);
          setActiveImageIndex(0);
        } else {
          setStore(
            await storefrontService.get(
              subdomain,
              controller.signal,
              isPreview,
            ),
          );
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e as ApiError);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [subdomain, slug, expectedId, version, isPreview]);

  const selectedVariant = useMemo(() => {
    return product?.variants.find((v) => v.id === variant) ?? product?.variants[0];
  }, [product, variant]);

  // Derived real categories
  const realCategories = useMemo(() => {
    if (!store?.products) return [];
    return Array.from(
      new Set(
        store.products
          .map((p) => p.category)
          .filter(Boolean),
      ),
    ) as string[];
  }, [store]);

  // Filtered products for catalog
  const filteredProducts = useMemo(() => {
    if (!store?.products) return [];
    return store.products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q));
      const matchesCategory =
        !selectedCategory || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [store, searchQuery, selectedCategory]);

  const cartCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  function addToCart(
    item: {
      productId: string;
      productName: string;
      slug?: string;
      variantId?: string;
      variantTitle?: string;
      price: number;
      imageUrl: string | null;
    },
    qty = 1,
  ) {
    setCartItems((prev) => {
      const existing = prev.find(
        (i) => i.productId === item.productId && i.variantId === item.variantId,
      );
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId && i.variantId === item.variantId
            ? { ...i, quantity: i.quantity + qty }
            : i,
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
    setAddedNotice(`Added "${item.productName}" to your bag.`);
    setTimeout(() => setAddedNotice(null), 3500);
    setCartOpen(true);
  }

  function updateCartQuantity(productId: string, variantId: string | undefined, delta: number) {
    setCartItems((prev) =>
      prev
        .map((i) => {
          if (i.productId === productId && i.variantId === variantId) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[],
    );
  }

  function removeFromCart(productId: string, variantId?: string) {
    setCartItems((prev) =>
      prev.filter(
        (i) => !(i.productId === productId && i.variantId === variantId),
      ),
    );
  }

  const shopInitials = store?.shop.displayName
    ? store.shop.displayName
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "ES";

  return (
    <div className="buyer-site">
      {/* Floating Chat Assistant */}
      {store && !loading && (
        <StorefrontChat
          subdomain={subdomain}
          shopName={store.shop.displayName}
        />
      )}

      {/* Store Preview Banner when in Draft mode */}
      {store?.shop.status === "draft" && (
        <aside className="store-preview-banner" aria-label="Store Preview Mode">
          <div className="store-preview-banner-inner">
            <span className="store-preview-tag">Draft Preview</span>
            <p className="store-preview-text">
              This shop is currently in draft. Complete setup from your seller dashboard to launch it for buyers.
            </p>
            <div className="store-preview-actions">
              <Link href="/onboarding" className="store-preview-dash-link">
                Launch Shop <ArrowRight size={13} />
              </Link>
              <Link href="/dashboard" className="store-preview-dash-link">
                Seller Dashboard
              </Link>
            </div>
          </div>
        </aside>
      )}

      {/* Store Header */}
      <header className="buyer-header">
        <div className="buyer-header-left">
          <Link
            href={`/store/${encodeURIComponent(subdomain)}`}
            className="buyer-brand-group"
          >
            <span className="buyer-brand-monogram">{shopInitials}</span>
            <div className="buyer-brand-text">
              <span className="buyer-brand-name buyer-brand-title">
                {store?.shop.displayName ?? "Storefront"}
              </span>
              <span className="buyer-brand-badge">
                {store?.shop.category
                  ? `${store.shop.category} · ${store.shop.country}`
                  : "Independent Boutique"}
              </span>
            </div>
          </Link>
        </div>

        <div className="buyer-header-right">
          {/* Search Trigger */}
          {!slug ? (
            <div className="buyer-search-input-wrap">
              <Search size={15} aria-hidden />
              <input
                type="text"
                placeholder="Search products…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="buyer-search-input"
                aria-label="Search products in store"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="buyer-search-clear"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ) : (
            <Link href={`/store/${encodeURIComponent(subdomain)}`} className="buyer-link">
              Browse products
            </Link>
          )}

          {/* Cart / Bag Button */}
          <button
            type="button"
            className="buyer-bag-button buyer-bag-btn"
            onClick={() => setCartOpen(true)}
            aria-label={`Shopping bag with ${cartCount} items`}
          >
            <ShoppingBag size={18} />
            <span className="buyer-bag-label">Bag</span>
            <span className="buyer-bag-badge" aria-hidden>
              {cartCount}
            </span>
          </button>
        </div>
      </header>

      {/* Added to Bag Toast Notification */}
      <AnimatePresence>
        {addedNotice && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="buyer-toast"
            role="status"
          >
            <Check size={16} />
            <span>{addedNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="store-content">
        {loading ? (
          <div className="buyer-state" role="status">
            <Store size={36} strokeWidth={1.3} />
            <h1>Opening {subdomain}…</h1>
            <p>Loading the latest published catalog and shop details.</p>
          </div>
        ) : error ? (
          <div className="buyer-state" role="alert">
            <Store size={36} strokeWidth={1.3} />
            <h1>
              {error.status === 404
                ? slug
                  ? "This product isn’t available."
                  : "This shop isn’t open here."
                : "The shop is taking a moment."}
            </h1>
            <p>
              {error.status === 404
                ? slug
                  ? "The product may be unavailable or the address may have changed."
                  : "Check the shop address. Only published shops appear here."
                : error.message}
            </p>
            {error.status !== 404 && (
              <button
                className="buyer-button"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setVersion((v) => v + 1);
                }}
              >
                <RefreshCw size={16} /> Try again
              </button>
            )}
            {slug && (
              <Link
                href={`/store/${encodeURIComponent(subdomain)}`}
                className="buyer-link"
              >
                <ArrowLeft size={15} /> Back to shop
              </Link>
            )}
          </div>
        ) : store && product ? (
          /* ===================================================
             PRODUCT DETAIL EXPERIENCE
             =================================================== */
          <div className="buyer-detail-container">
            <nav className="buyer-breadcrumb" aria-label="Breadcrumb">
              <Link href={`/store/${subdomain}`}>
                <ArrowLeft size={14} /> All products
              </Link>
              <span aria-hidden>·</span>
              <span>{product.name}</span>
            </nav>

            <section className="buyer-detail">
              <div className="buyer-gallery-container">
                {(() => {
                  const productImages = (
                    product.images && product.images.length > 0
                      ? product.images
                      : [product.imageUrl]
                  ).filter(Boolean) as string[];

                  const activeSrc =
                    productImages[activeImageIndex] ??
                    product.imageUrl ??
                    null;

                  return (
                    <div className="buyer-gallery-wrapper">
                      {/* Main Featured Image Display */}
                      <div className="buyer-gallery-main-view">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeSrc || "main"}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="buyer-gallery-main-motion"
                          >
                            <ProductVisual
                              url={activeSrc}
                              name={product.name}
                              className="buyer-detail-visual"
                            />
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {/* Small Thumbnail Boxes below main image if multiple images exist */}
                      {productImages.length > 1 && (
                        <div
                          className="buyer-gallery-thumbnails"
                          role="tablist"
                          aria-label="Product image thumbnails"
                        >
                          {productImages.map((thumbUrl, idx) => {
                            const isCurrent = idx === activeImageIndex;
                            return (
                              <button
                                key={idx}
                                type="button"
                                role="tab"
                                aria-selected={isCurrent}
                                aria-label={`View photo ${idx + 1}`}
                                className={`buyer-gallery-thumb-btn ${isCurrent ? "active" : ""}`}
                                onClick={() => setActiveImageIndex(idx)}
                              >
                                <img
                                  src={thumbUrl}
                                  alt={`${product.name} thumbnail ${idx + 1}`}
                                  className="buyer-gallery-thumb-img"
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="buyer-detail-copy">
                <span className="buyer-overline">
                  {store.shop.category || "Curated"} · {store.shop.country}
                </span>

                <h1 className="buyer-product-headline buyer-detail-title">{product.name}</h1>

                <div className="buyer-price-row">
                  <span className="buyer-main-price buyer-detail-price">
                    {formatMoney(
                      selectedVariant?.price ?? product.price,
                      product.currency,
                    )}
                  </span>
                  <span className="buyer-currency-tag">{product.currency}</span>
                </div>

                {/* Stock Indicator */}
                <div className="buyer-stock-status buyer-detail-stock">
                  <span
                    className={`buyer-stock-dot ${
                      selectedVariant && selectedVariant.stock > 0
                        ? selectedVariant.stock <= 5
                          ? "low"
                          : "available"
                        : "out"
                    }`}
                  />
                  <strong>
                    {selectedVariant
                      ? selectedVariant.stock > 0
                        ? selectedVariant.stock <= 5
                          ? `Low stock · Only ${selectedVariant.stock} remaining`
                          : `In stock · ${selectedVariant.stock} units available`
                        : "Currently out of stock"
                      : "No active stock"}
                  </strong>
                </div>

                {/* Variant Selector */}
                {product.variants.length > 1 && (
                  <div className="buyer-variants-section">
                    <span className="buyer-variants-title">Select Option</span>
                    <div className="buyer-variant-buttons" role="radiogroup">
                      {product.variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          role="radio"
                          aria-checked={variant === v.id}
                          className={`buyer-variant-card ${
                            variant === v.id ? "active" : ""
                          }`}
                          onClick={() => {
                            setVariant(v.id);
                            if (quantity > v.stock && v.stock > 0) {
                              setQuantity(v.stock);
                            }
                          }}
                        >
                          <span className="variant-card-title">{v.title}</span>
                          <span className="variant-card-stock">
                            {v.stock > 0 ? `${v.stock} in stock` : "Out of stock"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity and Add to Bag */}
                <div className="buyer-purchase-actions">
                  <div className="buyer-qty-selector" aria-label="Select quantity">
                    <button
                      type="button"
                      disabled={quantity <= 1}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="buyer-qty-display">{quantity}</span>
                    <button
                      type="button"
                      disabled={
                        selectedVariant
                          ? quantity >= selectedVariant.stock
                          : false
                      }
                      onClick={() =>
                        setQuantity((q) =>
                          selectedVariant
                            ? Math.min(selectedVariant.stock, q + 1)
                            : q + 1,
                        )
                      }
                      aria-label="Increase quantity"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!selectedVariant || selectedVariant.stock <= 0}
                    onClick={() =>
                      addToCart(
                        {
                          productId: product.id,
                          productName: product.name,
                          slug: product.slug,
                          variantId: selectedVariant?.id,
                          variantTitle: selectedVariant?.title,
                          price: selectedVariant?.price ?? product.price,
                          imageUrl: product.imageUrl,
                        },
                        quantity,
                      )
                    }
                    className="buyer-add-to-bag-button buyer-add-to-bag-btn"
                  >
                    <ShoppingBag size={18} />
                    <span>
                      {selectedVariant && selectedVariant.stock > 0
                        ? `Add to Bag · ${formatMoney(
                            (selectedVariant.price ?? product.price) * quantity,
                            product.currency,
                          )}`
                        : "Out of Stock"}
                    </span>
                  </button>
                </div>

                {/* Description */}
                {product.description && (
                  <div className="buyer-description-wrap">
                    <h3>About this piece</h3>
                    <p className="buyer-description">{product.description}</p>
                  </div>
                )}

                {/* Policy Highlights */}
                <div className="buyer-policies-grid">
                  <div className="buyer-policy-card">
                    <Truck size={18} />
                    <div>
                      <strong>Delivery</strong>
                      <span>
                        {store.shop.policyDefaults.deliveryCharge === 0
                          ? "Free delivery on orders"
                          : `${formatMoney(
                              store.shop.policyDefaults.deliveryCharge,
                              store.shop.currency,
                            )} standard charge`}
                      </span>
                    </div>
                  </div>

                  <div className="buyer-policy-card">
                    <RotateCcw size={18} />
                    <div>
                      <strong>Returns & Exchange</strong>
                      <span>
                        {store.shop.policyDefaults.returnDays} days return window
                      </span>
                    </div>
                  </div>

                  <div className="buyer-policy-card">
                    <CreditCard size={18} />
                    <div>
                      <strong>Payment</strong>
                      <span>
                        {store.shop.policyDefaults.codAllowed
                          ? "Cash on delivery available"
                          : "Direct electronic payment"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : store ? (
          /* ===================================================
             STOREFRONT CATALOG (1 vs 2-4 vs 5+ Products)
             =================================================== */
          <>
            {/* Storefront Hero / Introduction */}
            <motion.section
              className="buyer-hero"
              initial={{ opacity: 0, y: reduced ? 0 : 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="buyer-hero-inner buyer-hero-brand">
                <span className="buyer-hero-badge">
                  Independent Boutique · {store.shop.country}
                </span>

                <h1 className="buyer-hero-title">{store.shop.displayName}</h1>

                <p className="buyer-hero-desc">
                  Curated contemporary essentials, handcrafted with enduring quality and timeless design. Explore the new season collection below.
                </p>

                <div className="buyer-hero-meta">
                  <div className="buyer-hero-meta-item">
                    <span className="meta-dot" />
                    <span>
                      <strong>{store.products.length}</strong>{" "}
                      {store.products.length === 1 ? "curated item" : "curated items"} in catalog
                    </span>
                  </div>
                  <div className="buyer-hero-meta-item">
                    <span className="meta-dot" />
                    <span>
                      Delivery:{" "}
                      <strong>
                        {store.shop.policyDefaults.deliveryCharge === 0
                          ? "Free"
                          : formatMoney(
                              store.shop.policyDefaults.deliveryCharge,
                              store.shop.currency,
                            )}
                      </strong>
                    </span>
                  </div>
                  <div className="buyer-hero-meta-item">
                    <span className="meta-dot" />
                    <span>
                      COD:{" "}
                      <strong>
                        {store.shop.policyDefaults.codAllowed
                          ? "Supported"
                          : "Inquire"}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Catalog Presentation */}
            {store.products.length === 0 ? (
              <section className="buyer-empty">
                <Package size={40} strokeWidth={1.2} />
                <h2>A collection is on its way.</h2>
                <p>
                  This boutique is open, but no active products have been published yet.
                </p>
                {store.shop.status === "draft" && (
                  <Link
                    href="/products"
                    className="buyer-button"
                    style={{ marginTop: 16 }}
                  >
                    Add products in Seller Workspace <ArrowRight size={15} />
                  </Link>
                )}
              </section>
            ) : filteredProducts.length === 0 ? (
              <section className="buyer-empty">
                <Search size={36} strokeWidth={1.2} />
                <h2>No products match “{searchQuery}”.</h2>
                <p>Try searching for a different term or clear your search query.</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="buyer-button"
                >
                  Clear search query
                </button>
              </section>
            ) : filteredProducts.length === 1 && !searchQuery ? (
              /* ===================================================
                 CASE 1: EXACTLY 1 PRODUCT -> LUXURY SPOTLIGHT SHOWCASE
                 =================================================== */
              <section className="buyer-spotlight-section" aria-label="Featured Product Spotlight">
                <div className="buyer-section-heading">
                  <span>Curated Collection</span>
                  <h2>Featured Spotlight</h2>
                </div>

                {(() => {
                  const p = filteredProducts[0];
                  const path = productPath(subdomain, p);
                  return (
                    <article className="buyer-spotlight-card">
                      <div className="buyer-spotlight-visual-wrap">
                        <ProductVisual
                          url={p.imageUrl}
                          name={p.name}
                          className="buyer-spotlight-img"
                        />
                        <span className="buyer-spotlight-tag">In focus</span>
                      </div>

                      <div className="buyer-spotlight-info">
                        <span className="buyer-overline">
                          {store.shop.category || "Independent Piece"}
                        </span>

                        <h3 className="buyer-spotlight-title buyer-spotlight-name">{p.name}</h3>

                        <div className="buyer-spotlight-price-row">
                          <span className="buyer-spotlight-price">
                            {formatMoney(p.price, store.shop.currency)}
                          </span>
                          <span
                            className={`buyer-stock-pill ${
                              p.stock > 0
                                ? p.stock <= 5
                                  ? "low"
                                  : "available"
                                : "out"
                            }`}
                          >
                            {p.stock > 0
                              ? p.stock <= 5
                                ? `Low stock · ${p.stock} left`
                                : `In stock · ${p.stock} available`
                              : "Out of stock"}
                          </span>
                        </div>

                        <p className="buyer-spotlight-subtext">
                          {p.description || `Explore ${p.name} from ${store.shop.displayName}. View the details or ask the seller a question.`}
                        </p>

                        <div className="buyer-spotlight-policies">
                          <div>
                            <Truck size={16} />
                            <span>
                              {store.shop.policyDefaults.deliveryCharge === 0
                                ? "Free delivery"
                                : formatMoney(
                                    store.shop.policyDefaults.deliveryCharge,
                                    store.shop.currency,
                                  )}
                            </span>
                          </div>
                          <div>
                            <RotateCcw size={16} />
                            <span>{store.shop.policyDefaults.returnDays} days return</span>
                          </div>
                          <div>
                            <CreditCard size={16} />
                            <span>
                              {store.shop.policyDefaults.codAllowed
                                ? "Cash on delivery"
                                : "Ask about payment"}
                            </span>
                          </div>
                        </div>

                        <div className="buyer-spotlight-actions">
                          {path && (
                            <Link href={path} className="buyer-spotlight-primary-link buyer-spotlight-detail-btn">
                              View Product Details <ArrowRight size={16} />
                            </Link>
                          )}
                          <button
                            type="button"
                            disabled={p.stock <= 0}
                            onClick={() =>
                              addToCart({
                                productId: p.id,
                                productName: p.name,
                                slug: p.slug,
                                price: p.price,
                                imageUrl: p.imageUrl,
                              })
                            }
                            className="buyer-spotlight-bag-button"
                          >
                            <ShoppingBag size={16} />
                            <span>Add to Bag</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })()}
              </section>
            ) : filteredProducts.length >= 2 && filteredProducts.length <= 4 && !searchQuery ? (
              /* ===================================================
                 CASE 2: 2 TO 4 PRODUCTS -> BALANCED EDITORIAL GRID
                 =================================================== */
              <section className="buyer-curated-section" aria-label="Curated Collection">
                <div className="buyer-collection-toolbar">
                  <div className="buyer-section-heading">
                    <span>Our Collection</span>
                    <h2>The collection ({filteredProducts.length} pieces)</h2>
                  </div>
                  {realCategories.length >= 2 && (
                    <div className="buyer-category-filter-group" role="tablist" aria-label="Filter by category">
                      <button
                        type="button"
                        className={`buyer-category-pill ${!selectedCategory ? "active" : ""}`}
                        onClick={() => setSelectedCategory(null)}
                      >
                        All Products ({store.products.length})
                      </button>
                      {realCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`buyer-category-pill ${selectedCategory === cat ? "active" : ""}`}
                          onClick={() => setSelectedCategory(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="buyer-grid-curated">
                  {filteredProducts.map((p) => {
                    const path = productPath(subdomain, p);
                    return (
                      <motion.article layout key={p.id} initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="buyer-card buyer-card-curated">
                        <div className="buyer-card-media-wrap">
                          <ProductVisual url={p.imageUrl} name={p.name} />
                          <span
                            className={`buyer-stock-pill ${
                              p.stock > 0
                                ? p.stock <= 5
                                  ? "low"
                                  : "available"
                                : "out"
                            }`}
                          >
                            {p.stock > 0
                              ? p.stock <= 5
                                ? `${p.stock} left`
                                : "In stock"
                              : "Out of stock"}
                          </span>
                        </div>

                        <div className="buyer-card-body">
                          <span className="buyer-card-category">
                            {store.shop.category || "Item"}
                          </span>
                          <h3 className="buyer-card-title">
                            {path ? (
                              <Link href={path}>{p.name}</Link>
                            ) : (
                              p.name
                            )}
                          </h3>

                          <div className="buyer-card-price-row">
                            <strong className="buyer-card-price">
                              {formatMoney(p.price, store.shop.currency)}
                            </strong>
                            <small className="buyer-card-units">
                              {p.stock} units
                            </small>
                          </div>

                          <div className="buyer-card-footer">
                            {path && (
                              <Link href={path} className="buyer-card-detail-link">
                                View details <ArrowRight size={14} />
                              </Link>
                            )}
                            <button
                              type="button"
                              disabled={p.stock <= 0}
                              onClick={() =>
                                addToCart({
                                  productId: p.id,
                                  productName: p.name,
                                  slug: p.slug,
                                  price: p.price,
                                  imageUrl: p.imageUrl,
                                })
                              }
                              className="buyer-card-add-btn"
                              aria-label={`Add ${p.name} to bag`}
                            >
                              <ShoppingBag size={14} />
                            </button>
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              </section>
            ) : (
              /* ===================================================
                 CASE 3: 5+ PRODUCTS OR SEARCH FILTER ACTIVE -> STANDARD RESPONSIVE GRID
                 =================================================== */
              <section className="buyer-catalog-section" aria-label="Product Catalog">
                <div className="buyer-collection-toolbar">
                  <div className="buyer-section-heading">
                    <span>Catalog</span>
                    <h2>All Products ({filteredProducts.length})</h2>
                  </div>
                  {realCategories.length >= 2 && (
                    <div className="buyer-category-filter-group" role="tablist" aria-label="Filter by category">
                      <button
                        type="button"
                        className={`buyer-category-pill ${!selectedCategory ? "active" : ""}`}
                        onClick={() => setSelectedCategory(null)}
                      >
                        All Products ({store.products.length})
                      </button>
                      {realCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`buyer-category-pill ${selectedCategory === cat ? "active" : ""}`}
                          onClick={() => setSelectedCategory(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="buyer-catalog-grid">
                  {filteredProducts.map((p) => {
                    const path = productPath(subdomain, p);
                    return (
                      <motion.article layout key={p.id} initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="buyer-card">
                        <div className="buyer-card-media-wrap">
                          <ProductVisual url={p.imageUrl} name={p.name} />
                          <span
                            className={`buyer-stock-pill ${
                              p.stock > 0
                                ? p.stock <= 5
                                  ? "low"
                                  : "available"
                                : "out"
                            }`}
                          >
                            {p.stock > 0
                              ? p.stock <= 5
                                ? `${p.stock} left`
                                : "In stock"
                              : "Out of stock"}
                          </span>
                        </div>

                        <div className="buyer-card-body">
                          <span className="buyer-card-category">
                            {store.shop.category || "Item"}
                          </span>
                          <h3 className="buyer-card-title">
                            {path ? (
                              <Link href={path}>{p.name}</Link>
                            ) : (
                              p.name
                            )}
                          </h3>

                          <div className="buyer-card-price-row">
                            <strong className="buyer-card-price">
                              {formatMoney(p.price, store.shop.currency)}
                            </strong>
                            <small className="buyer-card-units">
                              {p.stock} available
                            </small>
                          </div>

                          <div className="buyer-card-footer">
                            {path && (
                              <Link href={path} className="buyer-card-detail-link">
                                Details <ArrowRight size={14} />
                              </Link>
                            )}
                            <button
                              type="button"
                              disabled={p.stock <= 0}
                              onClick={() =>
                                addToCart({
                                  productId: p.id,
                                  productName: p.name,
                                  slug: p.slug,
                                  price: p.price,
                                  imageUrl: p.imageUrl,
                                })
                              }
                              className="buyer-card-add-btn"
                              aria-label={`Add ${p.name} to bag`}
                            >
                              <ShoppingBag size={14} />
                            </button>
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Store Policies & Trust Strip */}
            <section className="buyer-policies-strip">
              <div className="buyer-policy-box">
                <Truck size={22} strokeWidth={1.3} />
                <h3>Fast Delivery</h3>
                <p>
                  {store.shop.policyDefaults.deliveryCharge === 0
                    ? "Complimentary delivery on all orders."
                    : `${formatMoney(
                        store.shop.policyDefaults.deliveryCharge,
                        store.shop.currency,
                      )} flat rate delivery.`}
                </p>
              </div>

              <div className="buyer-policy-box">
                <RotateCcw size={22} strokeWidth={1.3} />
                <h3>Clear Returns</h3>
                <p>
                  {store.shop.policyDefaults.returnDays} days return and replacement
                  policy for buyer confidence.
                </p>
              </div>

              <div className="buyer-policy-box">
                <CreditCard size={22} strokeWidth={1.3} />
                <h3>Payment Methods</h3>
                <p>
                  {store.shop.policyDefaults.codAllowed
                    ? "Cash on delivery available upon package arrival."
                    : "Ask the seller about accepted payment methods."}
                </p>
              </div>

              <div className="buyer-policy-box">
                <ShieldCheck size={22} strokeWidth={1.3} />
                <h3>Contact the shop</h3>
                <p>
                  Ask the seller about products before placing an order.
                </p>
              </div>
            </section>
          </>
        ) : null}
      </main>

      {/* Cart Drawer */}
      <Dialog.Root open={cartOpen} onOpenChange={setCartOpen}>
      <AnimatePresence>
        {cartOpen && (
          <>
            <Dialog.Overlay forceMount asChild><motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="buyer-cart-backdrop"
              onClick={() => setCartOpen(false)}
              aria-hidden
            /></Dialog.Overlay>
            <Dialog.Content forceMount asChild aria-describedby={undefined}><motion.aside
              initial={{ x: reduced ? 0 : "100%" }}
              animate={{ x: 0 }}
              exit={{ x: reduced ? 0 : "100%" }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="buyer-cart-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Shopping Bag"
            >
              <div className="buyer-cart-header">
                <div>
                  <Dialog.Title asChild><h2>Shopping Bag</h2></Dialog.Title>
                  <span>
                    {cartCount} {cartCount === 1 ? "item" : "items"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="buyer-cart-close buyer-cart-close-btn"
                  aria-label="Close shopping bag"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="buyer-cart-content">
                {cartItems.length === 0 ? (
                  <div className="buyer-cart-empty">
                    <ShoppingBag size={40} strokeWidth={1.2} />
                    <p>Your shopping bag is empty.</p>
                    <button
                      type="button"
                      onClick={() => setCartOpen(false)}
                      className="buyer-button"
                    >
                      Explore the collection
                    </button>
                  </div>
                ) : (
                  <ul className="buyer-cart-list">
                    {cartItems.map((item) => (
                      <li
                        key={`${item.productId}-${item.variantId ?? "default"}`}
                        className="buyer-cart-item"
                      >
                        <div className="buyer-cart-thumb">
                          {item.imageUrl ? (
                            <Image
                              unoptimized
                              width={80}
                              height={80}
                              src={item.imageUrl}
                              alt={item.productName}
                            />
                          ) : (
                            <Package size={22} />
                          )}
                        </div>

                        <div className="buyer-cart-item-details">
                          <strong className="buyer-cart-item-title">{item.productName}</strong>
                          {item.variantTitle && (
                            <small>{item.variantTitle}</small>
                          )}
                          <span className="buyer-cart-item-price">
                            {formatMoney(
                              item.price,
                              store?.shop.currency ?? "BDT",
                            )}
                          </span>

                          <div className="buyer-cart-qty-row">
                            <div className="buyer-cart-stepper">
                              <button
                                type="button"
                                onClick={() =>
                                  updateCartQuantity(
                                    item.productId,
                                    item.variantId,
                                    -1,
                                  )
                                }
                                aria-label="Decrease quantity"
                              >
                                <Minus size={12} />
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateCartQuantity(
                                    item.productId,
                                    item.variantId,
                                    1,
                                  )
                                }
                                aria-label="Increase quantity"
                              >
                                <Plus size={12} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                removeFromCart(item.productId, item.variantId)
                              }
                              className="buyer-cart-remove"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {cartItems.length > 0 && (
                <div className="buyer-cart-footer">
                  <div className="buyer-cart-subtotal-row">
                    <span>Subtotal</span>
                    <strong className="buyer-cart-subtotal-val">
                      {formatMoney(
                        cartSubtotal,
                        store?.shop.currency ?? "BDT",
                      )}
                    </strong>
                  </div>

                  <p className="buyer-cart-disclaimer">
                    Your bag is a selection, not a placed order. Confirm availability, payment and delivery with the seller.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setCartOpen(false);
                      const chatLauncher = document.querySelector(
                        ".storefront-chat-launcher",
                      ) as HTMLButtonElement | null;
                      chatLauncher?.click();
                    }}
                    className="buyer-cart-order-btn"
                  >
                    <MessageCircle size={18} />
                    <span>Ask about your bag</span>
                  </button>
                </div>
              )}
            </motion.aside></Dialog.Content>
          </>
        )}
      </AnimatePresence>

      </Dialog.Root>

      {/* Storefront Footer */}
      <footer className="buyer-footer">
        <div className="buyer-footer-top">
          <div>
            <span className="buyer-footer-brand buyer-footer-name">
              {store?.shop.displayName ?? subdomain}
            </span>
            <p className="buyer-footer-tagline">
              {store?.shop.category ? `${store.shop.category} · ` : ""}{store?.shop.country ?? ""}
            </p>
          </div>

          <div className="buyer-footer-policies">
            <span>
              Delivery:{" "}
              {store?.shop.policyDefaults.deliveryCharge === 0
                ? "Free"
                : store?.shop.policyDefaults
                  ? formatMoney(
                      store.shop.policyDefaults.deliveryCharge,
                      store.shop.currency,
                    )
                  : "Standard"}
            </span>
            <span>·</span>
            <span>
              Returns: {store?.shop.policyDefaults.returnDays ?? 3} days
            </span>
            <span>·</span>
            <span>
              COD: {store?.shop.policyDefaults.codAllowed ? "Available" : "Ask the seller"}
            </span>
          </div>
        </div>

        <div className="buyer-footer-bottom">
          <small>© {new Date().getFullYear()} {store?.shop.displayName ?? subdomain}. All rights reserved.</small>
          <Link href="/" className="buyer-powered-link">
            Powered by Easy-Shop
          </Link>
        </div>
      </footer>
    </div>
  );
}
