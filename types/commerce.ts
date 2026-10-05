export const languages = ["bn", "bn-en", "en", "ur-roman", "ur"] as const;
export const aiModes = ["off", "suggest", "auto_low_risk"] as const;
export const onboardingSteps = [
  "account",
  "shop",
  "products",
  "channels",
  "ai_mode",
  "launch",
] as const;
export const shopStatuses = ["draft", "launched"] as const;

export type Language = (typeof languages)[number];
export type AiMode = (typeof aiModes)[number];
export type OnboardingStep = (typeof onboardingSteps)[number];
export type ShopStatus = (typeof shopStatuses)[number];

export type Owner = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  language: Language;
  createdAt: string;
};

export type PolicyDefaults = {
  deliveryCharge: number;
  returnDays: number;
  codAllowed: boolean;
  advancePaymentRules?: string;
};

export type Shop = {
  id: string;
  ownerId: string;
  legalName?: string;
  displayName: string;
  subdomain: string;
  category: string;
  country: string;
  currency: string;
  address?: string;
  logoUrl?: string;
  language: Language;
  status: ShopStatus;
  onboardingStep: OnboardingStep;
  policyDefaults: PolicyDefaults;
  aiMode: AiMode;
  selectedTemplateId?: string;
  launchedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoreTemplate = {
  id: string;
  name: string;
  type: "storefront" | "admin" | "fullstack";
  sourceUrl: string;
  license: string;
  stack: string[];
  bestFor: string[];
  notes: string;
  status: "test_only" | "candidate" | "reference_only";
};

export type FirstProduct = {
  id: string;
  shopId: string;
  name: string;
  price: number;
  stock: number;
  imageUrl?: string;
  variants?: string[];
  deliveryNotes?: string;
  status: "draft" | "active";
  createdAt: string;
};

export type ChannelConnection = {
  id: string;
  shopId: string;
  provider: "meta" | "instagram" | "whatsapp" | "courier";
  status: "skipped" | "pending" | "connected" | "failed";
  reason?: string;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  shopId: string;
  actor: "system" | "owner";
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type OnboardingState = {
  owner: Owner;
  shop: Shop;
  products: FirstProduct[];
  channels: ChannelConnection[];
  audit: AuditEvent[];
  templates: StoreTemplate[];
  launchChecklist: {
    hasProduct: boolean;
    hasTemplate: boolean;
    canLaunch: boolean;
    blockers: string[];
  };
};

export type OnboardingData = {
  owners: Owner[];
  shops: Shop[];
  products: FirstProduct[];
  channels: ChannelConnection[];
  audit: AuditEvent[];
};

export type StartInput = {
  ownerName: string;
  shopName: string;
  subdomain?: string;
  category: string;
  country: string;
  currency: string;
  language: Language;
  email?: string;
  phone?: string;
};
export type ShopInput = Partial<
  Pick<
    Shop,
    | "displayName"
    | "subdomain"
    | "category"
    | "country"
    | "currency"
    | "address"
    | "language"
  >
> & { policyDefaults?: Partial<PolicyDefaults> };
export type ProductInput = { name: string; price: number; stock: number };
export type PublicProduct = {
  slug?: string;
  id: string;
  name: string;
  category?: string;
  description?: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
  status?: string;
  variants: (
    | string
    | {
        id: string;
        sku: string | null;
        title: string;
        price: number;
        stock: number;
      }
  )[];
};
export type PublicStore = {
  shop: Pick<
    Shop,
    | "id"
    | "displayName"
    | "subdomain"
    | "category"
    | "country"
    | "currency"
    | "language"
    | "status"
    | "policyDefaults"
    | "selectedTemplateId"
  >;
  template: StoreTemplate;
  products: PublicProduct[];
};
export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  variants: {
    id: string;
    sku: string | null;
    title: string;
    price: number;
    stock: number;
  }[];
};
