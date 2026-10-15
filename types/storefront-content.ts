export type StorefrontSectionId =
  | "hero"
  | "categories"
  | "featured"
  | "catalog"
  | "reviews"
  | "about"
  | "policies"
  | "contact"
  | "tracking"
  | "footer";
export type StorefrontDesign = {
  themeId: string;
  accent: "theme" | "neutral" | "violet" | "forest" | "rose" | "ocean";
  fontSet: "theme" | "geist" | "editorial" | "rounded";
  sections: StorefrontSectionId[];
};
export const defaultDesign: StorefrontDesign = {
  themeId: "",
  accent: "theme",
  fontSet: "theme",
  sections: [
    "hero",
    "categories",
    "featured",
    "catalog",
    "about",
    "reviews",
    "policies",
    "contact",
    "tracking",
    "footer",
  ],
};
export type StorefrontContent = {
  storeName: string;
  design: StorefrontDesign;
  announcement: string;
  headline: string;
  description: string;
  logoUrl: string;
  coverImage: string;
  storyTitle: string;
  story: string;
  storyImage: string;
  email: string;
  phone: string;
  address: string;
  instagram: string;
  facebook: string;
  whatsappNumber: string;
  messengerUrl: string;
  contactMessage: string;
  delivery: string;
  payment: string;
  returns: string;
  featuredProductIds: string[];
  collections: { title: string; description: string; productIds: string[] }[];
  faqs: { question: string; answer: string }[];
};
export const emptyStorefrontContent: StorefrontContent = {
  storeName: "",
  design: defaultDesign,
  announcement: "",
  headline: "",
  description: "",
  logoUrl: "",
  coverImage: "",
  storyTitle: "",
  story: "",
  storyImage: "",
  email: "",
  phone: "",
  address: "",
  instagram: "",
  facebook: "",
  whatsappNumber: "",
  messengerUrl: "",
  contactMessage: "",
  delivery: "",
  payment: "",
  returns: "",
  featuredProductIds: [],
  collections: [],
  faqs: [],
};
export type StorefrontEditorState = {
  content: StorefrontContent;
  version: number;
  hasUnpublishedChanges: boolean;
  shop: {
    id: string;
    name: string;
    subdomain: string;
    status: "draft" | "launched";
    selectedTemplateId: string;
  };
  products: {
    id: string;
    name: string;
    status: string;
    imageUrl: string | null;
  }[];
};
