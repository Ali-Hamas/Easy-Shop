/** Theme IDs are persisted on the shop; never use a gallery label as a data key. */
export const storefrontThemeIds = [
  "fashion-lifestyle",
  "beauty-cosmetics",
  "electronics-gadgets",
  "food-restaurant",
  "modern-general",
] as const;

export type StorefrontThemeId = (typeof storefrontThemeIds)[number];
export type StorefrontAccent =
  "theme" | "neutral" | "violet" | "forest" | "rose" | "ocean";
export type StorefrontFont = "theme" | "geist" | "editorial" | "rounded";

export const storefrontAccentOptions: {
  value: StorefrontAccent;
  label: string;
  color: string;
}[] = [
  { value: "theme", label: "Theme original", color: "#505965" },
  { value: "neutral", label: "Graphite", color: "#303744" },
  { value: "violet", label: "Iris", color: "#5856D6" },
  { value: "forest", label: "Forest", color: "#285A46" },
  { value: "rose", label: "Mulberry", color: "#873B61" },
  { value: "ocean", label: "Ocean", color: "#245B83" },
];
export const storefrontFontOptions: {
  value: StorefrontFont;
  label: string;
  description: string;
}[] = [
  {
    value: "theme",
    label: "Theme original",
    description: "The type pairing designed for this theme.",
  },
  {
    value: "geist",
    label: "Modern",
    description: "Clear, contemporary Geist throughout.",
  },
  {
    value: "editorial",
    label: "Editorial",
    description: "Expressive Georgia headings with clear sans-serif body copy.",
  },
  {
    value: "rounded",
    label: "Friendly",
    description: "Soft humanist headings and clean, readable body copy.",
  },
];

export type StorefrontTheme = {
  id: StorefrontThemeId;
  name: string;
  category: string;
  description: string;
  layout: string;
  defaultFont: Exclude<StorefrontFont, "theme">;
  defaultAccent: string;
  palette: readonly [string, string, string];
  features: readonly string[];
};

export const storefrontThemes: readonly StorefrontTheme[] = [
  {
    id: "fashion-lifestyle",
    name: "Atelier",
    category: "Fashion & lifestyle",
    description:
      "An image-led editorial storefront with a generous masthead, portrait photography and considered whitespace.",
    layout:
      "Editorial split cover · staggered collection · portrait product gallery",
    defaultFont: "editorial",
    defaultAccent: "#303744",
    palette: ["#FFFFFF", "#EDF0F2", "#303744"],
    features: [
      "Editorial collections",
      "Portrait product imagery",
      "Scroll-led visual storytelling",
    ],
  },
  {
    id: "beauty-cosmetics",
    name: "Bloom",
    category: "Beauty & cosmetics",
    description:
      "A soft, spacious beauty boutique with centered storytelling, sculpted images and rounded product cards.",
    layout: "Centered cover · panoramic imagery · soft product gallery",
    defaultFont: "rounded",
    defaultAccent: "#873B61",
    palette: ["#FFFBFD", "#F2E8EF", "#873B61"],
    features: [
      "Centered brand story",
      "Sculpted image frames",
      "Soft, touch-friendly controls",
    ],
  },
  {
    id: "electronics-gadgets",
    name: "Circuit",
    category: "Electronics & gadgets",
    description:
      "A precise, product-first store with a dark launch panel, spacious search and a structured, compact catalog.",
    layout: "Product launch panel · dense catalog · technical product detail",
    defaultFont: "geist",
    defaultAccent: "#245B83",
    palette: ["#F6F8FA", "#172C40", "#245B83"],
    features: [
      "Prominent search",
      "Information-rich product cards",
      "Structured product detail",
    ],
  },
  {
    id: "food-restaurant",
    name: "Gather",
    category: "Food & restaurant",
    description:
      "A welcoming, menu-inspired shop with bold typography, round imagery and easy-to-scan product rows.",
    layout: "Welcoming cover · menu-style catalog · detailed product pages",
    defaultFont: "rounded",
    defaultAccent: "#285A46",
    palette: ["#FEFFF9", "#EDF1DC", "#285A46"],
    features: [
      "Menu-style product cards",
      "Round hero photography",
      "Comfortable mobile browsing",
    ],
  },
  {
    id: "modern-general",
    name: "Forma",
    category: "Modern general commerce",
    description:
      "A balanced, versatile shop with a clean asymmetric cover, clear collections and a flexible product grid.",
    layout: "Balanced split cover · collection rail · adaptable product grid",
    defaultFont: "geist",
    defaultAccent: "#5856D6",
    palette: ["#FFFFFF", "#F0EFF8", "#5856D6"],
    features: [
      "Flexible catalog",
      "Clear collection browsing",
      "Four-column desktop browsing",
    ],
  },
];

const legacyThemes: Record<string, StorefrontThemeId> = {
  "test-fashion-basic": "fashion-lifestyle",
  "test-gadget-basic": "electronics-gadgets",
};

export function getStorefrontTheme(id?: string | null): StorefrontTheme {
  const resolved = id ? (legacyThemes[id] ?? id) : "modern-general";
  return (
    storefrontThemes.find((theme) => theme.id === resolved) ??
    storefrontThemes[4]
  );
}
