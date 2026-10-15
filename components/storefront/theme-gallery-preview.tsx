"use client";

import { getStorefrontTheme } from "@/config/storefront-themes";
import type { PublicProduct } from "@/types/commerce";
import { BrandImage } from "./storefront-brand";
import type { CSSProperties } from "react";
import "@/styles/storefront-themes.css";

/** A layout diagram when empty; real merchant images and names when available. */
export function ThemeGalleryPreview({
  themeId,
  shopName,
  products = [],
  device = "desktop",
  coverImage,
  headline,
}: {
  themeId: string;
  shopName?: string;
  products?: Pick<PublicProduct, "id" | "name" | "imageUrl">[];
  device?: "desktop" | "mobile";
  coverImage?: string;
  headline?: string;
}) {
  const theme = getStorefrontTheme(themeId);
  const heroImage =
    coverImage || products.find((product) => product.imageUrl)?.imageUrl;
  const style = {
    "--preview-paper": theme.palette[0],
    "--preview-soft": theme.palette[1],
    "--preview-accent": theme.palette[2],
  } as CSSProperties;
  return (
    <div
      className="theme-gallery-preview"
      data-preview-theme={theme.id}
      data-device={device}
      style={style}
      role="img"
      aria-label={`${theme.name} ${device} layout preview${shopName ? ` for ${shopName}` : " with neutral placeholder shapes"}`}
    >
      <div className="theme-thumb-browser" aria-hidden="true">
        <i />
        <i />
        <i />
        <span />
      </div>
      <div className="theme-thumb-page" aria-hidden="true">
        <div className="theme-thumb-header">
          <strong>{shopName || "Your store"}</strong>
          <span />
          <i />
        </div>
        <div className="theme-thumb-nav">
          <i />
          <i />
          <i />
        </div>
        <div className="theme-thumb-hero">
          <div className="theme-thumb-copy">
            <small>{theme.category}</small>
            <strong>{headline || "Your brand.\nYour collection."}</strong>
            <span />
            <span />
            <i />
          </div>
          <div className="theme-thumb-cover">
            {heroImage ? (
              <BrandImage key={heroImage} src={heroImage} alt="" />
            ) : (
              <>
                <i />
                <i />
              </>
            )}
          </div>
        </div>
        <div className="theme-thumb-section-title">
          <strong>
            {theme.id === "food-restaurant"
              ? "On the menu"
              : "Explore the collection"}
          </strong>
          <i />
        </div>
        <div className="theme-thumb-products">
          {products.length
            ? products.slice(0, 4).map((product) => (
                <div className="theme-thumb-product" key={product.id}>
                  <div>
                    {product.imageUrl ? (
                      <BrandImage
                        key={product.imageUrl}
                        src={product.imageUrl}
                        alt=""
                      />
                    ) : (
                      <i />
                    )}
                  </div>
                  <strong>{product.name}</strong>
                  <span />
                </div>
              ))
            : [0, 1, 2].map((index) => (
                <div className="theme-thumb-product" key={index}>
                  <div>
                    <i />
                  </div>
                  <span />
                  <span />
                </div>
              ))}
        </div>
        <div className="theme-thumb-story">
          <i />
          <div>
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
      <span className="theme-thumb-caption">
        {products.length
          ? "Preview with your products"
          : "Layout preview · add your content"}
      </span>
    </div>
  );
}
