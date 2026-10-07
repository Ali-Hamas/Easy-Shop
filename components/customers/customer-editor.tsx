"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/overlays";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/fields";
import { customerService } from "@/services/customers";
import {
  blankCustomer,
  customerDraft,
  languageLabels,
} from "@/adapters/customers";
import { ApiError } from "@/lib/api/client";
import type { Customer, CustomerInput } from "@/types/customers";
export function CustomerEditor({
  shopId,
  customer,
  onClose,
  onSaved,
}: {
  shopId: string;
  customer: Customer | "new";
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const [draft, setDraft] = useState<CustomerInput>(() =>
    customer === "new" ? blankCustomer() : customerDraft(customer),
  );
  const [tags, setTags] = useState(draft.tags.join(", "));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const change = <K extends keyof CustomerInput>(
    key: K,
    value: CustomerInput[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));
  const inactive =
    draft.status === "inactive" &&
    (customer === "new" || customer.status !== "inactive");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (inactive && !confirm) return;
    setBusy(true);
    setError("");
    try {
      const input = {
        ...draft,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const saved =
        customer === "new"
          ? await customerService.create(shopId, input, requestId)
          : await customerService.update(
              shopId,
              customer.id,
              input,
              customer.version,
            );
      onSaved(saved);
    } catch (e) {
      setError(
        e instanceof ApiError && e.issues.length
          ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ")
          : e instanceof Error
            ? e.message
            : "Could not save.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={customer === "new" ? "Add customer" : "Edit customer"}
      description="Keep the useful details together. Fields can remain empty when you do not know them."
      className="customer-editor"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="customer-form"
            loading={busy}
            disabled={inactive && !confirm}
          >
            Save customer
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={save} className="customer-form">
        {error && (
          <p role="alert" className="customer-error">
            {error} Your draft is still here. For a version conflict, close and
            reopen the record to load the latest details.
          </p>
        )}
        <section>
          <h3>Identity & contact</h3>
          <Input
            label="Full name"
            required
            maxLength={120}
            value={draft.name}
            onChange={(e) => change("name", e.target.value)}
          />
          <div className="customer-form-grid">
            <Input
              label="Phone"
              type="tel"
              maxLength={32}
              hint="Include the country code when known."
              value={draft.phone}
              onChange={(e) => change("phone", e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              maxLength={254}
              value={draft.email}
              onChange={(e) => change("email", e.target.value)}
            />
            <Select
              label="Preferred language"
              value={draft.language}
              onChange={(e) =>
                change("language", e.target.value as CustomerInput["language"])
              }
            >
              {Object.entries(languageLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              label="Source / channel"
              value={draft.source}
              onChange={(e) =>
                change("source", e.target.value as CustomerInput["source"])
              }
            >
              {["manual", "facebook", "instagram", "storefront", "other"].map(
                (v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ),
              )}
            </Select>
          </div>
        </section>
        <section>
          <h3>Context</h3>
          <Input
            label="Tags"
            hint="Separate tags with commas. Manual labels only, not calculated risk."
            maxLength={800}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          <Select
            label="Customer status"
            value={draft.status}
            onChange={(e) =>
              change("status", e.target.value as CustomerInput["status"])
            }
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          {inactive && (
            <label className="customer-confirm">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />{" "}
              Mark this customer inactive. Their history will be retained.
            </label>
          )}
        </section>
        <section>
          <div className="customer-section-title">
            <h3>Addresses</h3>
            <Button
              type="button"
              variant="secondary"
              disabled={draft.addresses.length >= 8}
              onClick={() =>
                change("addresses", [
                  ...draft.addresses,
                  {
                    label: "Home",
                    line: "",
                    city: "",
                    region: "",
                    postalCode: "",
                    country: "",
                  },
                ])
              }
            >
              <Plus size={15} />
              Add address
            </Button>
          </div>
          {draft.addresses.length === 0 && (
            <p className="customer-muted">
              No address yet. Add one when the customer shares it.
            </p>
          )}
          {draft.addresses.map((address, index) => (
            <fieldset className="customer-address-form" key={index}>
              <legend>Address {index + 1}</legend>
              <div className="customer-form-grid">
                {(
                  [
                    "label",
                    "line",
                    "city",
                    "region",
                    "postalCode",
                    "country",
                  ] as const
                ).map((key) => (
                  <Input
                    key={key}
                    label={
                      key === "line"
                        ? "Street address"
                        : key === "postalCode"
                          ? "Postal code"
                          : key.charAt(0).toUpperCase() + key.slice(1)
                    }
                    required={key === "label" || key === "line"}
                    value={address[key]}
                    maxLength={key === "line" ? 300 : 80}
                    onChange={(e) =>
                      change(
                        "addresses",
                        draft.addresses.map((a, i) =>
                          i === index ? { ...a, [key]: e.target.value } : a,
                        ),
                      )
                    }
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  change(
                    "addresses",
                    draft.addresses.filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2 size={14} />
                Remove address {index + 1} from draft
              </Button>
            </fieldset>
          ))}
        </section>
      </form>
    </Drawer>
  );
}
