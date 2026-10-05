"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Package, Plus, Check, AlertCircle } from "lucide-react";
import { Input, Textarea, Select } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { blankProduct, blankVariant, editProduct } from "@/adapters/inventory";
import { inventoryService } from "@/services/inventory";
import type { InventoryInput, InventoryProduct } from "@/types/inventory";
import { ApiError } from "@/lib/api/client";
import { formatMoney } from "@/adapters/commerce";
import {
  PRODUCT_SECTIONS,
  validateProductDraft,
  mapBackendIssuesToErrors,
  type ProductFieldError,
} from "@/lib/validation/product-errors";
import { cn } from "@/lib/utils";

function EditorImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return !failed && /^https?:\/\//.test(url) ? (
    <Image
      src={url}
      alt="Product preview"
      width={220}
      height={180}
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <Package size={40} />
  );
}

export function ProductEditor({
  shopId,
  product,
  currency,
  onSaved,
  onCancel,
}: {
  shopId: string;
  product?: InventoryProduct;
  currency: string;
  onSaved: (p: InventoryProduct) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<InventoryInput>(() =>
    product ? editProduct(product) : blankProduct(),
  );
  const [section, setSection] = useState(0);
  const [media, setMedia] = useState(() => product?.images.join("\n") ?? "");
  const [archiveConfirmed, setArchiveConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, ProductFieldError>
  >({});
  const [sectionErrors, setSectionErrors] = useState<Record<number, number>>({
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  });
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const reduced = useReducedMotion();
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  function clearFieldError(fieldKey: string) {
    setFieldErrors((prev) => {
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];

      const nextSecErrors: Record<number, number> = {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };
      Object.values(next).forEach((err) => {
        nextSecErrors[err.sectionIndex] =
          (nextSecErrors[err.sectionIndex] || 0) + 1;
      });
      setSectionErrors(nextSecErrors);

      const count = Object.keys(next).length;
      setSummaryError(
        count > 0
          ? `${count} ${count === 1 ? "field needs" : "fields need"} attention before this product can be saved.`
          : null,
      );

      return next;
    });
  }

  function set<K extends keyof InventoryInput>(
    key: K,
    value: InventoryInput[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));

    // Immediate error clearing when field becomes valid
    if (
      key === "name" &&
      typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= 180
    ) {
      clearFieldError("name");
    } else if (
      key === "sku" &&
      typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= 80
    ) {
      clearFieldError("sku");
    } else if (
      key === "category" &&
      typeof value === "string" &&
      value.trim().length <= 100
    ) {
      clearFieldError("category");
    } else if (
      key === "description" &&
      typeof value === "string" &&
      value.trim().length <= 5000
    ) {
      clearFieldError("description");
    } else if (key === "price" && Number(value) > 0) {
      clearFieldError("price");
    } else if (key === "comparePrice") {
      const comp = Number(value);
      const pr = Number(draft.price);
      if (value === null || (comp >= pr && comp >= 0)) {
        clearFieldError("comparePrice");
      }
    } else if (key === "cost") {
      if (value === null || Number(value) >= 0) {
        clearFieldError("cost");
      }
    } else if (key === "delivery") {
      clearFieldError("delivery-weightGrams");
      clearFieldError("delivery-note");
    } else if (key === "seo") {
      clearFieldError("seo-title");
      clearFieldError("seo-description");
    }
  }

  function handleMediaChange(val: string) {
    setMedia(val);
    const lines = val
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const allValid =
      lines.length <= 8 && lines.every((l) => /^https?:\/\//i.test(l));
    if (allValid) {
      clearFieldError("images");
    }
  }

  function navigateToFirstError(target: ProductFieldError) {
    setSection(target.sectionIndex);
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(
          target.inputId,
        ) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }, 70);
    });
  }

  async function save() {
    setBusy(true);
    setGeneralError("");

    // 1. Client-side pre-validation
    const validation = validateProductDraft(draft, media);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setSectionErrors(validation.sectionErrors);
      setSummaryError(validation.summaryMessage);
      setBusy(false);
      if (validation.firstError) {
        navigateToFirstError(validation.firstError);
      }
      return;
    }

    try {
      const payload = {
        ...draft,
        images: media
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
      };
      const p = product
        ? await inventoryService.update(
            shopId,
            product.id,
            payload,
            product.version,
          )
        : await inventoryService.create(shopId, payload, requestId);
      onSaved(p);
    } catch (e) {
      const err = e as ApiError;
      if (err.issues && err.issues.length > 0) {
        const backendValidation = mapBackendIssuesToErrors(err.issues);
        setFieldErrors(backendValidation.errors);
        setSectionErrors(backendValidation.sectionErrors);
        setSummaryError(backendValidation.summaryMessage);
        if (backendValidation.firstError) {
          navigateToFirstError(backendValidation.firstError);
        }
      } else {
        setGeneralError(
          err.message || "Failed to save product. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inventory-editor">
      {summaryError && (
        <div
          className="product-validation-summary"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle size={16} aria-hidden />
          <span>{summaryError}</span>
        </div>
      )}

      <div
        ref={tabsContainerRef}
        className="editor-tabs"
        role="tablist"
        aria-label="Product sections"
      >
        {PRODUCT_SECTIONS.map((s, i) => {
          const count = sectionErrors[i] || 0;
          return (
            <button
              key={s}
              role="tab"
              tabIndex={i === section ? 0 : -1}
              className={cn(
                "editor-tab-button",
                count > 0 && "editor-tab-has-error",
              )}
              onKeyDown={(event) => {
                let next = i;
                if (event.key === "ArrowRight")
                  next = (i + 1) % PRODUCT_SECTIONS.length;
                else if (event.key === "ArrowLeft")
                  next =
                    (i + PRODUCT_SECTIONS.length - 1) % PRODUCT_SECTIONS.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End")
                  next = PRODUCT_SECTIONS.length - 1;
                else return;
                event.preventDefault();
                setSection(next);
                (
                  event.currentTarget.parentElement?.children[
                    next
                  ] as HTMLButtonElement
                )?.focus();
              }}
              aria-selected={i === section}
              aria-controls="editor-panel"
              onClick={() => setSection(i)}
            >
              <span className="editor-tab-title">{s}</span>
              {count > 0 && (
                <span
                  className="editor-tab-error-badge"
                  aria-label={`${count} error${count > 1 ? "s" : ""} in ${s}`}
                >
                  {count}
                </span>
              )}
              {i === section && (
                <motion.span
                  layoutId="editor-tab"
                  className="editor-underline"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="editor-layout">
        <div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              id="editor-panel"
              role="tabpanel"
              aria-label={PRODUCT_SECTIONS[section]}
              key={section}
              initial={{ opacity: 0, x: reduced ? 0 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduced ? 0 : -8 }}
              transition={{ duration: 0.18 }}
              className="editor-fields"
            >
              <h3>{PRODUCT_SECTIONS[section]}</h3>

              {section === 0 && (
                <>
                  <Input
                    id="field-product-name"
                    label="Product name"
                    value={draft.name}
                    error={fieldErrors["name"]?.message}
                    onChange={(e) => set("name", e.target.value)}
                    maxLength={180}
                    required
                  />
                  <Input
                    id="field-product-sku"
                    label="Product SKU"
                    value={draft.sku}
                    error={fieldErrors["sku"]?.message}
                    onChange={(e) => set("sku", e.target.value)}
                    maxLength={80}
                    required
                  />
                  <Input
                    id="field-product-category"
                    label="Category"
                    value={draft.category}
                    error={fieldErrors["category"]?.message}
                    onChange={(e) => set("category", e.target.value)}
                    maxLength={100}
                  />
                  <Textarea
                    id="field-product-description"
                    label="Description"
                    value={draft.description}
                    error={fieldErrors["description"]?.message}
                    onChange={(e) => set("description", e.target.value)}
                    maxLength={5000}
                  />
                  <Select
                    id="field-product-status"
                    label="Product status"
                    value={draft.status}
                    error={fieldErrors["status"]?.message}
                    onChange={(e) =>
                      set("status", e.target.value as InventoryInput["status"])
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Inactive / archived</option>
                  </Select>
                  <p className="field-hint">
                    Only active products appear in the published storefront.
                    Existing stock history is retained.
                  </p>
                </>
              )}

              {section === 1 && (
                <>
                  <Textarea
                    id="field-product-media"
                    label="Product image URLs"
                    hint="One HTTP(S) URL per line, up to eight. File upload is not connected."
                    value={media}
                    error={fieldErrors["images"]?.message}
                    onChange={(e) => handleMediaChange(e.target.value)}
                  />
                  <p className="field-hint">
                    Use images you have permission to publish. The first image
                    leads the catalog.
                  </p>
                </>
              )}

              {section === 2 && (
                <>
                  <Input
                    id="field-product-price"
                    label="Selling price"
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={draft.price || ""}
                    error={fieldErrors["price"]?.message}
                    onChange={(e) =>
                      set(
                        "price",
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                    required
                  />
                  <Input
                    id="field-product-comparePrice"
                    label="Compare price (optional)"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.comparePrice ?? ""}
                    error={fieldErrors["comparePrice"]?.message}
                    onChange={(e) =>
                      set(
                        "comparePrice",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                  <Input
                    id="field-product-cost"
                    label="Cost (optional)"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.cost ?? ""}
                    error={fieldErrors["cost"]?.message}
                    onChange={(e) =>
                      set(
                        "cost",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                  <p className="field-hint">
                    Prices use the shop currency. Cost stays private to
                    inventory management.
                  </p>
                </>
              )}

              {section === 3 && (
                <>
                  <p className="field-hint">
                    Opening stock is set once. Use Adjust stock for later
                    changes. Existing variants retain their history.
                  </p>

                  {fieldErrors["variants"] && (
                    <div className="variant-group-error" role="alert">
                      <AlertCircle size={15} />
                      <span>{fieldErrors["variants"].message}</span>
                    </div>
                  )}

                  {draft.variants.map((v, i) => (
                    <fieldset key={v.id ?? i} className="variant-editor">
                      <legend>
                        Variant {i + 1} · {v.title || "Untitled"}
                      </legend>
                      <div className="editor-two">
                        <Input
                          id={`field-variant-${i}-title`}
                          label={`Variant name ${i + 1}`}
                          value={v.title}
                          error={fieldErrors[`variant-${i}-title`]?.message}
                          onChange={(e) => {
                            const val = e.target.value;
                            set(
                              "variants",
                              draft.variants.map((item, index) =>
                                index === i ? { ...item, title: val } : item,
                              ),
                            );
                            if (val.trim()) {
                              clearFieldError(`variant-${i}-title`);
                            }
                          }}
                          required
                        />
                        <Input
                          id={`field-variant-${i}-sku`}
                          label={`Variant SKU ${i + 1}`}
                          value={v.sku}
                          error={fieldErrors[`variant-${i}-sku`]?.message}
                          onChange={(e) => {
                            const val = e.target.value;
                            set(
                              "variants",
                              draft.variants.map((item, index) =>
                                index === i ? { ...item, sku: val } : item,
                              ),
                            );
                            if (val.trim()) {
                              clearFieldError(`variant-${i}-sku`);
                            }
                          }}
                          required
                        />
                        <Input
                          id={`field-variant-${i}-size`}
                          label={`Size ${i + 1}`}
                          value={v.size}
                          onChange={(e) =>
                            set(
                              "variants",
                              draft.variants.map((item, index) =>
                                index === i
                                  ? { ...item, size: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <Input
                          id={`field-variant-${i}-color`}
                          label={`Color ${i + 1}`}
                          value={v.color}
                          onChange={(e) =>
                            set(
                              "variants",
                              draft.variants.map((item, index) =>
                                index === i
                                  ? { ...item, color: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <Input
                          id={`field-variant-${i}-material`}
                          label={`Material ${i + 1}`}
                          value={v.material}
                          onChange={(e) =>
                            set(
                              "variants",
                              draft.variants.map((item, index) =>
                                index === i
                                  ? { ...item, material: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <Input
                          id={`field-variant-${i}-image`}
                          label={`Variant image URL ${i + 1}`}
                          value={v.image}
                          error={fieldErrors[`variant-${i}-image`]?.message}
                          onChange={(e) => {
                            const val = e.target.value;
                            set(
                              "variants",
                              draft.variants.map((item, index) =>
                                index === i ? { ...item, image: val } : item,
                              ),
                            );
                            if (!val || /^https?:\/\//i.test(val)) {
                              clearFieldError(`variant-${i}-image`);
                            }
                          }}
                        />
                        <Input
                          id={`field-variant-${i}-priceOverride`}
                          label={`Price override ${i + 1}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={v.priceOverride ?? ""}
                          error={
                            fieldErrors[`variant-${i}-priceOverride`]?.message
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            set(
                              "variants",
                              draft.variants.map((item, index) =>
                                index === i
                                  ? {
                                      ...item,
                                      priceOverride:
                                        val === "" ? null : Number(val),
                                    }
                                  : item,
                              ),
                            );
                            clearFieldError(`variant-${i}-priceOverride`);
                          }}
                        />
                        <Input
                          id={`field-variant-${i}-lowStockThreshold`}
                          label={`Low-stock threshold ${i + 1}`}
                          type="number"
                          min={0}
                          step={1}
                          value={v.lowStockThreshold ?? 5}
                          error={
                            fieldErrors[`variant-${i}-lowStockThreshold`]
                              ?.message
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            set(
                              "variants",
                              draft.variants.map((item, index) =>
                                index === i
                                  ? {
                                      ...item,
                                      lowStockThreshold:
                                        val === "" ? 5 : Number(val),
                                    }
                                  : item,
                              ),
                            );
                            clearFieldError(`variant-${i}-lowStockThreshold`);
                          }}
                        />
                        <Input
                          id={`field-variant-${i}-openingStock`}
                          label={`Opening stock ${i + 1}`}
                          type="number"
                          min={0}
                          step={1}
                          disabled={Boolean(v.id)}
                          value={v.openingStock ?? 0}
                          error={
                            fieldErrors[`variant-${i}-openingStock`]?.message
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            set(
                              "variants",
                              draft.variants.map((item, index) =>
                                index === i
                                  ? {
                                      ...item,
                                      openingStock:
                                        val === "" ? 0 : Number(val),
                                    }
                                  : item,
                              ),
                            );
                            clearFieldError(`variant-${i}-openingStock`);
                          }}
                        />
                      </div>
                      {!v.id && draft.variants.length > 1 && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            set(
                              "variants",
                              draft.variants.filter((_, index) => index !== i),
                            )
                          }
                        >
                          Remove unsaved variant
                        </Button>
                      )}
                    </fieldset>
                  ))}
                  <Button
                    variant="secondary"
                    disabled={draft.variants.length >= 50}
                    onClick={() =>
                      set("variants", [
                        ...draft.variants,
                        {
                          ...blankVariant(),
                          title: `Variant ${draft.variants.length + 1}`,
                          sku: `${draft.sku || "VAR"}-${draft.variants.length + 1}`,
                        },
                      ])
                    }
                  >
                    <Plus size={15} />
                    Add variant
                  </Button>
                </>
              )}

              {section === 4 && (
                <>
                  <Input
                    id="field-delivery-weightGrams"
                    label="Weight in grams (optional)"
                    type="number"
                    min={0}
                    step={1}
                    value={draft.delivery.weightGrams ?? ""}
                    error={fieldErrors["delivery-weightGrams"]?.message}
                    onChange={(e) =>
                      set("delivery", {
                        ...draft.delivery,
                        weightGrams:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                  <Textarea
                    id="field-delivery-note"
                    label="Delivery information"
                    value={draft.delivery.note}
                    error={fieldErrors["delivery-note"]?.message}
                    onChange={(e) =>
                      set("delivery", {
                        ...draft.delivery,
                        note: e.target.value,
                      })
                    }
                    maxLength={5000}
                  />
                  <Input
                    id="field-seo-title"
                    label="SEO title"
                    maxLength={160}
                    value={draft.seo.title}
                    error={fieldErrors["seo-title"]?.message}
                    onChange={(e) =>
                      set("seo", { ...draft.seo, title: e.target.value })
                    }
                  />
                  <Textarea
                    id="field-seo-description"
                    label="SEO description"
                    maxLength={320}
                    value={draft.seo.description}
                    error={fieldErrors["seo-description"]?.message}
                    onChange={(e) =>
                      set("seo", { ...draft.seo, description: e.target.value })
                    }
                  />
                </>
              )}

              {section === 5 && (
                <>
                  <p className="field-hint">
                    Enter approved facts only. These are saved for future AI
                    use; no AI generates or sends replies here.
                  </p>
                  {(
                    [
                      ["sellingPoints", "Selling points"],
                      ["audience", "Who it is for"],
                      ["care", "Care instructions"],
                      ["policyExceptions", "Policy exceptions"],
                    ] as const
                  ).map(([k, label]) => (
                    <Textarea
                      key={k}
                      id={`field-aiFacts-${k}`}
                      label={label}
                      value={draft.aiFacts[k]}
                      error={fieldErrors[`aiFacts-${k}`]?.message}
                      onChange={(e) =>
                        set("aiFacts", {
                          ...draft.aiFacts,
                          [k]: e.target.value,
                        })
                      }
                      maxLength={5000}
                    />
                  ))}
                </>
              )}
            </motion.section>
          </AnimatePresence>
        </div>

        <aside className="editor-preview" aria-label="Product card preview">
          <span>Storefront preview</span>
          <div className="preview-product-image">
            <EditorImage
              key={media.split("\n")[0]}
              url={media.split("\n")[0] ?? ""}
            />
          </div>
          <strong>{draft.name || "Your next product"}</strong>
          <p>{draft.category || "Add a category"}</p>
          <b>{formatMoney(draft.price, product?.currency ?? currency)}</b>
          <span>
            {draft.status} · {draft.variants.length} variant
            {draft.variants.length !== 1 ? "s" : ""}
          </span>
          <small>
            Layout preview. Stock changes are saved only when you confirm.
          </small>
        </aside>
      </div>

      {generalError && (
        <div className="inventory-error" role="alert">
          {generalError}
        </div>
      )}

      <div className="editor-footer">
        {draft.status === "archived" && product?.status !== "archived" && (
          <label className="adjustment-confirm">
            <input
              type="checkbox"
              checked={archiveConfirmed}
              onChange={(e) => setArchiveConfirmed(e.target.checked)}
            />
            Hide this product from the storefront.
          </label>
        )}
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={
            busy ||
            (draft.status === "archived" &&
              product?.status !== "archived" &&
              !archiveConfirmed)
          }
          onClick={save}
        >
          {busy ? (
            "Saving…"
          ) : (
            <>
              <Check size={16} />
              {product
                ? "Save product"
                : draft.status === "active"
                  ? "Create active product"
                  : "Create draft"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
