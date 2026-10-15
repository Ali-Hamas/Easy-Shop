export type CustomerAddress = {
  label: string;
  line: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};
export type CustomerInput = {
  name: string;
  phone: string;
  email: string;
  addresses: CustomerAddress[];
  language: "unspecified" | "en" | "bn" | "banglish" | "ur" | "roman-urdu";
  tags: string[];
  source: "manual" | "facebook" | "instagram" | "storefront" | "other";
  status: "active" | "inactive";
};
export type Customer = CustomerInput & {
  id: string;
  shopId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  orderSummary: null;
  riskContext: null;
};
export type CustomerList = {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
};
export type CustomerEvent = {
  id: string;
  customerId: string;
  type:
    | "customer_created"
    | "customer_updated"
    | "note"
    | "order"
    | "conversation"
    | "return"
    | "complaint";
  text: string;
  source: string;
  author: string;
  createdAt: string;
  changedFields?: string[];
  reference?: { module: string; id: string };
};
export type CustomerHistory = {
  entries: CustomerEvent[];
  total: number;
  page: number;
};
