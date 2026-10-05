# Foundation elevation review

## Design review

The first foundation was technically usable but visually relied on repeated bordered cards, a large filled navigation highlight, small metadata and a promotional sidebar panel. Equal-weight containers flattened the hierarchy. The primitive gallery did not give reviewers enough realistic context. Overlay entry existed, but exit and long-detail composition were missing.

The new direction is an operating workspace: quiet navigation, strong page typography, an open metric strip and one primary working surface. The AI area is an adjoining context surface. Connections and attention use whitespace and small separators rather than more cards.

## Changes

- Preserved all approved semantic colors. Tokens now have primitive, semantic and component layers, including control dimensions, sidebar widths, focus, border strength, material shadows and overlay layers.
- Sidebar uses a 224px expanded rail, 72px compact rail, restrained active background, slim animated indicator and an explicit desktop collapse control. No fabricated operational counts.
- Topbar groups shop context, a compact command surface, connection health and personal utilities. The AI control retains an accessible name at mobile sizes.
- Buttons use inset highlight and restrained shadow; inputs use soft inset surfaces, consistent labels and feedback, refined native choices, and a keyboard-accessible search clear action.
- Status labels use small-radius chips and low-saturation semantic surfaces. Quiet metadata is separated from actionable status.
- PageShell exposes header, primary/secondary actions, optional tabs/filters and six layout variants: standard, data, workspace, settings, editor and analytics. WorkspacePanels provides list/content/context slots.
- Detail drawers include metadata, header actions, independently scrolling content and optional persistent footer. Mobile navigation remains a separate drawer variant.
- The laboratory has all 16 requested sections and clearly labeled fixtures. The table, timeline, order and AI examples are presentation specimens only.
- Reusable AI language includes accent, label, generated content, sources, confidence, state, suggestion, approval preview and human handoff. No AI execution or source-validity inference is included.

## Motion

150ms control feedback, 200ms selection, 280ms overlays and 300ms page entry. Framer Motion handles navigation/tab/segment indicators, overlays, page entry and explicit AI state changes. Radix state-driven CSS animates dropdown, popover, tooltip and toast entry/exit. Sidebar width transitions preserve layout. All reduced-motion preferences are honored. No bounce, gradient, glass, neon, or decorative infinite loop.

Page entry starts with visible server-rendered content, then applies a 4px translation in the App Router template. It never holds a restored page at zero opacity. Overlay initial focus prefers a supplied target (command input) or the title (detail drawer); this avoids opening a tooltip before the person interacts.

## Responsive contract

1440/1280: expanded or manually collapsed sidebar. 1024/768: compact rail. 430/390/375/320: navigation drawer, icon command trigger, stacked working areas and labeled table records. Action groups wrap. Drawer title/footer remain visible while the detail body scrolls. The laboratory index becomes horizontally scrollable on smaller layouts.

## Boundaries and remaining weaknesses

- Workspace remains a provisional product identity. A final name, wordmark and brand voice need a separate decision.
- Empty-state metrics cannot fully prove the density of live operational screens. That must be checked against real high-volume content when feature work is authorized.
- Bangla and Urdu long-copy/RTL specimens and actual low-end Android rendering need a dedicated content and device review. These are not fully verified by desktop Chromium viewport tests.
- Automated accessibility and keyboard tests do not replace a manual screen-reader audit.
- Six page layouts are composition foundations. Product-specific behavior, permissions and mobile pane switching remain future module work.

Source boundaries remain in `product-map.md`. No Products, Inbox, Orders or other full feature module, backend, auth, API or business logic was added.

## Verification and visual handoff

Final validation: 13 Playwright tests passed; production build, TypeScript, ESLint and Prettier checks passed. See `verification.md` for coverage and limits.

- [Desktop dashboard](screenshots/elevation/dashboard-1440.png)
- [UI laboratory](screenshots/elevation/design-system-1440.png)
- [Large detail drawer](screenshots/elevation/detail-drawer.png)
- [Approval modal](screenshots/elevation/approval-modal.png)
- [AI components](screenshots/elevation/ai-components.png)
- [320px dashboard](screenshots/elevation/dashboard-320.png)
- [Mobile command](screenshots/elevation/mobile-command.png)
