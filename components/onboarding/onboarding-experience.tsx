"use client";
import Link from "next/link";
import { useSession } from "@/components/auth/session-provider";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Layers2,
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldCheck,
  Store,
  Package,
  RefreshCw,
  AlertCircle,
  Upload,
  Trash2,
} from "lucide-react";
import { onboardingService as service } from "@/services/commerce";
import { ApiError } from "@/lib/api/client";
import { rememberShop, rememberedShop, formatMoney, storefrontUrl } from "@/adapters/commerce";
import type {
  OnboardingState,
  StoreTemplate,
  Language,
  AiMode,
} from "@/types/commerce";
import {
  COUNTRIES,
  CURRENCIES,
  SUPPORTED_LANGUAGES,
  findCountry,
  type CountryData,
} from "@/config/countries";
import {
  humanizeProductError,
  validateOnboardingFirstProduct,
} from "@/lib/validation/product-errors";

const steps = [
  "Start",
  "Shop",
  "First product",
  "Channels",
  "AI mode",
  "Template",
  "Launch",
];

const initial = {
  ownerName: "",
  email: "",
  shopName: "",
  subdomain: "",
  category: "fashion",
  country: "BD",
  currency: "BDT",
  language: "bn" as Language,
  displayName: "",
  address: "",
  deliveryCharge: "0",
  returnDays: "3",
  codAllowed: "true",
  productName: "",
  price: "",
  stock: "",
  productImageUrl: "",
  aiMode: "suggest",
  templateId: "",
};

const MAX_PRODUCT_IMAGE_SIZE = 10 * 1024 * 1024;

