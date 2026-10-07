"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Users,
  Plus,
  ArrowUpRight,
  MessageCircle,
  ShoppingBag,
  FileText,
  RotateCcw,
  AlertCircle,
  UserRound,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, SearchInput, Textarea } from "@/components/ui/fields";
import { Drawer } from "@/components/ui/overlays";
import { rememberedShop, subscribeShop } from "@/adapters/commerce";
import { customerService } from "@/services/customers";
import {
  initials,
  customerDate,
  eventLabels,
  languageLabels,
} from "@/adapters/customers";
import type {
  Customer,
  CustomerList,
  CustomerHistory,
  CustomerEvent,
} from "@/types/customers";
import { CustomerEditor } from "./customer-editor";
const icons = {
  customer_created: UserRound,
  customer_updated: UserRound,
  note: FileText,
  order: ShoppingBag,
  conversation: MessageCircle,
  return: RotateCcw,
  complaint: AlertCircle,
};
function Tags({ customer }: { customer: Customer }) {
  return (
    <div className="customer-tags">
      <span className={`customer-status status-${customer.status}`}>
        {customer.status === "active" ? "Active" : "Inactive"}
      </span>
      {customer.tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
}
function TimelineItem({ event }: { event: CustomerEvent }) {
  const Icon = icons[event.type] ?? FileText;
  return (
    <li>
      <span className="timeline-symbol">
        <Icon size={16} />
      </span>
      <div>
        <div className="timeline-heading">
          <strong>{eventLabels[event.type] ?? "Customer event"}</strong>
          <time dateTime={event.createdAt}>
            {customerDate(event.createdAt)}
          </time>
        </div>
        <p>{event.text}</p>
        {event.changedFields?.length ? (
          <small>Changed: {event.changedFields.join(", ")}</small>
        ) : null}
        <small>
          {event.author === "local-development"
            ? "Local development user"
            : event.author}{" "}
          · {event.source}
        </small>
      </div>
    </li>
  );
}
export default function CustomerWorkspace() {
  const shopId = useSyncExternalStore(
    subscribeShop,
    rememberedShop,
    () => null,
  );
  const [data, setData] = useState<CustomerList | null>(null),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [source, setSource] = useState("all"),
    [tag, setTag] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [selected, setSelected] = useState<Customer | null>(null),
    [profileError, setProfileError] = useState(""),
    [history, setHistory] = useState<CustomerHistory | null>(null),
    [historyError, setHistoryError] = useState(""),
    [historyPage, setHistoryPage] = useState(1),
    [editor, setEditor] = useState<Customer | "new" | null>(null),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (!shopId) return;
    const c = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      customerService
        .list(shopId, { q, status, source, tag, page }, c.signal)
        .then((r) => {
          if (!c.signal.aborted) setData(r);
        })
        .catch((e) => {
          if (!c.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [shopId, q, status, source, tag, page, revision]);
  useEffect(() => {
    if (!shopId || !selectedId) return;
    const c = new AbortController();
    customerService
      .get(shopId, selectedId, c.signal)
      .then((c) => {
        setSelected(c);
        setProfileError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setProfileError(e.message);
      });
    return () => c.abort();
  }, [shopId, selectedId, revision]);
  useEffect(() => {
    if (!shopId || !selectedId) return;
    const c = new AbortController();
    customerService
      .history(shopId, selectedId, historyPage, c.signal)
      .then((r) => {
        setHistory(r);
        setHistoryError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setHistoryError(e.message);
      });
    return () => c.abort();
  }, [shopId, selectedId, historyPage, revision]);
  function open(id: string) {
    setSelected(null);
    setHistory(null);
    setHistoryPage(1);
    setProfileError("");
    setHistoryError("");
    setSelectedId(id);
  }
  function saved(c: Customer) {
    setEditor(null);
    setSelectedId(c.id);
    setSelected(c);
    setHistoryPage(1);
    setRevision((v) => v + 1);
    setNotice("Customer saved.");
  }
  const filter = (change: () => void) => {
    change();
    setPage(1);
  };
  return (
    <div className="customer-workspace">
      <header className="customer-page-heading">
        <div>
          <span className="customer-eyebrow">Relationships, remembered</span>
          <h1>Customers</h1>
          <p>The person, their details and the context worth keeping.</p>
        </div>
        <Button onClick={() => setEditor("new")} disabled={!shopId}>
          <Plus size={16} />
          Add customer
        </Button>
      </header>
      {notice && (
        <p role="status" className="customer-notice">
          {notice}
        </p>
      )}
      {!shopId ? (
        <div className="customer-empty">
          <Users size={32} />
          <h2>Start with your shop</h2>
          <p>Your customer directory belongs to a saved shop.</p>
          <Link href="/onboarding" className="button button-primary">
            Set up your shop <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : (
        <>
          <div className="customer-directory-intro">
            <Users size={22} />
            <div>
              <h2>Your customer directory</h2>
              <p>
                Only recorded activity. Order value and return risk appear when
                those sources are connected.
              </p>
            </div>
            <span>
              {data
                ? `${data.total} ${data.total === 1 ? "person" : "people"}`
                : "Loading directory"}
            </span>
          </div>
          <div className="customer-filters">
            <SearchInput
              label="Search customers"
              placeholder="Name, phone or email"
              value={q}
              onChange={(e) => filter(() => setQ(e.target.value))}
              onClear={() => filter(() => setQ(""))}
            />
            <Select
              label="Status"
              value={status}
              onChange={(e) => filter(() => setStatus(e.target.value))}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <Select
              label="Source"
              value={source}
              onChange={(e) => filter(() => setSource(e.target.value))}
            >
              {[
                "all",
                "manual",
                "facebook",
                "instagram",
                "storefront",
                "other",
              ].map((v) => (
                <option key={v} value={v}>
                  {v === "all" ? "All sources" : v}
                </option>
              ))}
            </Select>
            <Input
              label="Tag"
              placeholder="e.g. vip"
              value={tag}
              onChange={(e) => filter(() => setTag(e.target.value))}
            />
          </div>
          {error ? (
            <div role="alert" className="customer-error">
              <p>{error}</p>
              <Button
                variant="secondary"
                onClick={() => setRevision((v) => v + 1)}
              >
                Retry directory
              </Button>
            </div>
          ) : loading && !data ? (
            <div role="status" className="customer-loading">
              Loading your customer directory…
            </div>
          ) : data?.customers.length ? (
            <>
              <p role="status" className="customer-list-status">
                {loading
                  ? "Updating directory…"
                  : `${data.total} matching ${data.total === 1 ? "customer" : "customers"}`}
              </p>
              <div className="customer-table-wrap">
                <table className="customer-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Status & tags</th>
                      <th>Source</th>
                      <th>Recent activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <button
                            className="customer-record-link"
                            onClick={() => open(c.id)}
                          >
                            <span className="customer-avatar">
                              {initials(c.name)}
                            </span>
                            <span>
                              <strong>{c.name}</strong>
                              <small>{languageLabels[c.language]}</small>
                            </span>
                          </button>
                        </td>
                        <td>
                          <span>{c.phone || "Phone not provided"}</span>
                          <small>{c.email || "Email not provided"}</small>
                        </td>
                        <td>
                          <Tags customer={c} />
                        </td>
                        <td className="customer-source">{c.source}</td>
                        <td>
                          <time dateTime={c.lastActivityAt}>
                            {customerDate(c.lastActivityAt)}
                          </time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="customer-mobile-list">
                {data.customers.map((c) => (
                  <article key={c.id}>
                    <button
                      className="customer-record-link"
                      onClick={() => open(c.id)}
                    >
                      <span className="customer-avatar">
                        {initials(c.name)}
                      </span>
                      <span>
                        <strong>{c.name}</strong>
                        <small>
                          {c.phone || c.email || "Contact not provided"}
                        </small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>
                    <Tags customer={c} />
                    <footer>
                      <span>{c.source}</span>
                      <time dateTime={c.lastActivityAt}>
                        {customerDate(c.lastActivityAt)}
                      </time>
                    </footer>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="customer-empty">
              <Users size={30} />
              <h2>
                {q || tag || status !== "all" || source !== "all"
                  ? "No matching customers"
                  : "Make room for your first customer"}
              </h2>
              <p>
                {q || tag || status !== "all" || source !== "all"
                  ? "Try another name or clear the filters."
                  : "Start with a name. Add the useful details as the relationship grows."}
              </p>
              {q || tag || status !== "all" || source !== "all" ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setTag("");
                    setStatus("all");
                    setSource("all");
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setEditor("new")}>
                  Add your first customer
                </Button>
              )}
            </div>
          )}
          {data && data.total > data.limit && (
            <nav className="customer-pagination" aria-label="Customer pages">
              <Button
                variant="secondary"
                disabled={page === 1 || loading}
                onClick={() => setPage((v) => v - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {Math.ceil(data.total / data.limit)}
              </span>
              <Button
                variant="secondary"
                disabled={page * data.limit >= data.total || loading}
                onClick={() => setPage((v) => v + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
      {shopId && selectedId && !editor && (
        <Drawer
          open
          onOpenChange={(v) => {
            if (!v) setSelectedId(null);
          }}
          title={selected?.name ?? "Customer record"}
          description="One continuous record of the relationship."
          className="customer-profile"
          actions={
            selected && !profileError ? (
              <Button variant="secondary" onClick={() => setEditor(selected)}>
                Edit customer
              </Button>
            ) : undefined
          }
        >
          {profileError ? (
            <div role="alert" className="customer-error">
              <p>{profileError}</p>
              <Button onClick={() => setRevision((v) => v + 1)}>
                Retry profile
              </Button>
            </div>
          ) : !selected ? (
            <p role="status">Loading customer…</p>
          ) : (
            <div className="customer-record">
              <div className="customer-record-identity">
                <span className="customer-avatar large">
                  {initials(selected.name)}
                </span>
                <div>
                  <h3>{selected.name}</h3>
                  <p>
                    {selected.source} · Added {customerDate(selected.createdAt)}
                  </p>
                  <Tags customer={selected} />
                </div>
              </div>
              <div className="customer-context">
                <ShieldCheck size={18} />
                <p>
                  No connected order or return history yet. Manual tags are
                  staff context, not a calculated risk score.
                </p>
              </div>
              <section className="customer-contact">
                <h3>Contact & addresses</h3>
                <dl>
                  <div>
                    <dt>Phone</dt>
                    <dd>{selected.phone || "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{selected.email || "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Preferred language</dt>
                    <dd>{languageLabels[selected.language]}</dd>
                  </div>
                </dl>
                {selected.addresses.length ? (
                  selected.addresses.map((a, i) => (
                    <address key={i}>
                      <strong>{a.label}</strong>
                      <span>{a.line}</span>
                      <span>
                        {[a.city, a.region, a.postalCode, a.country]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </address>
                  ))
                ) : (
                  <p className="customer-muted">No address recorded.</p>
                )}
              </section>
              <section className="customer-activity">
                <div className="customer-section-title">
                  <h3>Activity & history</h3>
                  <span>{history?.total ?? "…"} recorded events</span>
                </div>
                {historyError ? (
                  <div role="alert" className="customer-error">
                    {historyError}
                    <Button
                      variant="secondary"
                      onClick={() => setRevision((v) => v + 1)}
                    >
                      Retry history
                    </Button>
                  </div>
                ) : !history ? (
                  <p role="status">Loading history…</p>
                ) : history.entries.length ? (
                  <ol className="customer-timeline">
                    {history.entries.map((e) => (
                      <TimelineItem key={e.id} event={e} />
                    ))}
                  </ol>
                ) : (
                  <p className="customer-muted">
                    No activity has been recorded.
                  </p>
                )}
                {history && history.total > 30 && (
                  <nav
                    className="customer-pagination"
                    aria-label="History pages"
                  >
                    <Button
                      variant="secondary"
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage((v) => v - 1)}
                    >
                      Newer events
                    </Button>
                    <span>Page {historyPage}</span>
                    <Button
                      variant="secondary"
                      disabled={historyPage * 30 >= history.total}
                      onClick={() => setHistoryPage((v) => v + 1)}
                    >
                      Older events
                    </Button>
                  </nav>
                )}
              </section>
              <CustomerNote
                key={selected.id}
                shopId={shopId}
                customerId={selected.id}
                onSaved={() => {
                  setHistoryPage(1);
                  setRevision((v) => v + 1);
                  setNotice("Note added to customer history.");
                }}
              />
              <section className="customer-ai-context">
                <h3>Future AI context</h3>
                <p>
                  Customer facts and notes will provide context for reviewed
                  replies when AI Reply Automation is connected. No model reads
                  this record in the current release.
                </p>
              </section>
            </div>
          )}
        </Drawer>
      )}
      {shopId && editor && (
        <CustomerEditor
          key={editor === "new" ? "new" : editor.id}
          shopId={shopId}
          customer={editor}
          onClose={() => {
            setEditor(null);
            setRevision((v) => v + 1);
          }}
          onSaved={saved}
        />
      )}
    </div>
  );
}
function CustomerNote({
  shopId,
  customerId,
  onSaved,
}: {
  shopId: string;
  customerId: string;
  onSaved: () => void;
}) {
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [requestId, setRequestId] = useState(() => crypto.randomUUID());
  return (
    <section className="customer-note-form">
      <h3>Add a staff note</h3>
      <p>
        Keep it factual and useful. Notes are timestamped and retained in the
        history.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await customerService.note(shopId, customerId, text, requestId);
            setText("");
            setRequestId(crypto.randomUUID());
            onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save note.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Textarea
          label="Note"
          required
          maxLength={4000}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {error && (
          <p role="alert" className="customer-error">
            {error}
          </p>
        )}
        <div>
          <small>Author: signed-in shop owner</small>
          <Button type="submit" loading={busy} disabled={!text.trim()}>
            Add note
          </Button>
        </div>
      </form>
    </section>
  );
}
