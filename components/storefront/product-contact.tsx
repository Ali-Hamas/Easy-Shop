"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, MessageCircle, Phone } from "lucide-react";
import { Modal } from "@/components/ui/overlays";
import type { StorefrontContent } from "@/types/storefront-content";
import {
  messengerDestination,
  renderContactMessage,
  whatsappDestination,
} from "@/lib/storefront-contact";
import "@/styles/product-contact.css";

const subscribe = () => () => {};
export function ProductContact({
  content,
  shopName,
  productName,
  price,
  path,
  variant = "",
  themeId,
}: {
  content: StorefrontContent;
  shopName: string;
  productName: string;
  price: string;
  path: string;
  variant?: string;
  themeId: string;
}) {
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState<
    "ready" | "copying" | "copied" | "failed"
  >("ready");
  const whatsapp = whatsappDestination(content.whatsappNumber);
  const messenger = messengerDestination(content.messengerUrl);
  const message = renderContactMessage(content.contactMessage, {
    shop_name: shopName,
    product_name: productName,
    product_price: price,
    product_url: `${origin}${path}`,
    variant,
  });
  async function copyMessage() {
    setCopyState("copying");
    try {
      await navigator.clipboard.writeText(message);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  if (!message || (!whatsapp && !messenger)) return null;
  return (
    <div className="product-contact">
      {whatsapp && (
        <a
          className="product-contact-action"
          href={`${whatsapp}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Phone size={18} aria-hidden /> Contact via WhatsApp{" "}
          <ExternalLink size={16} aria-hidden />
        </a>
      )}
      {messenger && (
        <button
          type="button"
          className="product-contact-action product-contact-secondary"
          onClick={() => {
            setOpen(true);
            void copyMessage();
          }}
        >
          <MessageCircle size={18} aria-hidden /> Contact via Messenger{" "}
          <ExternalLink size={16} aria-hidden />
        </button>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Your message for the shop"
        description="Copy this message, then open Messenger and paste it into the chat. You can edit it before sending."
        className="product-contact-modal"
        data-store-theme={themeId}
        data-store-accent={content.design.accent}
        data-store-font={content.design.fontSet}
      >
        <label className="product-contact-label" htmlFor="messenger-message">
          Message
        </label>
        <textarea
          id="messenger-message"
          className="product-contact-message"
          value={message}
          readOnly
          rows={7}
          onFocus={(e) => e.currentTarget.select()}
        />
        <p className="product-contact-status" role="status">
          {copyState === "copied" ? (
            <>
              <Check size={16} aria-hidden /> Message copied. Paste it into
              Messenger.
            </>
          ) : copyState === "failed" ? (
            "Automatic copying was blocked. Select the message above and copy it manually."
          ) : copyState === "copying" ? (
            "Copying message…"
          ) : (
            "Your message is ready to copy."
          )}
        </p>
        <div className="product-contact-modal-actions">
          {messenger && (
            <a
              className="product-contact-action"
              href={messenger}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} aria-hidden /> Open Messenger{" "}
              <ExternalLink size={16} aria-hidden />
            </a>
          )}
          <button
            type="button"
            className="product-contact-action product-contact-secondary"
            disabled={copyState === "copying"}
            onClick={() => void copyMessage()}
          >
            <Copy size={16} aria-hidden />{" "}
            {copyState === "copied" ? "Copy again" : "Copy message"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
