"use client";
import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Package,
  Plus,
  Copy,
  Check,
  ShieldCheck,
  Truck,
  PanelRight,
  Command,
  FlaskConical,
  Layers2,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell, type PageVariant } from "@/components/layout/page-shell";
import { Button, IconButton } from "./button";
import {
  Input,
  SearchInput,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Switch,
} from "./fields";
import {
  Avatar,
  Badge,
  StatusBadge,
  Skeleton,
  Progress,
  Divider,
  EmptyState,
} from "./display";
import { Tabs, SegmentedControl } from "./tabs";
import { Modal, Drawer, Popover, Dropdown, Tooltip } from "./overlays";
import { useToast } from "./toast";
import {
  AIAccent,
  AILabel,
  AIContent,
  AISource,
  AIConfidence,
  AIStateIndicator,
  AISuggestion,
  AIActionReview,
  HumanHandoff,
  type AIPresentationState,
} from "@/components/ai/ai-primitives";
import {
  CommerceFact,
  ConnectionStatus,
  OperationalNotice,
} from "@/components/commerce/commerce-primitives";
import { DataTable } from "@/components/data-display/data-table";
import { duration, ease } from "@/config/motion";
const sections = [
  "Foundations",
  "Colors",
  "Typography",
  "Spacing",
  "Buttons",
  "Inputs",
  "Selection Controls",
  "Navigation",
  "Statuses",
  "Data Display",
  "Overlays",
  "Feedback",
  "AI Components",
  "Commerce Components",
  "Motion",
  "Responsive Examples",
];
const anchor = (name: string) => name.toLowerCase().replaceAll(" ", "-");
function LabSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={anchor(title)}
      className="lab-section"
      aria-labelledby={`${anchor(title)}-title`}
    >
      <header className="lab-section-heading">
        <h2 id={`${anchor(title)}-title`}>{title}</h2>
        <p>{description}</p>
      </header>
      <div className="lab-section-content">{children}</div>
    </section>
  );
}
function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="specimen">
      <span className="specimen-label">{label}</span>
      {children}
    </div>
  );
}
const sampleOrders = [
  {
    id: "#1048",
    customer: "Ayesha Rahman",
    item: "Everyday tote · Olive",
    amount: "৳1,490",
    status: "COD pending",
  },
  {
    id: "#1047",
    customer: "Sadia Khan",
    item: "Linen shirt · Medium",
    amount: "৳2,200",
    status: "Delivery failed",
  },
  {
    id: "#1046",
    customer: "Nadia Islam",
    item: "Ceramic mug · Sand",
    amount: "৳650",
    status: "Delivered",
  },
];
const layouts: { value: PageVariant; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "data", label: "Data-heavy" },
  { value: "workspace", label: "Three-panel" },
  { value: "settings", label: "Settings" },
  { value: "editor", label: "Editor" },
  { value: "analytics", label: "Analytics" },
];
export function ComponentGallery() {
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [view, setView] = useState("desktop");
  const [layout, setLayout] = useState<PageVariant>("data");
  const [aiState, setAiState] = useState<AIPresentationState>("draft");
  const [motionKey, setMotionKey] = useState(0);
  const [section, setSection] = useState("Foundations");
  const [search, setSearch] = useState("");
  const [swatch, setSwatch] = useState("");
  const toast = useToast();
  const reduced = useReducedMotion();
  const demo = () => toast("Preview only. No business data changed.");
  return (
    <PageShell
      className="laboratory"
      variant="data"
      header={
        <PageHeader
          eyebrow={
            <>
              <FlaskConical size={14} />
              <span>Workspace design system</span>
              <span className="breadcrumb-separator">/</span>
              <span>v0.2</span>
            </>
          }
          title="Small details. One considered system."
          description="A working library for the everyday rhythm of social commerce."
          primaryAction={
            <Button variant="secondary" onClick={() => setDrawer(true)}>
              <PanelRight size={16} />
              Preview detail drawer
            </Button>
          }
        />
      }
    >
      <div className="lab-intro">
        <div>
          <span className="tiny-dot" />
          <strong>UI laboratory</strong>
          <span>Built for clarity, consistency and a calmer working day.</span>
        </div>
        <Badge>Interactive specimens</Badge>
      </div>
      <div className="lab-layout">
        <nav className="lab-index" aria-label="Library sections">
          <span className="meta">In this library</span>
          {sections.map((name) => (
            <a
              key={name}
              href={`#${anchor(name)}`}
              onClick={() => setSection(name)}
              className={section === name ? "index-active" : undefined}
            >
              {name}
            </a>
          ))}
        </nav>
        <div className="lab-content">
          <p className="fixture-notice">
            <FlaskConical size={14} />
            All orders, customers, connection states and AI replies below are
            illustrative fixtures. Nothing is sent or saved.
          </p>
          <LabSection
            title="Foundations"
            description="One visual language. Room for different kinds of work."
          >
            <div className="foundation-principles">
              <div>
                <Layers2 size={21} />
                <h3>Quiet by default</h3>
                <p>
                  Whitespace and typography establish structure. Surfaces
                  support the work.
                </p>
              </div>
              <div>
                <Command size={21} />
                <h3>Built for flow</h3>
                <p>
                  Compact controls, clear actions and context that stays close.
                </p>
              </div>
              <div>
                <ShieldCheck size={21} />
                <h3>Human in control</h3>
                <p>
                  Sources stay visible. Consequential actions always invite
                  review.
                </p>
              </div>
            </div>
          </LabSection>
          <LabSection
            title="Colors"
            description="Neutral surfaces. Coastal palette (#447794 & #2D5B75) with purpose. Status color only where it helps."
          >
            <div className="color-swatches">
              {[
                { name: "Canvas", token: "--app-bg", hex: "#F7F8FA" },
                { name: "Surface", token: "--surface", hex: "#FFFFFF" },
                { name: "Inset", token: "--surface-secondary", hex: "#F3F5F7" },
                {
                  name: "Coastal Mid (Color 1)",
                  token: "--brand",
                  hex: "#447794",
                },
                {
                  name: "Coastal Deep (Color 2)",
                  token: "--brand-secondary",
                  hex: "#2D5B75",
                },
                { name: "Coastal Soft", token: "--brand-soft", hex: "#E4EDF3" },
              ].map((c) => (
                <button
                  key={c.name}
                  aria-label={`Inspect ${c.name} color`}
                  className="color-swatch"
                  onClick={() => setSwatch(`${c.name}: ${c.hex} · ${c.token}`)}
                >
                  <span style={{ background: `var(${c.token})` }} />
                  <strong>{c.name}</strong>
                  <small>{c.hex}</small>
                </button>
              ))}
            </div>
            <p className="token-readout" role="status">
              {swatch || "Select a color to inspect its token."}
            </p>
            <div className="gallery-row">
              <StatusBadge tone="success">Meta connected</StatusBadge>
              <StatusBadge tone="warning">Low stock</StatusBadge>
              <StatusBadge tone="danger">Delivery failed</StatusBadge>
              <StatusBadge tone="info">In transit</StatusBadge>
            </div>
          </LabSection>
          <LabSection
            title="Typography"
            description="Geist. Clear at a glance, comfortable over a long working day."
          >
            <div className="type-specimen">
              <div>
                <span className="type-page">Every order has a story.</span>
                <small>Page · 28 / 600</small>
              </div>
              <div>
                <span className="type-section">
                  Conversations that move business forward
                </span>
                <small>Section · 20 / 600</small>
              </div>
              <div>
                <strong>Ready for your review</strong>
                <small>Card · 16 / 600</small>
              </div>
              <div>
                <p>
                  Keep the customer, the conversation and the next step in view.
                </p>
                <small>Body · 14 / 400</small>
              </div>
              <div>
                <span className="meta">
                  Updated 2 minutes ago · Sample metadata
                </span>
                <small>Metadata · 12 / 400</small>
              </div>
            </div>
          </LabSection>
          <LabSection
            title="Spacing"
            description="A 4px foundation, with an 8px rhythm between related elements."
          >
            <div className="spacing-scale">
              {[4, 8, 12, 16, 24, 32, 40, 48, 64].map((space) => (
                <div key={space}>
                  <span style={{ width: space }} />
                  <small>{space}</small>
                </div>
              ))}
            </div>
            <div className="radius-specimens">
              {[8, 12, 16, 18].map((radius) => (
                <div key={radius} style={{ borderRadius: radius }}>
                  <strong>{radius}px</strong>
                  <span>
                    {radius === 8
                      ? "Controls"
                      : radius === 12
                        ? "Surfaces"
                        : radius === 16
                          ? "Large surfaces"
                          : "Overlays"}
                  </span>
                </div>
              ))}
            </div>
          </LabSection>
          <LabSection
            title="Buttons"
            description="A clear primary action. Everything else supports the decision."
          >
            <Specimen label="Action hierarchy">
              <div className="gallery-row">
                <Button onClick={demo}>
                  <Plus size={15} />
                  Add product
                </Button>
                <Button variant="secondary" onClick={demo}>
                  Save draft
                </Button>
                <Button variant="ghost" onClick={demo}>
                  Discard changes
                </Button>
                <Tooltip content="Copy order reference">
                  <IconButton
                    label="Copy order reference"
                    variant="secondary"
                    onClick={() => toast("Sample order reference: #1048")}
                  >
                    <Copy size={16} />
                  </IconButton>
                </Tooltip>
              </div>
            </Specimen>
            <Specimen label="Loading, disabled and destructive">
              <div className="gallery-row">
                <Button loading>Saving draft</Button>
                <Button disabled>Connect channel</Button>
                <Button variant="danger" onClick={() => setModal(true)}>
                  Review cancellation
                </Button>
                <Button size="sm" variant="secondary" onClick={demo}>
                  Compact action
                </Button>
              </div>
            </Specimen>
            <p className="meta">
              Hover, press and tab through each control to inspect its states.
            </p>
          </LabSection>
          <LabSection
            title="Inputs"
            description="Soft surfaces, explicit labels and helpful feedback close to the field."
          >
            <div className="form-grid">
              <Input
                label="Product name"
                placeholder="e.g. Everyday tote"
                hint="Use the name your customers recognize."
              />
              <Input
                label="SKU"
                defaultValue="TOTE-OLV-01"
                success="SKU format looks good."
              />
              <Input
                label="Customer phone"
                defaultValue="017"
                error="Enter the complete phone number."
              />
              <Input
                label="Connected page"
                placeholder="Connect Meta to select a page"
                disabled
                hint="Channel connections arrive in a later phase."
              />
            </div>
            <div className="form-grid">
              <Textarea
                label="Internal note"
                placeholder="Add context for the next person…"
                hint="Visible to your team. Not sent to the customer."
              />
              <div className="gallery-stack">
                <Select label="Language" defaultValue="en">
                  <option value="en">English</option>
                  <option value="bn">Bangla</option>
                  <option value="ur">Urdu</option>
                </Select>
                <SearchInput
                  label="Search sample orders"
                  placeholder="Search order, customer or phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                />
              </div>
            </div>
          </LabSection>
          <LabSection
            title="Selection Controls"
            description="Predictable states, without unnecessary visual weight."
          >
            <div className="selection-grid">
              <div>
                <Checkbox label="Include an order summary" defaultChecked />
                <Checkbox label="Include delivery instructions" />
                <Checkbox label="Customer consent required" disabled />
              </div>
              <fieldset>
                <legend className="meta">Reply mode</legend>
                <Radio
                  name="lab-reply"
                  label="Suggest-only"
                  value="suggest"
                  defaultChecked
                />
                <Radio name="lab-reply" label="Manual replies" value="manual" />
              </fieldset>
              <div>
                <Switch label="Show source references" defaultChecked />
                <Switch label="Auto-send unavailable" disabled />
              </div>
            </div>
            <Divider />
            <SegmentedControl
              label="Preview device"
              value={view}
              onValueChange={setView}
              options={[
                { value: "desktop", label: "Desktop" },
                { value: "mobile", label: "Mobile" },
              ]}
            />
          </LabSection>
          <LabSection
            title="Navigation"
            description="Stable landmarks, clear selection and a short path to context."
          >
            <Tabs
              label="Example order detail tabs"
              items={[
                {
                  value: "summary",
                  label: "Summary",
                  content: (
                    <p className="muted">
                      Order #1048 · 1 item · Sample detail context
                    </p>
                  ),
                },
                {
                  value: "timeline",
                  label: "Timeline",
                  content: (
                    <p className="muted">
                      Draft created → details reviewed → awaiting confirmation.
                      Illustrative events only.
                    </p>
                  ),
                },
                {
                  value: "conversation",
                  label: "Conversation",
                  content: (
                    <p className="muted">
                      A linked conversation would stay one step away from the
                      order.
                    </p>
                  ),
                },
              ]}
            />
            <div className="nav-specimen">
              <span className="nav-specimen-active">
                <Package size={17} />
                Products<span className="count-badge">12</span>
              </span>
              <span>
                <Truck size={17} />
                Delivery
              </span>
              <span className="meta">Sample count · not live</span>
            </div>
          </LabSection>
          <LabSection
            title="Statuses"
            description="Metadata recedes. Operational state is legible. Urgency earns emphasis."
          >
            <Specimen label="Quiet metadata">
              <div className="gallery-row">
                <Badge>Draft</Badge>
                <Badge>Messenger</Badge>
                <Badge>Customer VIP</Badge>
              </div>
            </Specimen>
            <Specimen label="Operational states">
              <div className="gallery-row">
                <StatusBadge tone="warning">COD pending</StatusBadge>
                <StatusBadge tone="danger">Delivery failed</StatusBadge>
                <StatusBadge tone="warning">High RTO</StatusBadge>
                <StatusBadge tone="success">Meta connected</StatusBadge>
                <StatusBadge tone="primary">AI reply draft</StatusBadge>
              </div>
            </Specimen>
          </LabSection>
          <LabSection
            title="Data Display"
            description="Readable at working density. Tables become labeled records on small screens."
          >
            <DataTable
              caption="Illustrative orders · presentation only"
              rows={sampleOrders}
              rowKey={(row) => row.id}
              columns={[
                {
                  id: "order",
                  label: "Order",
                  render: (r) => <strong>{r.id}</strong>,
                },
                {
                  id: "customer",
                  label: "Customer",
                  render: (r) => (
                    <div className="table-person">
                      <span>{r.customer}</span>
                      <small>{r.item}</small>
                    </div>
                  ),
                },
                {
                  id: "status",
                  label: "Status",
                  render: (r) => (
                    <StatusBadge
                      tone={
                        r.status === "Delivered"
                          ? "success"
                          : r.status === "Delivery failed"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {r.status}
                    </StatusBadge>
                  ),
                },
                {
                  id: "total",
                  label: "Total",
                  numeric: true,
                  render: (r) => r.amount,
                },
              ]}
            />
            <div className="data-extras">
              <div className="gallery-row">
                <Avatar name="Ayesha Rahman" />
                <Avatar name="Sales Team" />
                <span className="meta">Assigned to Sales Team</span>
              </div>
              <div className="progress-specimen">
                <span className="meta">
                  Import validation · 24 of 40 sample rows
                </span>
                <Progress value={60} label="Sample import validation" />
              </div>
            </div>
          </LabSection>
          <LabSection
            title="Overlays"
            description="Context stays close. Detail drawers give longer work room to breathe."
          >
            <div className="overlay-preview">
              <div className="drawer-mini">
                <span />
                <span />
                <span />
                <div />
              </div>
              <div>
                <h3>A detail view, without losing your place.</h3>
                <p>
                  Persistent header, contextual actions, independently scrolling
                  content and an optional footer.
                </p>
                <div className="gallery-row">
                  <Button variant="secondary" onClick={() => setDrawer(true)}>
                    <PanelRight size={16} />
                    Open drawer
                  </Button>
                  <Button variant="secondary" onClick={() => setModal(true)}>
                    Open modal
                  </Button>
                </div>
              </div>
            </div>
            <div className="gallery-row">
              <Dropdown
                trigger={
                  <Button variant="secondary">
                    Order actions
                    <ArrowUpRight size={14} />
                  </Button>
                }
                items={[
                  {
                    label: "View sample details",
                    onSelect: () => setDrawer(true),
                  },
                  {
                    label: "Print invoice · unavailable",
                    disabled: true,
                    onSelect: () => {},
                  },
                  {
                    label: "Review cancellation",
                    danger: true,
                    onSelect: () => setModal(true),
                  },
                ]}
              />
              <Popover
                label="Source details"
                trigger={<Button variant="ghost">Source details</Button>}
              >
                <h3>Approved product facts</h3>
                <p>
                  Everyday tote · Sample record. In the product, this panel will
                  identify the information behind a draft.
                </p>
              </Popover>
              <Tooltip content="Only a person can approve this action.">
                <IconButton label="Approval information">
                  <ShieldCheck size={18} />
                </IconButton>
              </Tooltip>
            </div>
          </LabSection>
          <LabSection
            title="Feedback"
            description="Tell people what happened, what is missing and what they can do next."
          >
            <div className="gallery-row">
              <Button
                variant="secondary"
                onClick={() =>
                  toast("This is a sample notification. Nothing was saved.")
                }
              >
                Show toast
              </Button>
              <span className="meta">Dismissible, announced feedback</span>
            </div>
            <div className="feedback-grid">
              <div
                className="loading-specimen"
                role="status"
                aria-label="Loading customer details"
              >
                <div className="gallery-row">
                  <Skeleton className="skeleton-avatar" />
                  <div className="skeleton-lines">
                    <Skeleton />
                    <Skeleton className="w-2/3" />
                  </div>
                </div>
                <Skeleton />
                <Skeleton className="w-1/2" />
                <span className="meta">Loading customer details…</span>
              </div>
              <EmptyState
                icon={<Package size={24} />}
                title="Your catalog starts here"
                description="Approved product details will help your team and AI answer accurately."
                action={
                  <Button variant="secondary" size="sm" onClick={demo}>
                    Preview next step
                    <ArrowRight size={14} />
                  </Button>
                }
              />
            </div>
            <OperationalNotice
              title="Connection interrupted"
              description="Your draft is safe. Reconnect before sending this reply. Sample recoverable error."
              tone="warning"
            />
          </LabSection>
          <LabSection
            title="AI Components"
            description="A subtle identity, visible sources and an explicit place for human judgment."
          >
            <div className="gallery-row">
              <AIAccent size="lg" />
              <AILabel>AI assistant</AILabel>
              <StatusBadge tone="primary">Suggest-only</StatusBadge>
            </div>
            <AIContent
              title="AI reply draft"
              sources={
                <>
                  <AISource
                    name="Everyday tote"
                    detail="Product"
                    onOpen={() =>
                      toast("Illustrative source: approved product facts.")
                    }
                  />
                  <AISource name="Returns policy" detail="Policy" />
                </>
              }
              footer={
                <>
                  <AIConfidence
                    level="high"
                    reason="Approved sources available"
                  />
                  <span className="meta">Sample reply · not sent</span>
                </>
              }
            >
              <p>
                Yes, the Everyday tote is available in olive. Would you like
                help choosing a size?
              </p>
            </AIContent>
            <div className="ai-state-demo">
              <Select
                label="AI state preview"
                value={aiState}
                onChange={(e) =>
                  setAiState(e.target.value as AIPresentationState)
                }
              >
                <option value="idle">Ready</option>
                <option value="thinking">Thinking</option>
                <option value="draft">Draft ready</option>
                <option value="approval">Approval required</option>
                <option value="handoff">Human handoff</option>
                <option value="paused">Paused</option>
              </Select>
              <AIStateIndicator state={aiState} />
            </div>
            <AISuggestion
              title="Check the delivery address"
              description="The sample order is missing an area. Ask the customer before preparing a booking."
              action={
                <Button variant="ghost" size="sm" onClick={demo}>
                  Preview
                  <ArrowUpRight size={14} />
                </Button>
              }
            />
            <AIActionReview
              title="Prepare a courier booking"
              description="Review the recipient, delivery details and charges before approval. This is a UI example."
              onReview={() => setModal(true)}
            />
            <HumanHandoff
              assignee="Sales Team"
              reason="The customer requested a refund. AI remains paused for review."
            />
          </LabSection>
          <LabSection
            title="Commerce Components"
            description="Reusable context, without shipping a feature module."
          >
            <div className="commerce-facts">
              <CommerceFact label="Order reference" value="#1048" />
              <CommerceFact
                label="Payment method"
                value="Cash on delivery"
                icon="payment"
              />
              <CommerceFact
                label="Delivery"
                value="Awaiting review"
                icon="delivery"
              />
            </div>
            <ConnectionStatus
              name="Meta connection"
              connected
              lastSync="Illustrative state · synced 2 minutes ago"
            />
            <OperationalNotice
              title="Low stock"
              description="Everyday tote · 3 units in this sample. Show the product and a clear next step, not a large warning block."
              tone="warning"
            />
          </LabSection>
          <LabSection
            title="Motion"
            description="A response to intention. Short distances, no bounce and no decorative loops."
          >
            <div className="motion-demo">
              <motion.div
                key={motionKey}
                initial={
                  motionKey === 0 || reduced
                    ? false
                    : { opacity: 0, y: 6, scale: 0.99 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: reduced ? 0 : duration.overlay, ease }}
              >
                <Check size={19} />
                <span>Ready for your review</span>
              </motion.div>
              <Button
                variant="secondary"
                onClick={() => setMotionKey((k) => k + 1)}
              >
                Replay transition
              </Button>
            </div>
            <div className="motion-scale">
              <span>
                <strong>150ms</strong>Feedback
              </span>
              <span>
                <strong>200ms</strong>Selection
              </span>
              <span>
                <strong>280ms</strong>Overlays
              </span>
              <span>
                <strong>300ms</strong>Page entry
              </span>
            </div>
            <p className="meta">
              Your reduced-motion preference is respected. Loading uses a static
              skeleton rather than a decorative loop.
            </p>
          </LabSection>
          <LabSection
            title="Responsive Examples"
            description="Different work deserves different layouts. These are composition patterns, not product pages."
          >
            <Select
              label="Page architecture"
              value={layout}
              onChange={(e) => setLayout(e.target.value as PageVariant)}
            >
              {layouts.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
            <div className="architecture-preview" data-layout={layout}>
              <div className="architecture-header">
                <span>
                  {layouts.find((l) => l.value === layout)?.label} page
                </span>
                <span className="architecture-action">Primary action</span>
              </div>
              <div className="architecture-filter">Tabs / optional filters</div>
              <div className="architecture-body">
                <div>Navigation / list</div>
                <div>Working content</div>
                <div>Context / preview</div>
              </div>
            </div>
            <p className="meta">
              Desktop 1440 / 1280 · Tablet 1024 / 768 · Mobile 430 / 390 / 375 /
              320. Small screens stack context and keep actions reachable.
            </p>
          </LabSection>
        </div>
      </div>
      <Modal
        open={modal}
        onOpenChange={setModal}
        title="Review before continuing"
        description="A preview of an approval step. No action will run."
        metadata={<StatusBadge tone="warning">Approval required</StatusBadge>}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setModal(false);
                toast("Preview confirmed. No records changed.");
              }}
            >
              Confirm preview
            </Button>
          </>
        }
      >
        <div className="review-summary">
          <ShieldCheck size={22} />
          <div>
            <h3>You make the final decision</h3>
            <p>
              Show the affected records, source information and exact changes
              before a consequential action.
            </p>
          </div>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Sample record</dt>
            <dd>Order #1048</dd>
          </div>
          <div>
            <dt>Execution</dt>
            <dd>Preview only</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>Illustrative fixture</dd>
          </div>
        </dl>
      </Modal>
      <Drawer
        open={drawer}
        onOpenChange={setDrawer}
        title="Order #1048"
        description="A detail-drawer specimen. No real order exists."
        metadata={
          <>
            <Badge>Illustrative record</Badge>
            <StatusBadge tone="warning">COD pending</StatusBadge>
          </>
        }
        actions={
          <Tooltip content="Copy sample reference">
            <IconButton
              label="Copy sample reference"
              onClick={() => toast("Sample reference: #1048")}
            >
              <Copy size={16} />
            </IconButton>
          </Tooltip>
        }
        footer={
          <>
            <span className="meta">Preview only · changes are not saved</span>
            <Button variant="secondary" onClick={() => setDrawer(false)}>
              Close preview
            </Button>
          </>
        }
      >
        <div className="drawer-section">
          <div className="customer-summary">
            <Avatar name="Ayesha Rahman" />
            <div>
              <h3>Ayesha Rahman</h3>
              <p>Sample customer · Messenger</p>
            </div>
            <Badge>Customer VIP</Badge>
          </div>
        </div>
        <div className="drawer-section">
          <h3>Order summary</h3>
          <div className="sample-product">
            <span className="product-placeholder">
              <Package size={25} />
            </span>
            <div>
              <strong>Everyday tote</strong>
              <p>Olive · 1 item</p>
            </div>
            <strong>৳1,490</strong>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Payment</dt>
              <dd>Cash on delivery</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>Not booked</dd>
            </div>
          </dl>
        </div>
        <div className="drawer-section">
          <h3>Context for your team</h3>
          <AIContent
            title="Sample conversation summary"
            sources={
              <AISource name="Conversation" detail="Illustrative source" />
            }
          >
            <p>
              The customer asked about the olive tote. Delivery area still needs
              confirmation before preparing the order.
            </p>
          </AIContent>
        </div>
        <div className="drawer-section">
          <h3>Activity</h3>
          <ol className="timeline">
            <li>
              <span />
              <div>
                <strong>Draft prepared</strong>
                <p>Product and quantity added to this sample.</p>
                <small>10:42 AM · Sample event</small>
              </div>
            </li>
            <li>
              <span />
              <div>
                <strong>Delivery area needs review</strong>
                <p>Keep incomplete details visible before confirmation.</p>
                <small>10:43 AM · Sample event</small>
              </div>
            </li>
            <li>
              <span />
              <div>
                <strong>Awaiting a person</strong>
                <p>No booking or payment action has run.</p>
                <small>Current sample state</small>
              </div>
            </li>
          </ol>
        </div>
        <div className="drawer-section">
          <Textarea
            label="Internal note"
            placeholder="Add a note to this local preview…"
            hint="Closing the preview does not save this note."
          />
        </div>
      </Drawer>
    </PageShell>
  );
}
