# Design system foundation

## Direction
A calm operating workspace for social selling. Layered neutral navigation and white working surfaces, a soft gray application canvas, violet used for actions and AI. The dashboard emphasizes the path from product to conversation to order. No gradients, decorative glass, neon, fabricated charts or decorative animation.

## Tokens
`styles/tokens.css` defines the exact requested base, border, primary and semantic colors. Semantic foreground variants (`*-text`) darken success/warning/danger/info text on their soft backgrounds for contrast; the requested status colors remain available for non-text marks. Tailwind v4 exposes background, surface, muted, border, primary, foreground, secondary and font aliases. Spacing follows a 4px/8px rhythm. Radius: 8, 12, 16, 18 and pill. Shadows: subtle surface and overlay only.

Geist: page headings 26–28px/600, section headings 18–20px, card headings 14–16px, body 14px, supporting 13px, metadata 12px. Larger AI introduction text is intentional editorial emphasis. Motion tokens: 150ms micro, 200ms normal, 280ms overlays, 300ms page. Framer Motion animates overlay entry/exit, active navigation/tab/segment indicators, explicit AI states and visible page entry. Radix data-state attributes drive lightweight feedback and floating-surface entry/exit. Reduced-motion preference suppresses both.

## Components

| File | Exports |
|---|---|
| ui/button.tsx | Button, IconButton |
| ui/fields.tsx | Input, SearchInput, Textarea, Select, Checkbox, Radio, Switch |
| ui/display.tsx | Badge, StatusBadge, Avatar, Skeleton, EmptyState, Progress, Divider |
| ui/tabs.tsx | Tabs, SegmentedControl |
| ui/overlays.tsx | Tooltip, Dropdown, Popover, Modal, Drawer |
| ui/toast.tsx | ToastProvider, useToast |
| forms/form-section.tsx | FormSection |
| layout/page-header.tsx | PageHeader, PageTitle, PageDescription, primary/secondary action slots |
| layout/page-shell.tsx | PageShell (six variants), WorkspacePanels |
| layout/page-transition.tsx | Visible SSR page entry used from the App Router template |
| layout/module-shell.tsx | PRD-aware placeholder template |
| data-display/metric-placeholder.tsx | Honest no-data metric |
| commerce/channel-status.tsx | Disconnected channels |
| commerce/commerce-primitives.tsx | CommerceFact, ConnectionStatus, OperationalNotice |
| data-display/data-table.tsx | Generic DataTable with labeled mobile records |
| ai/ai-primitives.tsx | AIAccent, AILabel, AISource, AIConfidence, AIStateIndicator, AIContent, AISuggestion, AIActionReview, HumanHandoff |
| ai/command-dialog.tsx | Local navigation dialog, no AI execution |

## State contracts
Buttons support default, hover, pressed, focus, disabled, loading and destructive styling. Inputs support label, hint, error, success, disabled, hover and focus. Choice primitives support native checked/selected and disabled states. Tabs and segmented controls expose selected state through accessible semantics. Status badges use readable labels and icons; color never carries state alone. Toast feedback is announced and dismissible. Skeletons are decorative within a caller-provided labeled loading region. Progress clamps 0–100 and requires an accessible name.

Dialog and drawer provide title/description, Escape close, scroll lock, focus trapping and focus restoration. Dropdown and tabs use Radix keyboard behavior. Tooltips supplement rather than replace accessible names. Native select preserves platform keyboard/touch behavior. Form labels and errors are associated programmatically. Use a future confirmation-specific wrapper to enforce business-risk decisions; these generic overlays themselves do not grant permission.

## Responsive rules
Desktop ≥1200px: 224px persistent sidebar with an explicit 72px collapse state. Tablet 768–1199px: 72px icon rail with accessible link names and native hover titles. Mobile <768px: drawer; two-column metrics and stacked content. Overflow stays inside appropriate lists, not the page. Touch controls are generally 40–44px; button density supports desktop operations. Test 320px minimum, zoom, long translated labels, and user-generated text with `dir="auto"` when fields arrive.

## Future patterns
Do not infer business validity from presentation types. AI permissions, payment truth, inventory reservations and order state machines must be supplied by authoritative domain contracts in future phases. A generic table and AI source/approval presentation patterns now exist. Order records, timelines and commerce states in the laboratory are labeled specimens only. Import mapping workflows, audit modules and storefront themes remain future work.

## Elevation pass
See `visual-elevation.md` for the audit, rationale, token roles, responsive decisions and remaining weaknesses. The laboratory includes Foundations, Colors, Typography, Spacing, Buttons, Inputs, Selection Controls, Navigation, Statuses, Data Display, Overlays, Feedback, AI Components, Commerce Components, Motion and Responsive Examples.

The palette is unchanged. New token roles cover border-subtle, surface-hover/inset, brand-pressed, focus-ring, surface/control/overlay shadows, layer order, typography weights, control height, page gutter, sidebar width and drawer width. Token values are grouped as primitive → semantic → component roles in one source file. `primitives.css`, `shell.css` and `laboratory.css` separate styling responsibilities.

Drawer defaults to a large right detail view; use variant=navigation for the left menu. Metadata, actions, footer and initialFocusRef are composable slots. The body scrolls independently. SearchInput supports a local or externally controlled value, with onClear for controlled fields. Demo state never grants permission or implies authoritative data.
