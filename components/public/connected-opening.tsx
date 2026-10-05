"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent, type MotionValue } from "framer-motion";
import { ArrowDown, ArrowUpRight, Check, Layers2, Package, Sparkles, Store, Users } from "lucide-react";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { ScrollLayer } from "./scroll-layer";

const stages = ["Workspace", "Storefront", "Inventory", "Customer", "AI reply", "Your decision"];
function ShopEnvironment({ progress, staticScene = false }: { progress: MotionValue<number>; staticScene?: boolean }) {
  return <div className="connected-shop">
    <header className="connected-shop-bar"><span><Layers2 size={18} /> Sunday Studio</span><span className="connected-example">Interactive product story · Example data</span></header>
    <div className="connected-shop-body">
      <div className="connected-shop-rail" aria-hidden="true"><Layers2/><Store/><Package/><Users/><Sparkles/></div>
      <div className="connected-shop-content">
        <div className="connected-shop-title"><div><small>Your working day</small><h3>Everything starts with your shop.</h3></div><span className="connected-live"><i/>Storefront live</span></div>
        <div className="connected-panels">
          <ScrollLayer className="connected-store" progress={progress} start={0.08} end={0.28} settled={staticScene}>
            <div className="connected-panel-label"><Store size={15}/> Storefront <span>sunday studio</span></div>
            <div className="connected-product-photo"><Image src="/images/olive-tote.webp" alt="Olive canvas everyday tote" width={600} height={600} priority/></div>
            <div className="connected-product-caption"><div><strong>Everyday tote</strong><small>Olive canvas / One size</small></div><b>৳ 850</b></div>
          </ScrollLayer>
          <div className="connected-context">
            <ScrollLayer className="connected-stock" progress={progress} start={0.22} end={0.43} settled={staticScene}><div className="connected-panel-label"><Package size={15}/> Inventory</div><div className="connected-stock-line"><strong>24 <small>available</small></strong><span><Check size={13}/> In stock</span></div><div className="connected-stock-track"><span/></div><small>TOTE–OLIVE · Product facts, ready to reference</small></ScrollLayer>
            <ScrollLayer className="connected-person" progress={progress} start={0.38} end={0.6} settled={staticScene}><div className="connected-panel-label"><Users size={15}/> Customer context</div><div className="connected-person-line"><span>NA</span><div><strong>Nadia Ahmed</strong><small>Prefers earthy colours</small></div></div><p>“Is the olive tote still available?”</p></ScrollLayer>
            <ScrollLayer className="connected-reply" progress={progress} start={0.55} end={0.78} settled={staticScene}><div className="connected-panel-label"><Sparkles size={15}/> AI Reply <span>For your review</span></div><p>Hi Nadia! The everyday tote is available in olive for ৳ 850. Would you like a closer look?</p><div className="connected-review"><span>Product + stock checked</span><strong>Review before sending</strong></div></ScrollLayer>
          </div>
        </div>
        <footer className="connected-shop-foot"><span>One product. One customer. All the context.</span><span>Nothing sent automatically</span></footer>
      </div>
    </div>
  </div>;
}
export function ConnectedHero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useMotionPreference();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end 60%"] });
  const scale = useTransform(() => 0.91 + Math.min(1, scrollYProgress.get()) * 0.09);
  const y = useTransform(() => 42 - scrollYProgress.get() * 70);
  const reveal = useTransform(() => 0.83 + scrollYProgress.get() * 0.17);
  return <section ref={ref} className="connected-hero">
    <div className="connected-hero-copy">
      <motion.p initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}><span className="status-point"/> A working space for social sellers</motion.p>
      <motion.h1 initial={{ opacity: 0, y: reduced ? 0 : 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.12 }}>Your whole shop.<br/>Behind every reply.</motion.h1>
      <motion.div initial={{ opacity: 0, y: reduced ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.3 }}><p>Products, people and AI that knows the context.<br/>One connected workspace. The final say stays yours.</p><div className="connected-hero-actions"><Link href="/register" className="launch-button">Create your store <ArrowUpRight size={17}/></Link><a href="#story">Watch it come together <ArrowDown size={16}/></a></div></motion.div>
    </div>
    <motion.div className="connected-hero-stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.5 }} style={reduced ? {} : { scale, y }}><ShopEnvironment progress={reveal} staticScene={!!reduced}/></motion.div>
    <div className="connected-hero-caption"><span>From the storefront to the next conversation.</span><span>Built around your working day.</span></div>
  </section>;
}
export function ConnectedStory() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useMotionPreference();
  const [stage, setStage] = useState(0);
  const previous = useRef(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", value => { const next = Math.min(5, Math.floor(value * 6)); if (next !== previous.current) { previous.current = next; setStage(next); } });
  return <section ref={ref} id="story" className="connected-story" data-static={reduced || undefined}>
    <div className="connected-story-pin">
      <div className="connected-story-heading"><h2>A shop is connected.<br/>Now your workspace is, too.</h2><p>Follow one question from the storefront<br/>to a reply you’re confident to send.</p></div>
      <div className="connected-story-steps" role="group" aria-label="Connected shop story stages">{stages.map((name, i) => <button key={name} aria-pressed={stage === i} onClick={() => { if (ref.current) window.scrollTo({ top: ref.current.offsetTop + (ref.current.offsetHeight - window.innerHeight) * ((i + 0.6) / 6), behavior: reduced ? "instant" : "smooth" }); }}><span>{i + 1}</span>{name}{stage === i && <motion.i layoutId="connected-story-active" transition={{ duration: 0.2 }}/>}</button>)}</div>
      <ShopEnvironment progress={scrollYProgress} staticScene={!!reduced}/>
      <p className="connected-story-note">The facts stay connected. Approval and sending stay separate.</p>
    </div>
  </section>;
}
