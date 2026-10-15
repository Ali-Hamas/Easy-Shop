"use client";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Mail,
  Phone,
  MapPin,
  Plus,
  Package,
  Truck,
  CreditCard,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import type { StorefrontContent } from "@/types/storefront-content";
import type { PublicProduct } from "@/types/commerce";
import { formatMoney, productPath } from "@/adapters/commerce";
import "@/styles/storefront-brand.css";
export function BrandImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <Image
      key={src}
      unoptimized
      src={src}
      alt={alt}
      width={1200}
      height={1000}
      className={className}
      onError={() => setFailed(true)}
    />
  ) : (
    <div className={`brand-image-fallback ${className}`}>
      <Package size={32} />
      <span>{alt}</span>
    </div>
  );
}
export function StorefrontHero({
  content,
  name,
  category,
  image,
}: {
  content: StorefrontContent;
  name: string;
  category?: string;
  image?: string | null;
}) {
  const hero = useRef<HTMLElement>(null);
  const reduced = useMotionPreference();
  const { scrollYProgress } = useScroll({
    target: hero,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const imageFrame = useTransform(
    scrollYProgress,
    [0, 0.65],
    ["inset(0% 0% 0% 0%)", "inset(3% 3% 3% 3%)"],
  );
  const headingY = useTransform(scrollYProgress, [0, 1], [0, -64]);
  const headingScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);
  return (
    <>
      <section
        ref={hero}
        className={`brand-hero ${content.coverImage || image ? "has-image" : "text-only"}`}
      >
        <motion.div
          className="brand-hero-copy"
          style={reduced ? undefined : { y: headingY, scale: headingScale }}
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="brand-category">{category || name}</span>
          <h1>{content.headline || name}</h1>
          {content.description && <p>{content.description}</p>}
          {content.design.sections.includes("catalog") && (
            <a href="#collection" className="brand-shop-link">
              Explore the collection <ArrowDown size={18} />
            </a>
          )}
          <div className="brand-hero-bottom">
            <span className="brand-signature">{name}</span>
            {content.design.sections.includes("reviews") && (
              <a href="#store-reviews">Read customer reviews</a>
            )}
          </div>
        </motion.div>
        {(content.coverImage || image) && (
          <motion.div
            className="brand-hero-image"
            style={reduced ? undefined : { clipPath: imageFrame }}
          >
            <motion.div
              className="brand-cover-motion"
              style={reduced ? undefined : { y, scale }}
            >
              <BrandImage
                key={content.coverImage || image}
                src={content.coverImage || image!}
                alt={content.coverImage ? `${name} collection` : name}
              />
            </motion.div>
            <span>{name}</span>
          </motion.div>
        )}
      </section>
    </>
  );
}
export function StorefrontCollections({
  content,
  products,
  subdomain,
  currency,
  previewTheme,
}: {
  content: StorefrontContent;
  products: PublicProduct[];
  subdomain: string;
  currency: string;
  previewTheme?: string;
}) {
  const sections = [
    ...(content.featuredProductIds.length
      ? [
          {
            title: "Selected by the shop",
            description: "",
            productIds: content.featuredProductIds,
          },
        ]
      : []),
    ...content.collections,
  ];
  return (
    <>
      {sections.map((section, index) => {
        const selected = section.productIds.flatMap((id) => {
          const p = products.find((v) => v.id === id);
          return p ? [p] : [];
        });
        if (!selected.length) return null;
        return (
          <section
            className="brand-collection"
            aria-label={section.title}
            key={`${index}-${section.title}`}
          >
            <div className="brand-section-title">
              <span className="brand-collection-count">
                {selected.length} {selected.length === 1 ? "piece" : "pieces"}
              </span>
              <h2>{section.title}</h2>
              {section.description && <p>{section.description}</p>}
            </div>
            <div className="brand-collection-products">
              {selected.map((p) => (
                <Link
                  className="brand-edit-product"
                  key={p.id}
                  href={
                    productPath(subdomain, p, previewTheme) || "#collection"
                  }
                >
                  <div>
                    <BrandImage
                      key={p.imageUrl}
                      src={p.imageUrl || ""}
                      alt={p.name}
                    />
                    <span>
                      <ArrowUpRight size={18} />
                    </span>
                  </div>
                  <h3>{p.name}</h3>
                  <p>
                    {formatMoney(p.price, currency)}
                    <span>{p.stock > 0 ? "In stock" : "Out of stock"}</span>
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
export function StorefrontDetails({
  content,
  name,
  part,
}: {
  content: StorefrontContent;
  name: string;
  part?: "about" | "policies" | "contact";
}) {
  const contact =
    content.email ||
    content.phone ||
    content.address ||
    content.instagram ||
    content.facebook;
  return (
    <div className="brand-details">
      {(!part || part === "about") && content.story && (
        <section
          id="our-story"
          className={`brand-story ${content.storyImage ? "with-image" : ""}`}
        >
          {content.storyImage && (
            <BrandImage
              key={content.storyImage}
              src={content.storyImage}
              alt={`${name} story`}
            />
          )}
          <div>
            <span>Behind {name}</span>
            <h2>{content.storyTitle || "Our story"}</h2>
            <p>{content.story}</p>
          </div>
        </section>
      )}
      {(!part || part === "policies") &&
        (content.delivery || content.payment || content.returns) && (
          <section
            className="brand-shopping-info"
            aria-label="Shopping information"
          >
            {[
              { title: "Delivery", body: content.delivery, icon: Truck },
              { title: "Payment", body: content.payment, icon: CreditCard },
              { title: "Returns", body: content.returns, icon: RotateCcw },
            ]
              .filter((v) => v.body)
              .map((v) => (
                <div key={v.title}>
                  <v.icon size={24} strokeWidth={1.4} />
                  <h3>{v.title}</h3>
                  <p>{v.body}</p>
                </div>
              ))}
          </section>
        )}
      {(!part || part === "contact") &&
        (content.faqs.length > 0 || contact) && (
          <section className="brand-help" id="store-help">
            <div>
              <span>Here to help</span>
              <h2>
                A question <br />
                before you choose?
              </h2>
              {contact && (
                <address>
                  {content.email && (
                    <a href={`mailto:${content.email}`}>
                      <Mail size={16} />
                      {content.email}
                    </a>
                  )}
                  {content.phone && (
                    <a href={`tel:${content.phone.replace(/[^+\d]/g, "")}`}>
                      <Phone size={16} />
                      {content.phone}
                    </a>
                  )}
                  {content.address && (
                    <p>
                      <MapPin size={16} />
                      {content.address}
                    </p>
                  )}
                  <div className="brand-social-links">
                    {content.instagram && (
                      <a
                        href={content.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Instagram <ArrowUpRight size={14} />
                      </a>
                    )}
                    {content.facebook && (
                      <a
                        href={content.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Facebook <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                </address>
              )}
            </div>
            <div className="brand-faqs">
              {content.faqs.map((faq, i) => (
                <details key={i}>
                  <summary>
                    {faq.question}
                    <Plus size={18} />
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}
    </div>
  );
}
