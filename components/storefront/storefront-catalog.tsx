"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { commerceUi } from "@/config/commerce-ui";
import { formatMoney, productPath } from "@/adapters/commerce";
import type { PublicProduct } from "@/types/commerce";
import { BrandImage } from "./storefront-brand";

export function StorefrontCatalog({
  products,
  subdomain,
  currency,
  previewTheme,
  categories,
  selectedCategory,
  onCategory,
  onAdd,
}: {
  products: PublicProduct[];
  subdomain: string;
  currency: string;
  previewTheme?: string;
  categories: string[];
  selectedCategory: string | null;
  onCategory: (value: string | null) => void;
  onAdd: (product: PublicProduct) => void;
}) {
  const section = useRef<HTMLElement>(null);
  const reduced = useMotionPreference();
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], [12, -12]);
  return (
    <section
      ref={section}
      className="store-catalog"
      aria-label="Product collection"
    >
      {categories.length > 1 && (
        <nav className="store-catalog-filters" aria-label="Filter products">
          {[null, ...categories].map((category) => (
            <button
              key={category ?? "all"}
              type="button"
              aria-pressed={selectedCategory === category}
              onClick={() => onCategory(category)}
            >
              {category || "All products"}
            </button>
          ))}
        </nav>
      )}
      <div className="store-product-grid">
        {products.map((product, index) => {
          const href = productPath(subdomain, product, previewTheme);
          return (
            <motion.article
              className="store-product-card"
              key={product.id}
              initial={reduced ? false : { y: 36 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{
                duration: reduced ? 0 : 0.65,
                delay: reduced ? 0 : (index % 4) * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="store-product-media">
                <motion.div
                  className="store-product-image"
                  style={reduced ? undefined : { y: imageY }}
                >
                  <BrandImage src={product.imageUrl || ""} alt={product.name} />
                </motion.div>
                {href && (
                  <Link
                    href={href}
                    className="store-product-image-link"
                    aria-label={`View ${product.name}`}
                  >
                    <ArrowUpRight size={22} aria-hidden />
                  </Link>
                )}
                <span className="store-product-availability">
                  {product.stock > 0 ? "In stock" : "Out of stock"}
                </span>
              </div>
              <div className="store-product-info">
                {product.category && (
                  <span className="store-product-category">
                    {product.category}
                  </span>
                )}
                <h3>
                  {href ? (
                    <Link href={href}>{product.name}</Link>
                  ) : (
                    product.name
                  )}
                </h3>
                {product.description && (
                  <p className="store-product-description">
                    {product.description}
                  </p>
                )}
                <div className="store-product-bottom">
                  <strong>{formatMoney(product.price, currency)}</strong>
                  {commerceUi.orders && (
                    <button
                      type="button"
                      disabled={product.stock <= 0}
                      aria-label={`Add ${product.name} to bag`}
                      onClick={() => onAdd(product)}
                    >
                      <ShoppingBag size={18} />
                    </button>
                  )}
                </div>
                {href && (
                  <Link className="store-product-details" href={href}>
                    View details <ArrowUpRight size={15} aria-hidden />
                  </Link>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
