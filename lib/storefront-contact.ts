export const CONTACT_MESSAGE_WORD_LIMIT = 500;
export function messageWordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}
export function whatsappDestination(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^\+?[\d\s().-]+$/.test(value.trim()) && /^[1-9]\d{6,14}$/.test(digits)
    ? `https://wa.me/${digits}`
    : null;
}
export function messengerDestination(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      u.hostname === "m.me" &&
      !u.port &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      /^\/[a-zA-Z0-9.]+\/?$/.test(u.pathname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function renderContactMessage(
  template: string,
  values: Record<string, string>,
) {
  // A single substitution pass preserves seller/buyer text as plain text.
  return template
    .replace(
      /\{(shop_name|product_name|product_price|product_url|variant)\}/g,
      (token, key: string) => values[key] ?? token,
    )
    .trim();
}