export default function OnboardingExperience({
  enabled,
}: {
  enabled: boolean;
}) {
  const { user } = useSession();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    ...initial,
    ownerName: user.name,
    email: user.email,
  });
  const [templates, setTemplates] = useState<StoreTemplate[]>([]);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState("");
  const [resume, setResume] = useState("");
  const [checked, setChecked] = useState(false);
  const [launchConsent, setLaunchConsent] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Country, Currency & Language defaults management
  const [userModifiedCurrency, setUserModifiedCurrency] = useState(false);
  const [userModifiedLanguage, setUserModifiedLanguage] = useState(false);
  const [pendingCountryChange, setPendingCountryChange] =
    useState<CountryData | null>(null);

  // Meta connection UX
  const [metaAttempted, setMetaAttempted] = useState(false);

  // Step 2 product validation
  const [productErrors, setProductErrors] = useState<Record<string, string>>(
    {},
  );

  const selectedCountry = findCountry(values.country) ?? COUNTRIES[0];

  function accept(next: OnboardingState) {
    setState(next);
    rememberShop(next.shop.id, next.shop.displayName);
    setResume(next.shop.id);
    window.history.replaceState(
      null,
      "",
      `/onboarding?shop=${encodeURIComponent(next.shop.id)}`,
    );

    const savedCountry =
      findCountry(next.shop.country)?.code ??
      next.shop.country ??
      initial.country;
    setValues((v) => ({
      ...v,
      country: savedCountry,
      currency: next.shop.currency ?? v.currency,
      language: next.shop.language ?? v.language,
      displayName: next.shop.displayName,
      subdomain: next.shop.subdomain,
      address: next.shop.address ?? "",
      deliveryCharge: String(next.shop.policyDefaults.deliveryCharge),
      returnDays: String(next.shop.policyDefaults.returnDays),
      codAllowed: String(next.shop.policyDefaults.codAllowed),
      aiMode: next.shop.aiMode,
      templateId: next.shop.selectedTemplateId ?? "",
    }));
    setTemplates(next.templates);
  }

  async function retrieve(id: string) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) {
      setError(
        new ApiError(
          400,
          "VALIDATION_ERROR",
          "Enter the saved shop ID from your setup URL.",
        ),
      );
      return;
    }
    setPending(true);
    setError(null);
    try {
      const next = await service.get(id);
      accept(next);
      setStep(
        next.shop.status === "launched"
          ? 6
          : next.shop.onboardingStep === "shop"
            ? 1
            : next.shop.onboardingStep === "products"
              ? 2
              : next.shop.onboardingStep === "channels"
                ? 3
                : next.shop.onboardingStep === "ai_mode"
                  ? 4
                  : 5,
      );
      setNotice("Saved shop loaded.");
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    const controller = new AbortController();
    const id =
      new URLSearchParams(window.location.search).get("shop") ??
      rememberedShop();
    if (id) {
      service
        .get(id, controller.signal)
        .then((next) => {
          if (active) {
            accept(next);
            setStep(
              next.shop.status === "launched"
                ? 6
                : next.shop.onboardingStep === "shop"
                  ? 1
                  : next.shop.onboardingStep === "products"
                    ? 2
                    : next.shop.onboardingStep === "channels"
                      ? 3
                      : next.shop.onboardingStep === "ai_mode"
                        ? 4
                        : 5,
            );
          }
        })
        .catch((e) => {
          if (active) setError(e as ApiError);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      service
        .templates()
        .then((data) => {
          if (active) setTemplates(data.templates);
        })
        .catch((e) => {
          if (active) setError(e as ApiError);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled]);

  function change(name: keyof typeof initial, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
    if (name === "subdomain") setChecked(false);
    setNotice("");

    // Live error clearing for product fields
    if (
      name === "productName" &&
      value.trim().length >= 2 &&
      value.trim().length <= 160
    ) {
      setProductErrors((prev) => {
        const next = { ...prev };
        delete next.productName;
        return next;
      });
    } else if (
      name === "price" &&
      Number(value) > 0 &&
      Number(value) <= 100000000
    ) {
      setProductErrors((prev) => {
        const next = { ...prev };
        delete next.price;
        return next;
      });
    } else if (
      name === "stock" &&
      value !== "" &&
      Number(value) >= 0 &&
      Number(value) <= 1000000 &&
      Number.isInteger(Number(value))
    ) {
      setProductErrors((prev) => {
        const next = { ...prev };
        delete next.stock;
        return next;
      });
    }
  }

  async function uploadCompressedImage(image: string) {
    const response = await fetch("/api/uploads/product-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      url?: string;
      message?: string;
    };
    if (!response.ok || !data.url) {
      throw new ApiError(
        response.status,
        "IMAGE_UPLOAD_FAILED",
        data.message || "Image upload failed.",
      );
    }
    return data.url;
  }

  function compressImage(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/webp", 0.72));
        };
        img.onerror = () => reject(new Error("Could not read this image."));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error("Could not read this image."));
      reader.readAsDataURL(file);
    });
  }

  async function handleProductImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setError(
        new ApiError(
          400,
          "INVALID_IMAGE",
          "Please select a valid image file (PNG, JPG, WEBP).",
        ),
      );
      return;
    }
    if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
      setError(
        new ApiError(
          413,
          "IMAGE_TOO_LARGE",
          "Each product image must be 10MB or smaller.",
        ),
      );
      return;
    }
    setPending(true);
    setError(null);
    try {
      change(
        "productImageUrl",
        await uploadCompressedImage(await compressImage(file)),
      );
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setPending(false);
    }
  }

  // Country selection with confirmation if dependent values were modified
  function handleCountrySelect(countryCodeOrName: string) {
    const target = findCountry(countryCodeOrName);
    if (!target) return;

    if (userModifiedCurrency || userModifiedLanguage) {
      setPendingCountryChange(target);
    } else {
      applyCountryChange(target, true);
    }
  }

  function applyCountryChange(country: CountryData, updateDefaults: boolean) {
    setValues((v) => ({
      ...v,
      country: country.code,
      currency: updateDefaults ? country.defaultCurrency : v.currency,
      language: updateDefaults ? country.defaultLanguage : v.language,
    }));
    if (updateDefaults) {
      setUserModifiedCurrency(false);
      setUserModifiedLanguage(false);
    }
    setPendingCountryChange(null);
  }

  function handleCurrencyChange(code: string) {
    setUserModifiedCurrency(true);
    change("currency", code);
  }

  function handleLanguageChange(lang: Language) {
    setUserModifiedLanguage(true);
    change("language", lang);
  }

  async function checkAddress() {
    if (values.subdomain.trim().length < 3) {
      setError(
        new ApiError(
          400,
          "VALIDATION_ERROR",
          "Use 3–40 characters for the shop address.",
        ),
      );
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await service.checkSubdomain(values.subdomain);
      change("subdomain", result.subdomain);
      setChecked(result.available);
      setNotice(
        result.available
          ? "This address is available. It is reserved when you save."
          : `That address is taken. Try ${result.suggestions.join(", ")}.`,
      );
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setPending(false);
    }
  }

  async function skipMetaStep() {
    if (!state || pending) return;
    setPending(true);
    setError(null);
    try {
      const next = await service.skipMeta(state.shop.id);
      accept(next);
      setStep(4);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setPending(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !enabled) return;

    // Step 2 product form pre-validation
    if (step === 2) {
      const checkResult = validateOnboardingFirstProduct(
        values.productName,
        values.price,
        values.stock,
      );
      if (!checkResult.isValid) {
        setProductErrors(checkResult.errors);
        if (checkResult.firstField) {
          const el = document.getElementById(`setup-${checkResult.firstField}`);
          el?.focus();
        }
        return;
      }
    }

    setPending(true);
    setError(null);
    setNotice("");
    try {
      let next: OnboardingState;
      if (step === 0)
        next = await service.start({
          ownerName: values.ownerName.trim(),
          ...(values.email.trim() ? { email: values.email.trim() } : {}),
          shopName: values.shopName.trim(),
          subdomain: values.subdomain.trim(),
          category: values.category,
          country: values.country,
          currency: values.currency.toUpperCase(),
          language: values.language as Language,
        });
      else if (!state)
        throw new ApiError(400, "NO_SHOP", "Start or resume a shop first.");
      else if (step === 1)
        next = await service.updateShop(state.shop.id, {
          displayName: values.displayName.trim(),
          subdomain: values.subdomain,
          ...(values.address.trim() ? { address: values.address.trim() } : {}),
          policyDefaults: {
            deliveryCharge: Number(values.deliveryCharge),
            returnDays: Number(values.returnDays),
            codAllowed: values.codAllowed === "true",
          },
        });
      else if (step === 2)
        next = await service.addProduct(state.shop.id, {
          name: values.productName.trim(),
          price: Number(values.price),
          stock: Number(values.stock),
          ...(values.productImageUrl
            ? { imageUrl: values.productImageUrl }
            : {}),
        });
      else if (step === 3) next = await service.skipMeta(state.shop.id);
      else if (step === 4)
        next = await service.setAiMode(state.shop.id, values.aiMode as AiMode);
      else if (step === 5)
        next = await service.selectTemplate(state.shop.id, values.templateId);
      else {
        if (!launchConsent)
          throw new ApiError(
            400,
            "CONSENT_REQUIRED",
            "Confirm publication before launching.",
          );
        next = await service.launch(state.shop.id);
      }
      accept(next);
      setNotice(
        step === 6
          ? "Your storefront has been published."
          : "Saved to your shop.",
      );
      if (step === 2)
        setValues((v) => ({
          ...v,
          productName: "",
          price: "",
          stock: "",
          productImageUrl: "",
        }));
      setStep(Math.min(6, step + 1));
      requestAnimationFrame(() => heading.current?.focus());
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(
              0,
              "UNEXPECTED",
              "Something interrupted the save. Reload the saved shop before retrying.",
            );

      // Map backend validation errors for product fields
      if (step === 2 && err.issues && err.issues.length > 0) {
        const errMap: Record<string, string> = {};
        err.issues.forEach((iss) => {
          const human = humanizeProductError(iss.path, iss.message);
          if (iss.path[0] === "name") errMap.productName = human.message;
          else if (iss.path[0] === "price") errMap.price = human.message;
          else if (iss.path[0] === "stock") errMap.stock = human.message;
        });
        if (Object.keys(errMap).length > 0) {
          setProductErrors(errMap);
        }
      }
      setError(err);
    } finally {
      setPending(false);
    }
  }

  function field(
    name: keyof typeof initial,
    label: string,
    options: {
      type?: string;
      required?: boolean;
      min?: number;
      max?: number;
      step?: string;
      minLength?: number;
      maxLength?: number;
    } = {},
  ) {
    const customError = productErrors[name];
    const issue = error?.issues.find(
      (i) =>
        i.path[0] === name || (name === "productName" && i.path[0] === "name"),
    );
    const errorMessage =
      customError ||
      (issue
        ? humanizeProductError(issue.path, issue.message).message
        : undefined);
    const hasError = Boolean(errorMessage);

    return (
      <div className="setup-field">
        <label
          htmlFor={`setup-${name}`}
          className={hasError ? "text-danger" : undefined}
        >
          {label}
        </label>
        <input
          id={`setup-${name}`}
          name={name}
          type={options.type ?? "text"}
          value={values[name]}
          onChange={(e) => change(name, e.target.value)}
          disabled={pending}
          required={options.required ?? true}
          min={options.min}
          max={options.max}
          step={options.step}
          minLength={options.minLength}
          maxLength={options.maxLength ?? 200}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${name}-issue` : undefined}
        />
        {hasError && (
          <small id={`${name}-issue`} className="setup-field-error">
            {errorMessage}
          </small>
        )}
      </div>
    );
  }

  const launched = state?.shop.status === "launched";

  // Build language lists based on selected country
  const suggestedLangs = selectedCountry.suggestedLanguages
    .map((code) => SUPPORTED_LANGUAGES.find((l) => l.code === code)!)
    .filter(Boolean);

  const otherLangs = SUPPORTED_LANGUAGES.filter(
    (l) => !selectedCountry.suggestedLanguages.includes(l.code),
  );

  return (
    <div className="setup-site">
      <header className="setup-header">
        <Link href="/" className="launch-brand">
          <Layers2 size={24} />
          easy shop.
        </Link>
        <Link href="/dashboard" className="launch-link">
          Workspace <ArrowRight size={15} />
        </Link>
      </header>

      <div
        className="setup-boundary"
        role="region"
        aria-label="Development setup availability"
      >
        <ShieldCheck size={15} />
        {enabled
          ? "Your shop setup · Progress is saved to your account."
          : "Shop setup is unavailable here until secure account access is connected."}
      </div>

      <main className="setup-layout">
        <nav className="setup-progress" aria-label="Shop setup steps">
          {steps.map((label, i) => (
            <button
              key={label}
              aria-current={step === i ? "step" : undefined}
              disabled={
                pending ||
                loading ||
                (Boolean(state) && i === 0) ||
                !enabled ||
                (!state && i > 0) ||
                (Boolean(launched) && i !== 6)
              }
              onClick={() => {
                setStep(i);
                setError(null);
              }}
            >
              <span>
                {state && i < step ? (
                  <Check size={14} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              {label}
            </button>
          ))}
        </nav>

        <section className="setup-main">
          <div className="setup-title">
            <span>Make it yours / {String(step + 1).padStart(2, "0")}</span>
            <h1 ref={heading} tabIndex={-1}>
              {launched
                ? "Your front door is open."
                : [
                    "A shop starts with you.",
                    "The details that build trust.",
                    "Give your shop a first product.",
                    "Start with your storefront.",
                    "Decide how AI should help.",
                    "Choose a starting direction.",
                    "One last look. Then launch.",
                  ][step]}
            </h1>
            <p>
              {launched
                ? "Your saved products are now available through the public storefront."
                : [
                    "Create your shop, or resume the one you already started.",
                    "Set a clear name, address and simple policies.",
                    "Add one real product. You can continue with a template instead.",
                    "Connect Facebook & Instagram for AI replies, or continue with website-only launch.",
                    "This saves your preferred mode. Live AI replies are not connected.",
                    "These are backend test references, not production themes. Selection saves metadata only.",
                    "Review the saved details. Launch makes this shop publicly readable.",
                  ][step]}
            </p>
          </div>

          {loading ? (
            <div role="status" className="setup-loading">
              Loading saved setup…
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="setup-error">
                  <strong>{error.message}</strong>
                  {error.issues.length > 0 && (
                    <ul>
                      {error.issues.map((issue, i) => {
                        const human = humanizeProductError(
                          issue.path,
                          issue.message,
                        );
                        return <li key={i}>{human.message}</li>;
                      })}
                    </ul>
                  )}
                  {state && (
                    <button
                      type="button"
                      className="launch-link"
                      onClick={() => retrieve(state.shop.id)}
                      disabled={pending}
                    >
                      <RefreshCw size={14} /> Reload saved shop
                    </button>
                  )}
                </div>
              )}

              {notice && (
                <p role="status" className="setup-notice">
                  <Check size={16} />
                  {notice}
                </p>
              )}

              {launched ? (
                <div className="setup-complete">
                  <Store size={36} />
                  <h2>{state.shop.displayName}</h2>
                  <Link
                    href={storefrontUrl(state.shop.subdomain)}
                    className="launch-button"
                  >
                    Open storefront <ArrowRight size={16} />
                  </Link>
                  <Link href="/dashboard" className="launch-link">
                    Return to your workspace
                  </Link>
                  <p>
                    Store ID: <code>{state.shop.id}</code>
                  </p>
                  <small>
                    Checkout and live messaging are not connected. Template
                    metadata remains test-only.
                  </small>
                </div>
              ) : (
                <form onSubmit={save} noValidate aria-busy={pending}>
                  <fieldset disabled={pending || !enabled}>
                    <legend className="sr-only">{steps[step]} details</legend>

                    {/* Step 0: Shop Basics */}
                    {step === 0 && (
                      <>
                        <div className="setup-field-grid">
                          {field("ownerName", "Your name", {
                            minLength: 2,
                            maxLength: 120,
                          })}
                          {field("email", "Email (optional)", {
                            type: "email",
                            required: false,
                            maxLength: 200,
                          })}
                          {field("shopName", "Shop name", {
                            minLength: 2,
                            maxLength: 120,
                          })}
                          {field("subdomain", "Shop address", {
                            minLength: 3,
                            maxLength: 40,
                          })}
                        </div>

                        <button
                          type="button"
                          className="launch-link"
                          onClick={checkAddress}
                        >
                          {checked ? <Check size={14} /> : <Store size={14} />}{" "}
                          Check address availability
                        </button>

                        <div className="setup-field-grid">
                          {field("category", "Business category", {
                            minLength: 2,
                            maxLength: 80,
                          })}

                          {/* Country selector */}
                          <div className="setup-field">
                            <label htmlFor="setup-country">Country</label>
                            <select
                              id="setup-country"
                              name="country"
                              aria-label="Country"
                              value={selectedCountry.code}
                              disabled={pending}
                              onChange={(e) =>
                                handleCountrySelect(e.target.value)
                              }
                            >
                              {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.name} ({c.code})
                                </option>
                              ))}
                            </select>
                            <small className="field-hint">
                              Selected: {selectedCountry.name} · Code:{" "}
                              {selectedCountry.code}
                            </small>
                          </div>

                          {/* Currency selector */}
                          <div className="setup-field">
                            <label htmlFor="setup-currency">Currency</label>
                            <select
                              id="setup-currency"
                              name="currency"
                              aria-label="Currency"
                              value={values.currency}
                              disabled={pending}
                              onChange={(e) =>
                                handleCurrencyChange(e.target.value)
                              }
                            >
                              {CURRENCIES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Language selector */}
                          <div className="setup-field">
                            <label htmlFor="setup-language">
                              Primary customer language
                            </label>
                            <select
                              id="setup-language"
                              name="language"
                              aria-label="Primary customer language"
                              value={values.language}
                              disabled={pending}
                              onChange={(e) =>
                                handleLanguageChange(e.target.value as Language)
                              }
                            >
                              <optgroup
                                label={`Suggested for ${selectedCountry.name}`}
                              >
                                {suggestedLangs.map((l) => (
                                  <option key={l.code} value={l.code}>
                                    {l.label}
                                  </option>
                                ))}
                              </optgroup>
                              {otherLangs.length > 0 && (
                                <optgroup label="Other supported languages">
                                  {otherLangs.map((l) => (
                                    <option key={l.code} value={l.code}>
                                      {l.label}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                            <small className="field-hint">
                              Easy-Shop uses this as the default language for
                              storefront and AI-assisted customer replies where
                              supported.
                            </small>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Step 1: Policies & Address */}
                    {step === 1 && (
                      <>
                        <div className="setup-field-grid">
                          {field("displayName", "Display name", {
                            minLength: 1,
                          })}
                          {field("subdomain", "Shop address", {
                            minLength: 3,
                            maxLength: 40,
                          })}
                        </div>
                        {field("address", "Business address (optional)", {
                          required: false,
                        })}
                        <div className="setup-field-grid">
                          {field("deliveryCharge", "Delivery charge", {
                            type: "number",
                            min: 0,
                            max: 100000,
                            step: "0.01",
                          })}
                          {field("returnDays", "Return window (days)", {
                            type: "number",
                            min: 0,
                            max: 365,
                            step: "1",
                          })}
                        </div>
                        <label className="setup-check">
                          <input
                            type="checkbox"
                            checked={values.codAllowed === "true"}
                            onChange={(e) =>
                              change("codAllowed", String(e.target.checked))
                            }
                          />{" "}
                          Cash on delivery allowed
                        </label>
                      </>
                    )}

                    {/* Step 2: First Product */}
                    {step === 2 && (
                      <>
                        {state && state.products.length > 0 && (
                          <div className="setup-saved-products">
                            {state.products.map((p) => (
                              <p key={p.id}>
                                <Package size={15} />
                                {p.name}
                                <span>
                                  {formatMoney(p.price, state.shop.currency)} ·{" "}
                                  {p.stock} in stock
                                </span>
                              </p>
                            ))}
                            <button
                              type="button"
                              className="launch-link"
                              onClick={() => setStep(3)}
                            >
                              Continue with saved products{" "}
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        )}
                        {field("productName", "Product name", {
                          minLength: 2,
                          maxLength: 160,
                        })}
                        <div className="setup-field-grid">
                          {field(
                            "price",
                            `Price (${state?.shop.currency ?? values.currency})`,
                            {
                              type: "number",
                              min: 0.01,
                              max: 100000000,
                              step: "0.01",
                            },
                          )}
                          {field("stock", "Opening stock", {
                            type: "number",
                            min: 0,
                            max: 1000000,
                            step: "1",
                          })}
                        </div>
                        <div className="setup-product-image-field">
                          <span>Product image (optional)</span>
                          {values.productImageUrl ? (
                            <div className="setup-product-image-preview">
                              <img
                                src={values.productImageUrl}
                                alt="Uploaded product"
                              />
                              <button
                                type="button"
                                className="launch-link"
                                disabled={pending}
                                onClick={() => change("productImageUrl", "")}
                              >
                                <Trash2 size={14} /> Remove image
                              </button>
                            </div>
                          ) : (
                            <label className="setup-product-image-dropzone">
                              <Upload size={18} />
                              Upload product image
                              <small>PNG, JPG or WEBP. Max 10MB.</small>
                              <input
                                type="file"
                                accept="image/*"
                                disabled={pending}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleProductImage(file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                        <p className="setup-helper">
                          This creates a default variant, opening stock and
                          starter product image.
                        </p>
                        <button
                          type="button"
                          className="launch-link"
                          onClick={() => setStep(3)}
                        >
                          Choose a template instead
                        </button>
                      </>
                    )}

                    {/* Step 3: Channels / Meta */}
                    {step === 3 && (
                      <div className="setup-meta-panel">
                        <div className="setup-meta-header">
                          <Store size={28} />
                          <h2>Connect Facebook & Instagram</h2>
                          <p>
                            Link your Facebook Page and Instagram Professional
                            account to enable AI-assisted buyer replies for
                            comments, Messenger, and direct messages.
                          </p>
                        </div>

                        <div className="setup-meta-card">
                          <div className="setup-meta-channels">
                            <div className="setup-meta-channel-item">
                              <strong>Facebook Messenger</strong>
                              <small>Customer inquiries & order drafts</small>
                            </div>
                            <div className="setup-meta-channel-item">
                              <strong>Instagram Direct</strong>
                              <small>
                                DM replies & product availability questions
                              </small>
                            </div>
                          </div>

                          {metaAttempted && (
                            <div
                              role="status"
                              className="setup-meta-notice"
                              aria-live="polite"
                            >
                              <AlertCircle size={16} />
                              <div>
                                <strong>
                                  Meta connection is not configured in this
                                  development environment.
                                </strong>
                                <p>
                                  Required Meta App OAuth credentials are not
                                  configured locally. You can continue setup
                                  with a website-only storefront and connect
                                  channels later in Settings.
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="setup-meta-actions-primary">
                            <button
                              type="button"
                              className="launch-button"
                              disabled={pending}
                              onClick={() => {
                                setMetaAttempted(true);
                                setNotice("");
                              }}
                            >
                              Connect Facebook & Instagram
                            </button>

                            <button
                              type="button"
                              className="launch-button secondary"
                              disabled={pending}
                              aria-label="Skip for now (Skip Meta & continue)"
                              onClick={skipMetaStep}
                            >
                              Skip for now
                            </button>
                          </div>

                          <span className="setup-meta-channel-status">
                            Channel status:{" "}
                            {state?.channels.find((c) => c.provider === "meta")
                              ?.status ?? "Not connected"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Step 4: AI Mode */}
                    {step === 4 && (
                      <div className="setup-radio-group">
                        {[
                          {
                            value: "off",
                            title: "Off",
                            copy: "Keep automated assistance switched off.",
                          },
                          {
                            value: "suggest",
                            title: "Suggest only",
                            copy: "Save human review as your starting preference.",
                          },
                          {
                            value: "auto_low_risk",
                            title: "Auto, low risk",
                            copy: "Store this preference only. No automation runs in this phase.",
                          },
                        ].map((m) => (
                          <label key={m.value}>
                            <input
                              type="radio"
                              name="aiMode"
                              value={m.value}
                              checked={values.aiMode === m.value}
                              onChange={(e) => change("aiMode", e.target.value)}
                            />
                            <span>
                              <strong>{m.title}</strong>
                              <small>{m.copy}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Step 5: Template */}
                    {step === 5 && (
                      <div className="setup-radio-group">
                        {templates.length === 0 ? (
                          <p>
                            No template references are available. Reload setup
                            to retry.
                          </p>
                        ) : (
                          templates.map((t) => (
                            <label key={t.id}>
                              <input
                                required
                                type="radio"
                                name="template"
                                value={t.id}
                                checked={values.templateId === t.id}
                                onChange={(e) =>
                                  change("templateId", e.target.value)
                                }
                              />
                              <span>
                                <strong>{t.name}</strong>
                                <small>{t.notes}</small>
                                <em>
                                  {t.status.replaceAll("_", " ")} · {t.license}
                                </em>
                              </span>
                            </label>
                          ))
                        )}
                        {state?.products.length ? (
                          <button
                            type="button"
                            className="launch-link"
                            onClick={() => setStep(6)}
                          >
                            Continue without a template reference
                          </button>
                        ) : null}
                      </div>
                    )}

                    {/* Step 6: Launch Review */}
                    {step === 6 && state && (
                      <>
                        <dl className="setup-review">
                          <div>
                            <dt>Shop</dt>
                            <dd>{state.shop.displayName}</dd>
                          </div>
                          <div>
                            <dt>Address</dt>
                            <dd>{storefrontUrl(state.shop.subdomain)}</dd>
                          </div>
                          <div>
                            <dt>Catalog</dt>
                            <dd>{state.products.length} saved products</dd>
                          </div>
                          <div>
                            <dt>Template</dt>
                            <dd>
                              {state.shop.selectedTemplateId ??
                                "Default test reference"}
                            </dd>
                          </div>
                          <div>
                            <dt>AI preference</dt>
                            <dd>{state.shop.aiMode} · Service disconnected</dd>
                          </div>
                        </dl>
                        {state.launchChecklist.blockers.map((b) => (
                          <p key={b} className="setup-field-error">
                            {b}
                          </p>
                        ))}
                        <label className="setup-check">
                          <input
                            type="checkbox"
                            checked={launchConsent}
                            onChange={(e) => setLaunchConsent(e.target.checked)}
                            required
                          />{" "}
                          Publish this shop and its products to the public
                          storefront.
                        </label>
                      </>
                    )}

                    {/* Action Buttons */}
                    <div className="setup-actions">
                      {step > 0 && (
                        <button
                          type="button"
                          className="launch-link"
                          onClick={() => setStep(step - 1)}
                        >
                          <ArrowLeft size={15} /> Back
                        </button>
                      )}
                      <button
                        className="launch-button"
                        disabled={
                          pending ||
                          !enabled ||
                          (step === 6 &&
                            (!state?.launchChecklist.canLaunch ||
                              !launchConsent))
                        }
                        aria-label={
                          step === 3
                            ? "Skip for now (Skip Meta & continue)"
                            : undefined
                        }
                      >
                        {pending
                          ? "Saving…"
                          : step === 6
                            ? "Launch storefront"
                            : step === 3
                              ? "Skip for now"
                              : step === 0
                                ? "Create shop"
                                : "Save & continue"}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </fieldset>
                </form>
              )}

              {!launched && (
                <details className="setup-resume">
                  <summary>Resume a saved shop</summary>
                  <label htmlFor="resume-id">Saved shop ID</label>
                  <input
                    id="resume-id"
                    value={resume}
                    onChange={(e) => setResume(e.target.value)}
                    placeholder="Shop ID from your saved URL"
                  />
                  <button
                    type="button"
                    className="launch-link"
                    disabled={pending || !enabled}
                    onClick={() => retrieve(resume)}
                  >
                    Load saved shop <ArrowRight size={14} />
                  </button>
                  <small>
                    Saved changes are stored in the backend. Unsaved fields stay
                    in this page while you work.
                  </small>
                </details>
              )}
            </>
          )}
        </section>

        <aside className="setup-preview">
          <span>Store preview</span>
          <div className="setup-preview-phone">
            <div className="preview-speaker" />
            <div className="setup-preview-brand">
              {state
                ? values.displayName || state.shop.displayName
                : values.shopName || "Your shop name"}
            </div>
            <div className="setup-preview-cover">
              <Store size={32} />
              <p>
                A place for
                <br />
                your products.
              </p>
            </div>
            <div className="setup-preview-product">
              {values.productImageUrl || state?.products[0]?.imageUrl ? (
                <img
                  src={
                    values.productImageUrl ||
                    state?.products[0]?.imageUrl ||
                    ""
                  }
                  alt=""
                />
              ) : (
                <Package size={25} />
              )}
              <strong>
                {values.productName ||
                  state?.products[0]?.name ||
                  "Your first product"}
              </strong>
              <span>
                {values.price
                  ? formatMoney(
                      Number(values.price),
                      state?.shop.currency ?? values.currency,
                    )
                  : state?.products[0]
                    ? formatMoney(state.products[0].price, state.shop.currency)
                    : "Your price, clearly shown"}
              </span>
            </div>
          </div>
          <p>
            Preview updates as you type.
            <br />
            Saved details power your storefront.
          </p>
          {state && <code className="setup-id">Shop ID: {state.shop.id}</code>}
        </aside>
      </main>

      {/* Confirmation modal when changing country with modified dependent values */}
      {pendingCountryChange && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-country-title"
          className="setup-confirm-overlay"
        >
          <div className="setup-confirm-modal">
            <h3 id="confirm-country-title">
              Update defaults for {pendingCountryChange.name}?
            </h3>
            <p>
              You previously customized your currency or primary language.
              Changing country to {pendingCountryChange.name} can update your
              currency to{" "}
              <strong>{pendingCountryChange.defaultCurrency}</strong> and
              language to{" "}
              <strong>
                {
                  SUPPORTED_LANGUAGES.find(
                    (l) => l.code === pendingCountryChange.defaultLanguage,
                  )?.label
                }
              </strong>
              .
            </p>
            <div className="setup-confirm-actions">
              <button
                type="button"
                className="launch-button"
                onClick={() => applyCountryChange(pendingCountryChange, true)}
              >
                Update defaults
              </button>
              <button
                type="button"
                className="launch-button secondary"
                onClick={() => applyCountryChange(pendingCountryChange, false)}
              >
                Keep custom settings
              </button>
              <button
                type="button"
                className="launch-link"
                onClick={() => setPendingCountryChange(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
