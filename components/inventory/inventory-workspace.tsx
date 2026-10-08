"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Package,
  Plus,
  ArrowUpRight,
  SlidersHorizontal,
  RefreshCw,
  History,
  Download,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, SearchInput } from "@/components/ui/fields";
import { Drawer, Modal } from "@/components/ui/overlays";
import {
  rememberedShop,
  subscribeShop,
  formatMoney,
} from "@/adapters/commerce";
import { inventoryService } from "@/services/inventory";
import { stockPreview } from "@/adapters/inventory";
import type {
  InventoryList,
  InventoryProduct,
  InventoryVariant,
  StockEntry,
  StockKind,
} from "@/types/inventory";
import { ProductEditor } from "./product-editor";
import { AnimatedValue } from "@/components/data-display/animated-value";
import { StockSignal } from "./stock-signal";
function ProductImage({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="inventory-thumb">
      {url && !failed ? (
        <Image
          src={url}
          width={44}
          height={50}
          unoptimized
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Package size={20} />
      )}
    </span>
  );
}
export default function InventoryWorkspace() {
  const shopId = useSyncExternalStore(
    subscribeShop,
    rememberedShop,
    () => null,
  );
  const reduced = useReducedMotion();
  const [data, setData] = useState<InventoryList | null>(null),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [stock, setStock] = useState("all"),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<InventoryProduct | null>(null),
    [editor, setEditor] = useState<InventoryProduct | "new" | null>(null),
    [adjust, setAdjust] = useState<InventoryVariant | null>(null),
    [history, setHistory] = useState<StockEntry[]>([]),
    [historyError, setHistoryError] = useState(""),
    [historyPage, setHistoryPage] = useState(1),
    [historyTotal, setHistoryTotal] = useState(0),
    [notice, setNotice] = useState(""),
    [importOpen, setImportOpen] = useState(false);
  useEffect(() => {
    if (!shopId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      inventoryService
        .list(shopId, { q, status, category, stock, page }, controller.signal)
        .then(setData)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [shopId, q, status, category, stock, page, revision]);
  useEffect(() => {
    if (!selected || !shopId) return;
    let active = true;
    inventoryService
      .history(shopId, selected.id, historyPage)
      .then((r) => {
        if (active) {
          setHistory(r.entries);
          setHistoryTotal(r.total);
          setHistoryError("");
        }
      })
      .catch((e) => {
        if (active) setHistoryError(e.message);
      });
    return () => {
      active = false;
    };
  }, [selected, shopId, historyPage]);
  function saved(p: InventoryProduct) {
    setEditor(null);
    setSelected(p);
    setAdjust(null);
    setRevision((v) => v + 1);
    setNotice("Saved. Your product and stock history are up to date.");
  }
  function exportPage() {
    if (!data) return;
    const escape = (v: unknown) =>
      `"${String(v ?? "")
        .replaceAll('"', '""')
        .replace(/^[=+@-]/, "'$&")}"`;
    const csv = [
      [
        "Product",
        "SKU",
        "Category",
        "Price",
        "Available",
        "Reserved",
        "Status",
      ],
      ...data.products.map((p) => [
        p.name,
        p.sku,
        p.category,
        p.price,
        p.available,
        p.reserved,
        p.status,
      ]),
    ]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-current-page.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const reload = () => {
    setRevision((v) => v + 1);
    if (shopId && selected)
      void inventoryService
        .get(shopId, selected.id)
        .then((p) => {
          setSelected(p);
          setAdjust(null);
        })
        .catch((e) => setError(e.message));
  };
  return (
    <div className="inventory-workspace">
      <header className="inventory-heading">
        <div>
          <span className="inventory-eyebrow">Products & inventory</span>
          <h1>The facts behind every sale.</h1>
          <p>Keep your catalog clear and every unit accounted for.</p>
        </div>
        <Button onClick={() => setEditor("new")} disabled={!shopId}>
          <Plus size={16} />
          Add product
        </Button>
      </header>
      {!shopId ? (
        <section className="inventory-start">
          <Package size={30} />
          <h2>Give your products a home.</h2>
          <p>Create or resume a shop to start managing real stock.</p>
          <Link href="/onboarding" className="button button-primary">
            Open shop setup <ArrowUpRight size={16} />
          </Link>
        </section>
      ) : (
        <>
          <div className="inventory-summary">
            <div>
              <span>Products in view</span>
              <strong>{data?.summary.products ?? "—"}</strong>
            </div>
            <div>
              <span>Available units</span>
              <strong>
                <AnimatedValue value={data?.summary.available ?? "—"} />
              </strong>
            </div>
            <button
              onClick={() => {
                setStock("low");
                setPage(1);
              }}
              aria-pressed={stock === "low"}
            >
              <span>Needs a stock review</span>
              <strong>
                {data?.summary.low ?? "—"}
                <small> low stock</small>
              </strong>
            </button>
            <div>
              <span>Reserved units</span>
              <strong>{data?.summary.reserved ?? "—"}</strong>
            </div>
          </div>
          <div className="inventory-toolbar">
            <SearchInput
              label="Search products or SKU"
              placeholder="Find a product or SKU"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              onClear={() => {
                setQ("");
                setPage(1);
              }}
            />
            <Select
              label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Inactive</option>
            </Select>
            <Select
              label="Category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {data?.categories.filter(Boolean).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select
              label="Stock"
              value={stock}
              onChange={(e) => {
                setStock(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All stock</option>
              <option value="healthy">Healthy</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
          </div>
          <div className="inventory-tools">
            <span>
              {loading
                ? "Updating inventory…"
                : `${data?.total ?? 0} product${data?.total === 1 ? "" : "s"} · your shop catalog`}
            </span>
            <div>
              <Button variant="ghost" onClick={() => setImportOpen(true)}>
                <Upload size={14} />
                Import
              </Button>
              <Button
                variant="ghost"
                onClick={exportPage}
                disabled={!data?.products.length}
              >
                <Download size={14} />
                Export page
              </Button>
              <Button variant="ghost" onClick={reload}>
                <RefreshCw size={14} />
                Refresh
              </Button>
            </div>
          </div>
          {notice && (
            <p role="status" className="inventory-notice">
              {notice}
            </p>
          )}
          {error && (
            <div role="alert" className="inventory-error">
              {error}
              <Button variant="secondary" onClick={reload}>
                Try again
              </Button>
            </div>
          )}
          <div aria-busy={loading} className="inventory-results">
            <AnimatePresence mode="wait" initial={false}>
              {!data && loading ? (
                <motion.div
                  key="loading"
                  className="inventory-loading"
                  role="status"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Loading inventory…
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="inventory-skeleton" />
                  ))}
                </motion.div>
              ) : data && !data.products.length ? (
                <motion.div
                  key="empty"
                  className="inventory-start"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Package size={28} />
                  <h2>
                    {q || stock !== "all" || status !== "all" || category
                      ? "No products match this view."
                      : "Start with one good product."}
                  </h2>
                  <p>
                    {q || stock !== "all" || status !== "all" || category
                      ? "Try a different search or clear your filters."
                      : "Add the product details and opening stock your shop can rely on."}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (
                        q ||
                        stock !== "all" ||
                        status !== "all" ||
                        category
                      ) {
                        setQ("");
                        setStock("all");
                        setStatus("all");
                        setCategory("");
                      } else setEditor("new");
                    }}
                  >
                    {q || stock !== "all" || status !== "all" || category
                      ? "Clear filters"
                      : "Add your first product"}
                  </Button>
                </motion.div>
              ) : data ? (
                <motion.div
                  key={`${status}-${stock}-${category}-${q}-${page}`}
                  initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        {[
                          "Product",
                          "Category",
                          "Price",
                          "Available",
                          "Reserved",
                          "Inventory",
                          "Status",
                          "",
                        ].map((s, i) => (
                          <th key={i} scope="col">
                            {s || <span className="sr-only">Actions</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.products.map((p) => (
                        <tr key={p.id} data-selected={selected?.id === p.id}>
                          <td>
                            <button
                              className="product-cell"
                              onClick={() => {
                                setSelected(p);
                                setHistoryPage(1);
                              }}
                            >
                              <ProductImage url={p.images[0]} />
                              <span>
                                <strong>{p.name}</strong>
                                <small>{p.sku || "SKU not set"}</small>
                              </span>
                            </button>
                          </td>
                          <td>{p.category || "—"}</td>
                          <td>{formatMoney(p.price, p.currency)}</td>
                          <td>
                            <strong>{p.available}</strong>
                          </td>
                          <td>{p.reserved}</td>
                          <td>
                            <StockSignal
                              available={p.available}
                              threshold={p.lowStock ? p.available : 0}
                              inactive={p.status !== "active"}
                            />
                          </td>
                          <td>
                            <span className="inventory-product-status">
                              {p.status === "archived" ? "Inactive" : p.status}
                            </span>
                          </td>
                          <td>
                            <Button
                              variant="ghost"
                              aria-label={`Edit ${p.name}`}
                              onClick={() => setEditor(p)}
                            >
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="inventory-mobile-list">
                    {data.products.map((p) => (
                      <button
                        key={p.id}
                        className="inventory-mobile-card"
                        onClick={() => {
                          setSelected(p);
                          setHistoryPage(1);
                        }}
                      >
                        <ProductImage url={p.images[0]} />
                        <div>
                          <strong>{p.name}</strong>
                          <small>
                            {p.sku || "SKU not set"} ·{" "}
                            {p.category || "Uncategorized"}
                          </small>
                          <span>
                            {formatMoney(p.price, p.currency)} · {p.status}
                          </span>
                          <div className="mobile-stock">
                            <b>{p.available} available</b>
                            <span>{p.reserved} reserved</span>
                          </div>
                          <StockSignal
                            available={p.available}
                            threshold={p.lowStock ? p.available : 0}
                            inactive={p.status !== "active"}
                          />
                        </div>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          {data && data.total > 30 && (
            <div className="inventory-pagination">
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {Math.ceil(data.total / 30)}
              </span>
              <Button
                variant="secondary"
                disabled={page * 30 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      <Drawer
        open={!!selected && !editor}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setAdjust(null);
          }
        }}
        title={selected?.name ?? "Product"}
        description="Stock position, variants and an auditable history."
        className="inventory-detail-drawer"
      >
        {selected && shopId && (
          <>
            <div className="detail-actions">
              <Button variant="secondary" onClick={() => setEditor(selected)}>
                Edit product
              </Button>
              <span>
                {selected.sku || "SKU not set"} · {selected.status}
              </span>
            </div>
            <div className="detail-totals">
              {(
                [
                  [
                    "On hand",
                    selected.variants.reduce((n, v) => n + v.onHand, 0),
                  ],
                  ["Reserved", selected.reserved],
                  ["Available", selected.available],
                  ["Sold", selected.variants.reduce((n, v) => n + v.sold, 0)],
                  [
                    "Returned",
                    selected.variants.reduce((n, v) => n + v.returned, 0),
                  ],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <h3>Variant stock</h3>
            {selected.variants.map((v) => (
              <div className="detail-variant" key={v.id}>
                <div>
                  <strong>{v.title}</strong>
                  <small>
                    {v.sku || "SKU not set"} · Threshold {v.lowStockThreshold}
                  </small>
                  <StockSignal
                    available={v.available}
                    threshold={v.lowStockThreshold}
                  />
                </div>
                <span>{v.available} available</span>
                <Button variant="secondary" onClick={() => setAdjust(v)}>
                  <SlidersHorizontal size={14} />
                  Adjust
                </Button>
              </div>
            ))}
            {adjust && (
              <AdjustmentForm
                key={`${adjust.id}-${adjust.version}`}
                shopId={shopId}
                product={selected}
                variant={adjust}
                onSaved={saved}
                onCancel={() => setAdjust(null)}
                onReload={reload}
              />
            )}
            <div className="history-heading">
              <History size={17} />
              <h3>Stock history</h3>
            </div>
            {historyError ? (
              <div role="alert" className="inventory-error">
                {historyError}
                <Button
                  variant="secondary"
                  onClick={() => setSelected({ ...selected })}
                >
                  Retry history
                </Button>
              </div>
            ) : !history.length ? (
              <p className="field-hint">No stock entries yet.</p>
            ) : (
              <ol className="stock-history">
                {history.map((e) => (
                  <li key={e.id}>
                    <span className="history-difference">
                      {e.difference > 0 ? "+" : ""}
                      {e.difference}
                    </span>
                    <div>
                      <strong>{e.reason}</strong>
                      <p>
                        {e.previousValue} → {e.newValue} on hand
                        {e.before && e.after
                          ? ` · reserved ${e.before.reserved} → ${e.after.reserved}`
                          : ""}
                      </p>
                      <small>
                        {e.createdBy} · {new Date(e.createdAt).toLocaleString()}{" "}
                        · {e.kind ?? "opening"}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {historyTotal > 50 && (
              <div className="inventory-pagination">
                <Button
                  disabled={historyPage === 1}
                  variant="secondary"
                  onClick={() => setHistoryPage((p) => p - 1)}
                >
                  Previous history
                </Button>
                <span>{historyPage}</span>
                <Button
                  disabled={historyPage * 50 >= historyTotal}
                  variant="secondary"
                  onClick={() => setHistoryPage((p) => p + 1)}
                >
                  Next history
                </Button>
              </div>
            )}
          </>
        )}
      </Drawer>
      <Drawer
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        title={editor === "new" ? "Add a product" : "Edit product"}
        description="Simple product details for your storefront."
        className="inventory-editor-drawer"
      >
        {editor && shopId && (
          <ProductEditor
            key={editor === "new" ? "new" : editor.id}
            shopId={shopId}
            currency={data?.currency ?? ""}
            categories={data?.categories ?? []}
            product={editor === "new" ? undefined : editor}
            onSaved={saved}
            onCancel={() => setEditor(null)}
          />
        )}
      </Drawer>
      <Modal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Bring your catalog with you"
        description="Bulk import is prepared as a future service boundary."
      >
        <ol className="import-stages">
          {[
            "Upload CSV or Excel",
            "Map columns",
            "Validate each row",
            "Preview changes",
            "Confirm import",
            "Review results",
          ].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p>
          Import writes and duplicate-SKU merge rules are not connected in this
          phase. Add products individually, or export the current page for
          review.
        </p>
        <Button variant="secondary" onClick={() => setImportOpen(false)}>
          Back to inventory
        </Button>
      </Modal>
    </div>
  );
}
function AdjustmentForm({
  shopId,
  product,
  variant,
  onSaved,
  onCancel,
  onReload,
}: {
  shopId: string;
  product: InventoryProduct;
  variant: InventoryVariant;
  onSaved: (p: InventoryProduct) => void;
  onCancel: () => void;
  onReload: () => void;
}) {
  const [kind, setKind] = useState<StockKind>("correction"),
    [quantity, setQuantity] = useState(0),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const preview = stockPreview(variant, kind, quantity);
  async function save() {
    setBusy(true);
    setError("");
    try {
      onSaved(
        await inventoryService.adjust(shopId, product.id, {
          requestId,
          variantId: variant.id,
          version: variant.version,
          kind,
          quantity,
          reason,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="adjustment-form" aria-label="Stock adjustment">
      <h3>Adjust {variant.title}</h3>
      <p>
        Every change keeps its reason and before/after values in the ledger.
      </p>
      <Select
        label="Adjustment type"
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as StockKind);
          setConfirmed(false);
        }}
      >
        <option value="correction">Stock correction (+ / −)</option>
        <option value="receive">Receive stock</option>
        <option value="reserve">Reserve units manually</option>
        <option value="release">Release reserved units manually</option>
        <option value="sale">Record sale from reserved units</option>
        <option value="return">Return previously sold units</option>
      </Select>
      <Input
        label="Quantity change"
        type="number"
        step={1}
        value={quantity}
        onChange={(e) => {
          setQuantity(Number(e.target.value));
          setConfirmed(false);
        }}
      />
      <Textarea
        label="Reason for adjustment"
        minLength={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="For example: physical stock count, damaged unit"
      />
      <div className="adjustment-preview" aria-live="polite">
        <span>
          On hand{" "}
          <b>
            {variant.onHand} → {preview.onHand}
          </b>
        </span>
        <span>
          Reserved{" "}
          <b>
            {variant.reserved} → {preview.reserved}
          </b>
        </span>
        <span>
          Available{" "}
          <b>
            {variant.available} → {preview.available}
          </b>
        </span>
      </div>
      {!preview.valid && quantity !== 0 && (
        <p className="text-error">
          This change is not valid. Available and reserved stock must remain
          nonnegative; returns cannot exceed sales.
        </p>
      )}
      <label className="adjustment-confirm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I reviewed the quantities and reason.
      </label>
      {error && (
        <div role="alert" className="inventory-error">
          {error}
          <Button variant="secondary" onClick={onReload}>
            Reload latest stock
          </Button>
        </div>
      )}
      <div className="detail-actions">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={save}
          disabled={
            busy || !preview.valid || reason.trim().length < 3 || !confirmed
          }
        >
          {busy ? "Saving…" : "Confirm adjustment"}
        </Button>
      </div>
    </section>
  );
}
