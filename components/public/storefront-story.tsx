"use client";
import { useRef } from "react";
import Image from "next/image";
import { useScroll } from "framer-motion";
import { Check, Store } from "lucide-react";
import { ScrollLayer, useStaticScene } from "./scroll-layer";
const products = [
  {
    name: "Weekend shirt",
    detail: "Chalk / relaxed fit",
    price: "৳ 1,450",
    image: "weekend-shirt.svg",
  },
  {
    name: "Canvas organiser",
    detail: "Natural / everyday carry",
    price: "৳ 450",
    image: "canvas-pouch.svg",
  },
  {
    name: "Daily sandals",
    detail: "Warm tan / leather",
    price: "৳ 1,250",
    image: "daily-sandals.svg",
  },
  {
    name: "Botanical hand balm",
    detail: "Sage / 50 ml",
    price: "৳ 390",
    image: "hand-balm.svg",
  },
];
export function StorefrontMotionScene() {
  const ref = useRef<HTMLElement>(null);
  const settled = useStaticScene();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  return (
    <section
      id="storefront"
      ref={ref}
      className="studio-store collection-story"
    >
      <div className="collection-pin studio-width">
        <div className="store-statement">
          <span className="studio-label">Your front door</span>
          <h2>
            A small world.
            <br />
            Entirely yours.
          </h2>
          <span className="store-footnote">
            Storefront concept
            <br />
            Sunday Studio
          </span>
        </div>
        <div className="collection-stage">
          <ScrollLayer
            className="collection-hero"
            progress={scrollYProgress}
            start={0}
            end={0.22}
            settled={settled}
          >
            <div className="collection-masthead">
              <Store size={17} /> sunday studio{" "}
              <span>The everyday collection</span>
            </div>
            <div className="collection-photo">
              <Image
                src="/images/olive-tote.webp"
                alt="Olive canvas everyday tote"
                fill
                sizes="(max-width: 767px) 90vw, 420px"
              />
              <span>Made for the everyday.</span>
            </div>
            <div className="collection-product">
              <div>
                <strong>Everyday tote</strong>
                <small>Olive / One size</small>
              </div>
              <b>৳ 850</b>
            </div>
            <ScrollLayer
              className="collection-selected"
              progress={scrollYProgress}
              start={0.7}
              end={0.86}
              settled={settled}
            >
              <Check size={14} /> Selected for your storefront · 24 available
            </ScrollLayer>
          </ScrollLayer>
          {products.map((p, i) => (
            <ScrollLayer
              key={p.name}
              className={`collection-satellite satellite-${i}`}
              progress={scrollYProgress}
              start={0.13 + i * 0.14}
              end={0.36 + i * 0.14}
              settled={settled}
            >
              <div className="satellite-photo">
                <Image
                  src={`/images/${p.image}`}
                  alt={p.name}
                  fill
                  sizes="(max-width: 767px) 42vw, 190px"
                />
              </div>
              <div className="satellite-copy">
                <strong>{p.name}</strong>
                <small>{p.detail}</small>
                <b>{p.price}</b>
              </div>
            </ScrollLayer>
          ))}
        </div>
        <p className="collection-caption">
          The same product facts. A world with your point of view.
          <small>Illustrative collection and stock. No store is changed.</small>
        </p>
      </div>
    </section>
  );
}
