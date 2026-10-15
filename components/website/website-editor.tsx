"use client";
import { commerceUi } from "@/config/commerce-ui";
import {
  CONTACT_MESSAGE_WORD_LIMIT,
  messageWordCount,
  messengerDestination,
  whatsappDestination,
} from "@/lib/storefront-contact";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Store,
  ArrowUpRight,
  Check,
  Plus,
  Trash2,
  Monitor,
  Smartphone,
  ImagePlus,
} from "lucide-react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { rememberedShop, subscribeShop } from "@/adapters/commerce";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/fields";
import {
  StorefrontHero,
  StorefrontDetails,
  BrandImage,
} from "@/components/storefront/storefront-brand";
import {
  emptyStorefrontContent,
  type StorefrontContent,
  type StorefrontEditorState,
  type StorefrontSectionId,
} from "@/types/storefront-content";
import "@/styles/website-editor.css";
import {
  storefrontThemes,
  getStorefrontTheme,
  storefrontAccentOptions,
  storefrontFontOptions,
} from "@/config/storefront-themes";
import { ThemeGalleryPreview } from "@/components/storefront/theme-gallery-preview";
import "@/styles/store-design.css";
const tabs = [
  "Brand & cover",
  "Products & collections",
  "Our story",
  "Contact & policies",
  "FAQs",
];
function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [error, setError] = useState("");
  return (
    <div className="website-image-field">
      <Input
        label={`${label} URL`}
        value={value.startsWith("data:") ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://…"
        hint="Or upload a PNG, JPEG or WebP, up to 1 MB."
      />
      <label className="website-upload">
        <ImagePlus size={16} />
        {value ? "Replace image" : "Upload image"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (
              file.size > 1024 * 1024 ||
              !["image/png", "image/jpeg", "image/webp"].includes(file.type)
            ) {
              setError("Choose a PNG, JPEG or WebP smaller than 1 MB.");
              return;
            }
            setError("");
            const reader = new FileReader();
            reader.onerror = () =>
              setError("The image could not be read. Try another file.");
            reader.onload = () => onChange(String(reader.result));
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {value && (
        <div className="website-image-preview">
          <BrandImage key={value} src={value} alt={label} />
          <Button
            type="button"
            variant="secondary"
            onClick={() => onChange("")}
          >
            Remove image
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export default function WebsiteEditor({
  initialContact = false,
}: {
  initialContact?: boolean;
}) {
  const shopId = useSyncExternalStore(
    subscribeShop,
    rememberedShop,
    () => null,
  );
  return (
    <WebsiteEditorForm
      key={`${shopId ?? "none"}:${initialContact}`}
      shopId={shopId}
      initialContact={initialContact}
    />
  );
}
function WebsiteEditorForm({
  shopId,
  initialContact,
}: {
  shopId: string | null;
  initialContact: boolean;
}) {
  const [data, setData] = useState<StorefrontEditorState | null>(null);
  const [draft, setDraft] = useState<StorefrontContent>(emptyStorefrontContent);
  const [tab, setTab] = useState(initialContact ? 3 : 0);
  const [mode, setMode] = useState(initialContact ? "Homepage" : "Themes");
  const [previewTheme, setPreviewTheme] = useState("");
  const [mobile, setMobile] = useState(false);
  const [loading, setLoading] = useState(!!shopId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const current = data?.shop.id === shopId ? data : null;
  const contactReady = initialContact && !!current;
  useEffect(() => {
    if (contactReady)
      document
        .getElementById("product-contact-settings")
        ?.scrollIntoView({ block: "start" });
  }, [contactReady]);
  const dirty =
    !!current && JSON.stringify(draft) !== JSON.stringify(current.content);
  useEffect(() => {
    if (!shopId) return;
    const controller = new AbortController();
    apiRequest<StorefrontEditorState>(
      `onboarding/${shopId}/storefront-content`,
      { signal: controller.signal },
    )
      .then((v) => {
        if (!controller.signal.aborted) {
          setData(v);
          setDraft(v.content);
          setIssues({});
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [shopId, reload]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function reloadSaved() {
    setLoading(true);
    setError("");
    setNotice("");
    setReload((n) => n + 1);
  }
  function change<K extends keyof StorefrontContent>(
    key: K,
    value: StorefrontContent[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
    setNotice("");
    setIssues((i) => ({ ...i, [key]: "" }));
  }
  const field = (
    key: keyof StorefrontContent,
    label: string,
    max: number,
    multiline = false,
  ) => {
    const props = {
      label,
      value: String(draft[key]),
      maxLength: max,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => change(key, e.target.value as never),
      error: issues[key],
    };
    return multiline ? <Textarea {...props} rows={4} /> : <Input {...props} />;
  };
  function save(e: React.FormEvent) {
    e.preventDefault();
    void persist(draft, true);
  }
  async function persist(content: StorefrontContent, publish: boolean) {
    if (!current || saving) return;
    const contactIssues: Record<string, string> = {};
    if (
      messageWordCount(content.contactMessage || "") >
      CONTACT_MESSAGE_WORD_LIMIT
    )
      contactIssues.contactMessage = "Keep the message to 500 words or fewer.";
    if (
      (content.whatsappNumber || content.messengerUrl) &&
      !content.contactMessage?.trim()
    )
      contactIssues.contactMessage =
        "Write a message for your contact buttons.";
    if (content.whatsappNumber && !whatsappDestination(content.whatsappNumber))
      contactIssues.whatsappNumber =
        "Enter a WhatsApp number with country code (7–15 digits).";
    if (content.messengerUrl && !messengerDestination(content.messengerUrl))
      contactIssues.messengerUrl =
        "Use your https://m.me/page-username link without extra parameters.";
    if (Object.keys(contactIssues).length) {
      setIssues(contactIssues);
      setError("Check your product contact settings.");
      setMode("Homepage");
      setTab(3);
      return;
    }
    setSaving(true);
    setError("");
    setIssues({});
    try {
      const saved = await apiRequest<{
        content: StorefrontContent;
        version: number;
        hasUnpublishedChanges: boolean;
      }>(`onboarding/${current.shop.id}/storefront-content`, {
        method: "PATCH",
        body: { version: current.version, content, publish },
      });
      setData({ ...current, ...saved });
      setDraft(saved.content);
      setNotice(
        !publish
          ? "Draft saved. Your live storefront is unchanged."
          : current.shop.status === "launched"
            ? "Storefront updated. Your changes are live."
            : "Storefront saved. Complete shop setup to launch.",
      );
    } catch (e) {
      if (e instanceof ApiError) {
        setIssues(
          Object.fromEntries(
            e.issues.map((i) => [i.path.slice(1).join("."), i.message]),
          ),
        );
      }
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your changes are still here.",
      );
    } finally {
      setSaving(false);
    }
  }
  const completion = [
    draft.headline && draft.description,
    draft.coverImage,
    draft.story,
    draft.email || draft.phone,
    draft.faqs.length,
  ].filter(Boolean).length;
  return (
    <div className="page website-editor">
      <header className="website-editor-heading">
        <div>
          <p>Your customer’s first impression</p>
          <h1>Store Design</h1>
          <span>
            Choose a theme. Make it yours. Publish when it feels right.
          </span>
        </div>
        {current && (
          <div className="page-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setMode("Homepage");
                setTab(3);
              }}
            >
              Contact buttons
            </Button>
            <Link
              className="button button-secondary"
              target="_blank"
              href={`/store/${current.shop.subdomain}${current.shop.status === "draft" ? "?preview=true" : ""}`}
            >
              Open saved storefront <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
      </header>
      {!shopId ? (
        <section className="website-start">
          <Store size={32} />
          <h2>Start with your shop.</h2>
          <p>Create your shop before adding its storefront content.</p>
          <Link className="button button-primary" href="/onboarding">
            Set up your shop
          </Link>
        </section>
      ) : loading ? (
        <p role="status">Loading your storefront…</p>
      ) : !current ? (
        <section role="alert">
          <p>{error || "Storefront could not be loaded."}</p>
          <Button onClick={reloadSaved}>Try again</Button>
        </section>
      ) : (
        <form onSubmit={save}>
          <nav className="store-design-nav" aria-label="Store design tools">
            {["Themes", "Branding", "Homepage", "Sections", "Preview"].map(
              (v) => (
                <button
                  type="button"
                  key={v}
                  aria-current={mode === v ? "page" : undefined}
                  onClick={() => setMode(v)}
                >
                  {v}
                </button>
              ),
            )}
          </nav>
          <div className="website-editor-bar">
            <div>
              <span className="website-store-dot" />
              {current.shop.name}
              <small>
                {dirty
                  ? "Unsaved changes"
                  : current.hasUnpublishedChanges
                    ? "Unpublished draft"
                    : current.shop.status === "launched"
                      ? "Live storefront"
                      : "Draft storefront"}
              </small>
            </div>
            <div className="store-design-publish-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={!dirty || saving}
                onClick={() => void persist(draft, false)}
              >
                Save draft
              </Button>
              <Button
                type="submit"
                loading={saving}
                disabled={(!dirty && !current.hasUnpublishedChanges) || saving}
              >
                {current.shop.status === "launched"
                  ? "Publish changes"
                  : "Save storefront"}
              </Button>
            </div>
          </div>
          {notice && (
            <p className="website-feedback" role="status">
              <Check size={16} />
              {notice}
            </p>
          )}
          {error && (
            <div className="website-error" role="alert">
              <p>{error}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (
                    !dirty ||
                    window.confirm(
                      "Reload saved content and discard your unsaved edits?",
                    )
                  )
                    reloadSaved();
                }}
              >
                Reload saved content
              </Button>
            </div>
          )}
          {mode === "Themes" ? (
            <section className="store-theme-gallery">
              <div className="store-theme-gallery-heading">
                <h2>A complete storefront, already considered.</h2>
                <p>
                  Five distinct layouts. One catalog. Preview with your
                  products, then choose the home that suits your shop.
                </p>
              </div>
              <div className="store-theme-gallery-grid">
                {storefrontThemes.map((theme) => (
                  <article
                    className="store-theme-choice"
                    key={theme.id}
                    data-selected={
                      getStorefrontTheme(
                        draft.design.themeId || current.shop.selectedTemplateId,
                      ).id === theme.id
                    }
                  >
                    <ThemeGalleryPreview
                      themeId={theme.id}
                      shopName={draft.storeName || current.shop.name}
                      products={current.products}
                      coverImage={draft.coverImage}
                      headline={draft.headline}
                    />
                    <div className="store-theme-choice-copy">
                      <span>{theme.category}</span>
                      <h3>{theme.name}</h3>
                      <p>{theme.description}</p>
                      <div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setPreviewTheme(theme.id);
                            setMode("Preview");
                          }}
                        >
                          Preview {theme.name}
                        </Button>
                        <Button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            const content = {
                              ...draft,
                              design: { ...draft.design, themeId: theme.id },
                            };
                            setDraft(content);
                            setPreviewTheme(theme.id);
                            void persist(content, false);
                          }}
                        >
                          Use this theme
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <p className="website-field-note">
                Choosing a theme saves a draft. Publish changes to update the
                live store. Your products and orders stay in the same catalog.
              </p>
            </section>
          ) : mode === "Preview" ? (
            <section className="store-design-full-preview">
              <div className="store-preview-controls">
                <div>
                  <h2>
                    {
                      getStorefrontTheme(
                        previewTheme ||
                          draft.design.themeId ||
                          current.shop.selectedTemplateId,
                      ).name
                    }{" "}
                    preview
                  </h2>
                  <p>
                    {dirty
                      ? "Save your draft to preview the latest content."
                      : commerceUi.orders
                        ? "Your saved draft, with real catalog data. Checkout is disabled in preview."
                        : "Your saved draft, with real catalog data."}
                  </p>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-pressed={!mobile}
                    onClick={() => setMobile(false)}
                  >
                    Desktop preview
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-pressed={mobile}
                    onClick={() => setMobile(true)}
                  >
                    Mobile preview
                  </Button>
                </div>
              </div>
              <iframe
                key={`${current.version}-${previewTheme}`}
                title="Live storefront preview"
                className={mobile ? "mobile" : ""}
                src={`/store/${current.shop.subdomain}?preview=true&theme=${previewTheme || draft.design.themeId || current.shop.selectedTemplateId}&v=${current.version}`}
              />
            </section>
          ) : (
            <div className="website-editor-grid">
              <aside className="website-editor-controls">
                <div className="website-completion">
                  <strong>{completion} of 5 content essentials</strong>
                  <progress max={5} value={completion} />
                  <p>
                    Add a headline, cover, story, contact and FAQ to give buyers
                    more context.
                  </p>
                </div>
                {mode === "Homepage" && (
                  <div
                    className="website-editor-tabs"
                    role="group"
                    aria-label="Storefront sections"
                  >
                    {tabs.map((name, i) => (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={tab === i}
                        onClick={() => setTab(i)}
                      >
                        {name}
                        <ArrowUpRight size={13} />
                      </button>
                    ))}
                  </div>
                )}
                <fieldset disabled={saving} className="website-fields">
                  <legend>{mode === "Homepage" ? tabs[tab] : mode}</legend>
                  {mode === "Branding" && (
                    <>
                      {field("storeName", "Store display name", 120)}
                      <ImageField
                        label="Store logo"
                        value={draft.logoUrl}
                        onChange={(v) => change("logoUrl", v)}
                      />
                      <label className="store-design-select">
                        Brand color
                        <select
                          value={draft.design.accent}
                          onChange={(e) =>
                            change("design", {
                              ...draft.design,
                              accent: e.target
                                .value as StorefrontContent["design"]["accent"],
                            })
                          }
                        >
                          {storefrontAccentOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="store-design-select">
                        Font set
                        <select
                          value={draft.design.fontSet}
                          onChange={(e) =>
                            change("design", {
                              ...draft.design,
                              fontSet: e.target
                                .value as StorefrontContent["design"]["fontSet"],
                            })
                          }
                        >
                          {storefrontFontOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="website-field-note">
                        Curated colors and type pairs preserve the theme’s
                        layout and readability. Store display name changes your
                        storefront branding.
                      </p>
                    </>
                  )}
                  {mode === "Sections" && (
                    <>
                      <p className="website-field-note">
                        Turn sections on or off. Move enabled homepage sections
                        using the arrows. The footer stays at the end. Empty
                        content stays hidden.
                      </p>
                      {[
                        ...draft.design.sections.filter((s) => s !== "footer"),
                        ...(
                          [
                            "hero",
                            "categories",
                            "featured",
                            "catalog",
                            "about",
                            "reviews",
                            "policies",
                            "contact",
                            "tracking",
                          ] as StorefrontSectionId[]
                        ).filter((s) => !draft.design.sections.includes(s)),
                        "footer" as const,
                      ]
                        .filter(
                          (section) =>
                            commerceUi.orders || section !== "tracking",
                        )
                        .map((section) => (
                          <div className="store-section-setting" key={section}>
                            <label>
                              <input
                                type="checkbox"
                                checked={draft.design.sections.includes(
                                  section,
                                )}
                                onChange={(e) =>
                                  change("design", {
                                    ...draft.design,
                                    sections: e.target.checked
                                      ? [...draft.design.sections, section]
                                      : draft.design.sections.filter(
                                          (s) => s !== section,
                                        ),
                                  })
                                }
                              />
                              {
                                {
                                  hero: "Hero",
                                  categories: "Categories",
                                  featured: "Featured products & collections",
                                  catalog: "Product catalog",
                                  reviews: "Reviews",
                                  about: "About store",
                                  policies: "Policies",
                                  contact: "Contact & FAQs",
                                  tracking: "Order tracking",
                                  footer: "Footer",
                                }[section]
                              }
                            </label>
                            {section !== "footer" &&
                              draft.design.sections.includes(section) && (
                                <div>
                                  {[-1, 1].map((delta) => (
                                    <button
                                      key={delta}
                                      type="button"
                                      aria-label={`Move ${section} ${delta < 0 ? "up" : "down"}`}
                                      disabled={
                                        delta < 0
                                          ? draft.design.sections.indexOf(
                                              section,
                                            ) === 0
                                          : draft.design.sections.indexOf(
                                              section,
                                            ) >=
                                            draft.design.sections.length - 1
                                      }
                                      onClick={() => {
                                        const list = [...draft.design.sections],
                                          i = list.indexOf(section);
                                        [list[i], list[i + delta]] = [
                                          list[i + delta],
                                          list[i],
                                        ];
                                        change("design", {
                                          ...draft.design,
                                          sections: list,
                                        });
                                      }}
                                    >
                                      {delta < 0 ? "↑" : "↓"}
                                    </button>
                                  ))}
                                </div>
                              )}
                          </div>
                        ))}
                    </>
                  )}

                  {mode === "Homepage" && tab === 0 && (
                    <>
                      {field("announcement", "Announcement (optional)", 140)}
                      {field("headline", "Storefront headline", 100)}
                      {field("description", "Store description", 500, true)}
                      <ImageField
                        label="Store logo"
                        value={draft.logoUrl}
                        onChange={(v) => change("logoUrl", v)}
                      />
                      <ImageField
                        label="Cover image"
                        value={draft.coverImage}
                        onChange={(v) => change("coverImage", v)}
                      />
                      <p className="website-field-note">
                        A wide photograph works best for the cover. Empty
                        content stays hidden. Store name comes from your shop
                        setup.
                      </p>
                    </>
                  )}
                  {mode === "Homepage" && tab === 1 && (
                    <>
                      <h3>Featured products</h3>
                      <p>
                        Choose up to eight products. Draft products stay hidden
                        from buyers until activated.
                      </p>
                      <div className="website-product-picks">
                        {current.products.map((p) => (
                          <label key={p.id}>
                            <input
                              type="checkbox"
                              checked={draft.featuredProductIds.includes(p.id)}
                              disabled={
                                !draft.featuredProductIds.includes(p.id) &&
                                draft.featuredProductIds.length >= 8
                              }
                              onChange={(e) =>
                                change(
                                  "featuredProductIds",
                                  e.target.checked
                                    ? [...draft.featuredProductIds, p.id]
                                    : draft.featuredProductIds.filter(
                                        (id) => id !== p.id,
                                      ),
                                )
                              }
                            />
                            {p.name}
                            <small>{p.status}</small>
                          </label>
                        ))}
                      </div>
                      {!current.products.length && (
                        <Link href="/products">Add products in Inventory</Link>
                      )}
                      <h3>Collections</h3>
                      {draft.collections.map((collection, i) => (
                        <div className="website-repeat" key={i}>
                          <Input
                            label={`Collection ${i + 1} title`}
                            maxLength={70}
                            required
                            value={collection.title}
                            onChange={(e) =>
                              change(
                                "collections",
                                draft.collections.map((c, n) =>
                                  n === i ? { ...c, title: e.target.value } : c,
                                ),
                              )
                            }
                          />
                          <Input
                            label={`Collection ${i + 1} description`}
                            maxLength={200}
                            value={collection.description}
                            onChange={(e) =>
                              change(
                                "collections",
                                draft.collections.map((c, n) =>
                                  n === i
                                    ? { ...c, description: e.target.value }
                                    : c,
                                ),
                              )
                            }
                          />
                          <div className="website-product-picks">
                            {current.products.map((p) => (
                              <label key={p.id}>
                                <input
                                  type="checkbox"
                                  checked={collection.productIds.includes(p.id)}
                                  onChange={(e) =>
                                    change(
                                      "collections",
                                      draft.collections.map((c, n) =>
                                        n === i
                                          ? {
                                              ...c,
                                              productIds: e.target.checked
                                                ? [...c.productIds, p.id]
                                                : c.productIds.filter(
                                                    (id) => id !== p.id,
                                                  ),
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                />
                                {p.name}
                              </label>
                            ))}
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              change(
                                "collections",
                                draft.collections.filter((_, n) => n !== i),
                              )
                            }
                          >
                            <Trash2 size={14} />
                            Remove collection
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={
                          draft.collections.length >= 6 ||
                          !current.products.length
                        }
                        onClick={() =>
                          change("collections", [
                            ...draft.collections,
                            { title: "", description: "", productIds: [] },
                          ])
                        }
                      >
                        <Plus size={16} />
                        Add collection
                      </Button>
                    </>
                  )}
                  {mode === "Homepage" && tab === 2 && (
                    <>
                      {field("storyTitle", "Story heading", 100)}
                      {field("story", "About your store", 3000, true)}
                      <ImageField
                        label="Story image"
                        value={draft.storyImage}
                        onChange={(v) => change("storyImage", v)}
                      />
                      <p className="website-field-note">
                        Tell buyers who you are, what you make or select, and
                        why you started. Only include claims you can stand
                        behind.
                      </p>
                    </>
                  )}
                  {mode === "Homepage" && tab === 3 && (
                    <>
                      {field("email", "Public contact email", 254)}
                      {field("phone", "Public phone number", 40)}
                      {field("address", "Public address (optional)", 300, true)}
                      {field("instagram", "Instagram URL", 2048)}
                      {field("facebook", "Facebook URL", 2048)}
                      <section
                        id="product-contact-settings"
                        className="website-contact-settings"
                        aria-label="Product contact buttons"
                      >
                        <h3>Product contact buttons</h3>
                        <p className="website-field-note">
                          Let buyers contact you directly from a product. Add
                          either channel or both. Leave a channel blank to hide
                          its button.
                        </p>
                        <Input
                          label="WhatsApp business number"
                          value={draft.whatsappNumber || ""}
                          onChange={(e) =>
                            change("whatsappNumber", e.target.value)
                          }
                          error={issues.whatsappNumber}
                          placeholder="+880 1XXXXXXXXX"
                          hint="Include the country code. Use a number registered with WhatsApp."
                        />
                        <Input
                          label="Messenger link"
                          value={draft.messengerUrl || ""}
                          onChange={(e) =>
                            change("messengerUrl", e.target.value)
                          }
                          error={issues.messengerUrl}
                          placeholder="https://m.me/yourpage"
                          hint="Your business page’s m.me link. Buyers will copy the message and paste it in Messenger."
                        />
                        <Textarea
                          label="Buyer message"
                          rows={7}
                          value={draft.contactMessage || ""}
                          onChange={(e) =>
                            change("contactMessage", e.target.value)
                          }
                          error={
                            messageWordCount(draft.contactMessage || "") >
                            CONTACT_MESSAGE_WORD_LIMIT
                              ? "Keep the message to 500 words or fewer."
                              : issues.contactMessage || undefined
                          }
                          hint={`${messageWordCount(draft.contactMessage || "")} / 500 words. This draft opens for the buyer to review and send.`}
                        />
                        <p className="website-field-note">
                          Use {"{shop_name}"}, {"{product_name}"},{" "}
                          {"{product_price}"}, {"{product_url}"} or{" "}
                          {"{variant}"} for the selected product’s details. The
                          500-word limit applies to your template.
                        </p>
                        {!draft.contactMessage && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              change(
                                "contactMessage",
                                "Hi {shop_name}!\nI’m interested in {product_name} ({product_price}).\n{product_url}\nPlease share more details.",
                              )
                            }
                          >
                            Use example message
                          </Button>
                        )}
                      </section>
                      <p className="website-field-note">
                        These details are visible to buyers. Use business
                        contact information.
                      </p>
                      {field("delivery", "Delivery information", 1000, true)}
                      {field("payment", "Payment information", 1000, true)}
                      {field("returns", "Returns information", 1000, true)}
                      <p className="website-field-note">
                        Describe your existing policies. This content does not
                        change configured charges, payment processing or return
                        settings.
                      </p>
                    </>
                  )}
                  {mode === "Homepage" && tab === 4 && (
                    <>
                      {draft.faqs.map((faq, i) => (
                        <div className="website-repeat" key={i}>
                          <Input
                            label={`Question ${i + 1}`}
                            required
                            maxLength={160}
                            value={faq.question}
                            onChange={(e) =>
                              change(
                                "faqs",
                                draft.faqs.map((f, n) =>
                                  n === i
                                    ? { ...f, question: e.target.value }
                                    : f,
                                ),
                              )
                            }
                          />
                          <Textarea
                            label={`Answer ${i + 1}`}
                            required
                            rows={4}
                            maxLength={1000}
                            value={faq.answer}
                            onChange={(e) =>
                              change(
                                "faqs",
                                draft.faqs.map((f, n) =>
                                  n === i
                                    ? { ...f, answer: e.target.value }
                                    : f,
                                ),
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              change(
                                "faqs",
                                draft.faqs.filter((_, n) => n !== i),
                              )
                            }
                          >
                            <Trash2 size={14} />
                            Remove question
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={draft.faqs.length >= 8}
                        onClick={() =>
                          change("faqs", [
                            ...draft.faqs,
                            { question: "", answer: "" },
                          ])
                        }
                      >
                        <Plus size={16} />
                        Add question
                      </Button>
                    </>
                  )}
                  {Object.entries(issues)
                    .filter(([, message]) => Boolean(message))
                    .map(([key, message]) => (
                      <p role="alert" key={key}>
                        {key}: {message}
                      </p>
                    ))}
                </fieldset>
              </aside>
              <section
                className="website-preview-area"
                aria-label="Storefront content preview"
              >
                <div className="website-preview-toolbar">
                  <span>
                    Live content preview ·{" "}
                    {dirty ? "Unsaved changes" : "Saved content"}
                  </span>
                  <div>
                    <button
                      type="button"
                      aria-label="Desktop preview"
                      aria-pressed={!mobile}
                      onClick={() => setMobile(false)}
                    >
                      <Monitor size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Mobile preview"
                      aria-pressed={mobile}
                      onClick={() => setMobile(true)}
                    >
                      <Smartphone size={16} />
                    </button>
                  </div>
                </div>
                <div className={`website-preview ${mobile ? "mobile" : ""}`}>
                  <ThemeGalleryPreview
                    themeId={
                      draft.design.themeId || current.shop.selectedTemplateId
                    }
                    shopName={draft.storeName || current.shop.name}
                    products={current.products}
                    coverImage={draft.coverImage}
                    headline={draft.headline}
                    device={mobile ? "mobile" : "desktop"}
                  />
                  <p className="website-field-note">
                    Design outline with your content. Open Preview to browse the
                    complete saved storefront.
                  </p>
                  <div className="website-preview-shop">
                    {draft.logoUrl && (
                      <BrandImage
                        key={draft.logoUrl}
                        src={draft.logoUrl}
                        alt="Logo"
                      />
                    )}
                    <strong>{current.shop.name}</strong>
                    <Store size={16} />
                  </div>
                  {draft.announcement && (
                    <div className="brand-announcement">
                      {draft.announcement}
                    </div>
                  )}
                  <StorefrontHero content={draft} name={current.shop.name} />
                  <div id="collection" className="website-preview-products">
                    <h2>Your collection</h2>
                    <p>
                      {current.products.length} existing product
                      {current.products.length === 1 ? "" : "s"} · Product
                      images and prices appear on your saved storefront.
                    </p>
                    {draft.featuredProductIds.map((id) => (
                      <span key={id}>
                        {current.products.find((p) => p.id === id)?.name}
                      </span>
                    ))}
                    {draft.collections.map((c, i) => (
                      <div key={i}>
                        <h3>{c.title || "Collection title"}</h3>
                        <p>{c.description}</p>
                        <small>{c.productIds.length} selected products</small>
                      </div>
                    ))}
                  </div>
                  <StorefrontDetails content={draft} name={current.shop.name} />
                </div>
              </section>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
