"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";
import { useScroll } from "framer-motion";
import {
  ArrowUpRight,
  ShieldCheck,
  Store,
  Check,
  Sparkles,
  Lock,
} from "lucide-react";
import { ScrollLayer, useStaticScene } from "./scroll-layer";

export function ClosingScene() {
  const ref = useRef<HTMLElement>(null);
  const settled = useStaticScene();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "end 95%"],
  });

  return (
    <section ref={ref} className="studio-finale closing-scene" id="launch">
      <div className="closing-container">
        {/* Stage 1: Product environment settles into view */}
        <ScrollLayer
          progress={scrollYProgress}
          start={0.04}
          end={0.32}
          settled={settled}
          className="closing-env-stage"
        >
          <div className="closing-env-masthead">
            <div className="closing-env-shop">
              <span className="closing-env-monogram">
                <Store size={14} />
              </span>
              <strong>Sunday Studio</strong>
              <span className="closing-env-live-badge">
                <span className="closing-pulse-dot" />
                Storefront Live
              </span>
              <span className="closing-env-url">easy-shop.app/store/sunday-studio</span>
            </div>
            <div className="closing-env-supervision">
              <Lock size={13} />
              <span>Grounded inventory · Supervised replies</span>
            </div>
          </div>

          <div className="closing-env-body">
            {/* Left: Customer storefront & product anchor */}
            <div className="closing-env-left">
              <span className="closing-panel-tag">Customer storefront</span>
              <div className="closing-product-card">
                <div className="closing-product-thumb">
                  <Image
                    src="/images/olive-tote.webp"
                    alt="Olive canvas everyday tote"
                    fill
                    sizes="72px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div className="closing-product-details">
                  <span className="closing-product-name">Everyday tote</span>
                  <span className="closing-product-meta">Olive · Relaxed carry</span>
                  <div className="closing-product-price-row">
                    <strong className="closing-product-price">৳ 850</strong>
                    <span className="closing-product-stock">24 in stock</span>
                  </div>
                </div>
              </div>
              <div className="closing-signals">
                <div className="closing-signal-item">
                  <Check size={14} className="signal-check" />
                  <span>Product and stock in context</span>
                </div>
                <div className="closing-signal-item">
                  <Check size={14} className="signal-check" />
                  <span>Human review before sending</span>
                </div>
              </div>
            </div>

            {/* Stage 2: Key interface pieces resolve (Customer inquiry + Grounded verified reply) */}
            <div className="closing-env-right">
              <span className="closing-panel-tag">Connected conversation</span>
              <div className="closing-convo-block">
                <div className="closing-customer-msg">
                  <span className="closing-customer-avatar">NA</span>
                  <div>
                    <div className="closing-msg-author">
                      <strong>Nadia Ahmed</strong>
                      <small>Customer inquiry</small>
                    </div>
                    <p className="closing-msg-bubble">
                      “Hi! Is the everyday tote still available in olive?”
                    </p>
                  </div>
                </div>

                <ScrollLayer
                  progress={scrollYProgress}
                  start={0.24}
                  end={0.52}
                  settled={settled}
                  className="closing-verified-reply"
                >
                  <div className="closing-reply-label">
                    <Sparkles size={13} />
                    <span>Fact-grounded draft</span>
                  </div>
                  <p className="closing-reply-text">
                    “Hi Nadia! The everyday tote is available in olive for ৳ 850. Would you like a closer look?”
                  </p>
                  <div className="closing-reply-footer">
                    <span className="closing-verified-tag">
                      <ShieldCheck size={14} />
                      Verified against live catalog
                    </span>
                    <span className="closing-action-chip">Ready for merchant send</span>
                  </div>
                </ScrollLayer>
              </div>
            </div>
          </div>
        </ScrollLayer>

        {/* Stage 3: Main closing statement appears */}
        <ScrollLayer
          progress={scrollYProgress}
          start={0.46}
          end={0.72}
          settled={settled}
          className="closing-conclusion"
        >
          <span className="closing-eyebrow">Your store. In every conversation.</span>
          <h2 className="closing-headline">
            A little more clarity.
            <br />
            A lot more room to grow.
          </h2>
          <p className="closing-supporting">
            Give your products a home and every conversation its context. Start with your store. Build from there.
          </p>

          {/* Stage 4: CTA appears last */}
          <ScrollLayer
            progress={scrollYProgress}
            start={0.68}
            end={0.92}
            settled={settled}
            className="closing-actions-row"
          >
            <Link href="/register" className="closing-primary-btn">
              Create your store <ArrowUpRight size={17} />
            </Link>
            <Link href="/login" className="closing-secondary-btn">
              Log in to workspace
            </Link>
          </ScrollLayer>
        </ScrollLayer>

        <span className="closing-wordmark" aria-hidden="true">
          easy shop.
        </span>
      </div>
    </section>
  );
}

