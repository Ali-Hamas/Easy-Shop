import {
  LayoutDashboard,
  MessagesSquare,
  ShoppingBag,
  Package,
  PanelsTopLeft,
  Truck,
  Wallet,
  Users,
  Megaphone,
  MousePointer2,
  Sparkles,
  ChartNoAxesCombined,
  Settings2,
} from "lucide-react";
export const navigation = [
  {
    slug: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    group: "Workspace",
    description:
      "A clear view of your shop, from first message to delivered order.",
    empty: "Your business, connected",
    detail:
      "Sales, conversations and daily operations will come together here once your shop is set up.",
    next: "products",
    action: "Explore products",
  },
  {
    slug: "inbox",
    label: "Inbox",
    icon: MessagesSquare,
    group: "Workspace",
    description: "Every conversation. One place to help customers and sell.",
    empty: "Make room for your next conversation",
    detail:
      "Messenger and Instagram conversations will appear here after you connect your channels.",
    next: "settings",
    action: "View connection settings",
  },
  {
    slug: "orders",
    label: "Orders",
    icon: ShoppingBag,
    group: "Workspace",
    description: "Follow every order from conversation to delivery.",
    empty: "Your first order starts here",
    detail:
      "Orders from chat, your website and manual entry will share one clear timeline.",
    next: "products",
    action: "Explore your catalog",
  },
  {
    slug: "products",
    label: "Products",
    icon: Package,
    group: "Workspace",
    description: "The approved product facts behind your shop and AI replies.",
    empty: "Good conversations start with good product data",
    detail:
      "Your products, variants, prices and available stock will live here. Product editing arrives in the next phase.",
    next: "website",
    action: "Explore website workspace",
  },
  {
    slug: "website",
    label: "Website",
    icon: PanelsTopLeft,
    group: "Workspace",
    description: "A trusted home for your products and social traffic.",
    empty: "A storefront that feels like your shop",
    detail:
      "Your theme, mobile preview and publishing controls will live here. Your storefront is not published.",
    next: "products",
    action: "Explore products",
  },
  {
    slug: "delivery",
    label: "Delivery",
    icon: Truck,
    group: "Workspace",
    description:
      "Keep confirmed orders moving, with clear tracking and next steps.",
    empty: "Ready for the journey after checkout",
    detail:
      "Courier booking, tracking and delivery issues will appear here when order and courier flows are available.",
    next: "orders",
    action: "View order workspace",
  },
  {
    slug: "payments",
    label: "Payments",
    icon: Wallet,
    group: "Workspace",
    description:
      "Clarity on advances, cash on delivery and courier settlements.",
    empty: "Every payment, accounted for",
    detail:
      "Payment records and COD reconciliation will connect to your orders here. No payment services are connected.",
    next: "orders",
    action: "View order workspace",
  },
  {
    slug: "customers",
    label: "Customers",
    icon: Users,
    group: "Workspace",
    description: "Know the people behind the conversations and orders.",
    empty: "Build relationships beyond the first order",
    detail:
      "Customer profiles will bring together order history, conversations and consent preferences.",
    next: "inbox",
    action: "Explore inbox",
  },
  {
    slug: "marketing",
    label: "Marketing",
    icon: Megaphone,
    group: "Growth",
    description:
      "Turn interest into conversations, and customers into repeat buyers.",
    empty: "Thoughtful growth starts with your customers",
    detail:
      "Comment rules, segments, coupons and reviewed campaigns will live here. No messages are being sent.",
    next: "customers",
    action: "Explore customers",
  },
  {
    slug: "ads",
    label: "Ads",
    icon: MousePointer2,
    group: "Growth",
    description: "Understand ad performance through real, delivered revenue.",
    empty: "Better decisions start with reliable tracking",
    detail:
      "Tracking health and campaign insights will appear after your order and delivery data are connected.",
    next: "analytics",
    action: "Explore analytics",
  },
  {
    slug: "ai",
    label: "AI Studio",
    icon: Sparkles,
    group: "Growth",
    description:
      "Product-grounded creativity and assistance, with you in control.",
    empty: "Your expertise. A little more possibility.",
    detail:
      "Reviewed creative drafts and source-backed assistance will live here. AI is not connected and cannot run actions.",
    next: "products",
    action: "Explore approved product data",
  },
  {
    slug: "analytics",
    label: "Analytics",
    icon: ChartNoAxesCombined,
    group: "Growth",
    description: "Understand what happened, and where your attention matters.",
    empty: "An honest picture starts with real data",
    detail:
      "Sales, delivered revenue, channel and AI performance will appear here when reliable activity is available.",
    next: "dashboard",
    action: "Back to dashboard",
  },
  {
    slug: "settings",
    label: "Settings",
    icon: Settings2,
    group: "Manage",
    description: "Your shop, team, connections and preferences.",
    empty: "A workspace built around your shop",
    detail:
      "Shop details, roles, integrations and billing will be configured here in a later phase. No account is connected.",
    next: "dashboard",
    action: "Back to dashboard",
  },
] as const;
export type ModuleSlug = (typeof navigation)[number]["slug"];

// Preserve route definitions while limiting discovery to the current release.
export const releaseNavigation: ReadonlyArray<(typeof navigation)[number]> =
  navigation.filter(
    (item) =>
      item.group !== "Growth" &&
      item.slug !== "delivery" &&
      item.slug !== "payments",
  );
