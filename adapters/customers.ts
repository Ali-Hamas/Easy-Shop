import type { Customer, CustomerInput, CustomerEvent } from "@/types/customers";
export const blankCustomer = (): CustomerInput => ({
  name: "",
  phone: "",
  email: "",
  addresses: [],
  language: "unspecified",
  tags: [],
  source: "manual",
  status: "active",
});
export function customerDraft(c: Customer): CustomerInput {
  const { name, phone, email, addresses, language, tags, source, status } = c;
  return {
    name,
    phone,
    email,
    addresses: addresses.map((a) => ({ ...a })),
    language,
    tags: [...tags],
    source,
    status,
  };
}
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
export const eventLabels: Record<CustomerEvent["type"], string> = {
  customer_created: "Record created",
  customer_updated: "Details updated",
  note: "Staff note",
  order: "Order",
  conversation: "Conversation",
  return: "Return",
  complaint: "Complaint",
};
export const languageLabels = {
  unspecified: "Not specified",
  en: "English",
  bn: "Bangla",
  banglish: "Banglish",
  ur: "Urdu",
  "roman-urdu": "Roman Urdu",
};
export function customerDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
