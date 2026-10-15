"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  MessageCircle,
  Store,
  UserRound,
  ShieldCheck,
  Palette,
  Check,
} from "lucide-react";
import { useSession } from "@/components/auth/session-provider";
import {
  rememberedShop,
  rememberShop,
  subscribeShop,
} from "@/adapters/commerce";
import { onboardingService } from "@/services/commerce";
import type { OnboardingState, Language, ShopInput } from "@/types/commerce";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/fields";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import "@/styles/shop-settings.css";

export default function ShopSettings() {
  const shopId = useSyncExternalStore(
    subscribeShop,
    rememberedShop,
    () => null,
  );
  return <SettingsContent key={shopId} shopId={shopId} />;
}
function SettingsContent({ shopId }: { shopId: string | null }) {
  const { user } = useSession();
  const router = useRouter();
  const [data, setData] = useState<OnboardingState | null>(null);
  const [draft, setDraft] = useState({
    displayName: "",
    category: "",
    address: "",
    language: "en" as Language,
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!shopId) return;
    const controller = new AbortController();
    onboardingService
      .get(shopId, controller.signal)
      .then((v) => {
        if (controller.signal.aborted) return;
        setData(v);
        setDraft({
          displayName: v.shop.displayName,
          category: v.shop.category,
          address: v.shop.address || "",
          language: v.shop.language,
        });
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [shopId, reload]);
  const changes: ShopInput = {};
  if (data) {
    for (const key of ["displayName", "category", "address"] as const)
      if (draft[key].trim() !== (data.shop[key] || ""))
        changes[key] = draft[key].trim();
    if (draft.language !== data.shop.language)
      changes.language = draft.language;
  }
  const dirty = Object.keys(changes).length > 0;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!shopId || !dirty || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await onboardingService.updateShop(shopId, changes);
      setData(saved);
      setDraft({
        displayName: saved.shop.displayName,
        category: saved.shop.category,
        address: saved.shop.address || "",
        language: saved.shop.language,
      });
      rememberShop(saved.shop.id, saved.shop.displayName);
      setNotice("Shop details saved.");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save shop details. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <PageShell
      variant="settings"
      className="shop-settings"
      header={
        <PageHeader
          title="Settings"
          description="Your shop, your account, and the ways customers reach you."
        />
      }
    >
      <Link href="/website?section=contact" className="settings-contact-link">
        <span className="settings-feature-icon">
          <MessageCircle size={24} />
        </span>
        <span>
          <strong>WhatsApp & Messenger messages</strong>
          <span>
            Set your contact buttons and write the message buyers open. Up to
            500 words.
          </span>
        </span>
        <span className="settings-link-label">
          Edit messages <ArrowUpRight size={18} />
        </span>
      </Link>
      <div className="settings-columns">
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <Store size={20} />
            <div>
              <h2>Shop details</h2>
              <p>The essentials behind your business.</p>
            </div>
            {data && (
              <span className="settings-status">
                {data.shop.status === "launched" ? "Live shop" : "Draft shop"}
              </span>
            )}
          </div>
          {!shopId ? (
            <div className="settings-panel-body">
              <p>Create a shop to manage its settings.</p>
              <Link href="/onboarding" className="button button-primary">
                Set up your shop
              </Link>
            </div>
          ) : !data ? (
            <div className="settings-panel-body">
              {error ? (
                <>
                  <p role="alert">{error}</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setError("");
                      setReload((n) => n + 1);
                    }}
                  >
                    Try again
                  </Button>
                </>
              ) : (
                <p role="status">Loading shop details…</p>
              )}
            </div>
          ) : (
            <form onSubmit={save}>
              <div className="settings-panel-body settings-form">
                <Input
                  label="Shop name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={draft.displayName}
                  onChange={(e) => {
                    setDraft({ ...draft, displayName: e.target.value });
                    setNotice("");
                  }}
                />
                <Input
                  label="Business category"
                  required
                  maxLength={100}
                  value={draft.category}
                  onChange={(e) => {
                    setDraft({ ...draft, category: e.target.value });
                    setNotice("");
                  }}
                />
                <Textarea
                  label="Business address"
                  maxLength={200}
                  value={draft.address}
                  rows={3}
                  onChange={(e) => {
                    setDraft({ ...draft, address: e.target.value });
                    setNotice("");
                  }}
                  hint="Public contact details are managed in Store Design."
                />
                <Select
                  label="Shop language"
                  value={draft.language}
                  onChange={(e) => {
                    setDraft({
                      ...draft,
                      language: e.target.value as Language,
                    });
                    setNotice("");
                  }}
                >
                  <option value="en">English</option>
                  <option value="bn">বাংলা · Bangla</option>
                  <option value="bn-en">Bangla & English</option>
                  <option value="ur">اردو · Urdu</option>
                  <option value="ur-roman">Roman Urdu</option>
                </Select>
                <dl className="settings-facts">
                  <div>
                    <dt>Store address</dt>
                    <dd>{data.shop.subdomain}</dd>
                  </div>
                  <div>
                    <dt>Country</dt>
                    <dd>{data.shop.country}</dd>
                  </div>
                  <div>
                    <dt>Currency</dt>
                    <dd>{data.shop.currency}</dd>
                  </div>
                </dl>
                <p className="settings-note">
                  Your storefront can have a separate display name in Store
                  Design → Branding.
                </p>
                {error && (
                  <p role="alert" className="settings-error">
                    {error}
                  </p>
                )}
                {notice && (
                  <p role="status" className="settings-saved">
                    <Check size={16} />
                    {notice}
                  </p>
                )}
              </div>
              <div className="settings-save">
                <span>
                  {dirty
                    ? "You have unsaved changes"
                    : "Your details are up to date"}
                </span>
                <Button type="submit" loading={saving} disabled={!dirty}>
                  Save shop details
                </Button>
              </div>
            </form>
          )}
        </section>
        <aside className="settings-side">
          <section className="settings-panel">
            <div className="settings-panel-heading">
              <UserRound size={20} />
              <h2>Your account</h2>
            </div>
            <div className="settings-panel-body">
              <div className="settings-account-avatar" aria-hidden>
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <h3>{user.name}</h3>
              <p className="settings-account-email">{user.email}</p>
              <p className="settings-note">
                <ShieldCheck size={15} /> Signed in to your owner workspace.
              </p>
            </div>
          </section>
          <section className="settings-panel">
            <div className="settings-panel-heading">
              <Palette size={20} />
              <h2>Storefront settings</h2>
            </div>
            <div className="settings-shortcuts">
              <Link href="/website">
                Theme, branding & layout <ArrowUpRight size={16} />
              </Link>
              <Link href="/website?section=contact">
                Contact details & policies <ArrowUpRight size={16} />
              </Link>
              <Link href="/reviews">
                Customer reviews & replies <ArrowUpRight size={16} />
              </Link>
            </div>
          </section>
          <p className="settings-note">
            Team permissions, billing and advanced security controls are planned
            for a later release.
          </p>
        </aside>
      </div>
    </PageShell>
  );
}
