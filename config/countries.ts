import type { Language } from "@/types/commerce";

export type CountryData = {
  code: string;
  name: string;
  defaultCurrency: string;
  suggestedLanguages: Language[];
  defaultLanguage: Language;
};

export type CurrencyData = {
  code: string;
  name: string;
  label: string;
};

export type LanguageOption = {
  code: Language;
  label: string;
  description: string;
};

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "bn", label: "Bangla", description: "Standard Bengali script" },
  {
    code: "bn-en",
    label: "Banglish",
    description: "Bangla written in Latin / English script",
  },
  {
    code: "en",
    label: "English",
    description: "Standard international English",
  },
  {
    code: "ur",
    label: "Urdu",
    description: "Standard Urdu in Perso-Arabic script",
  },
  {
    code: "ur-roman",
    label: "Roman Urdu",
    description: "Urdu written in Latin / Roman script",
  },
];

export const COUNTRIES: CountryData[] = [
  {
    code: "BD",
    name: "Bangladesh",
    defaultCurrency: "BDT",
    suggestedLanguages: ["bn", "bn-en", "en"],
    defaultLanguage: "bn",
  },
  {
    code: "PK",
    name: "Pakistan",
    defaultCurrency: "PKR",
    suggestedLanguages: ["ur", "ur-roman", "en"],
    defaultLanguage: "ur",
  },
  {
    code: "GB",
    name: "United Kingdom",
    defaultCurrency: "GBP",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "US",
    name: "United States",
    defaultCurrency: "USD",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    defaultCurrency: "AED",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "CA",
    name: "Canada",
    defaultCurrency: "CAD",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "AU",
    name: "Australia",
    defaultCurrency: "AUD",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    defaultCurrency: "SAR",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "DE",
    name: "Germany",
    defaultCurrency: "EUR",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "FR",
    name: "France",
    defaultCurrency: "EUR",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "IN",
    name: "India",
    defaultCurrency: "INR",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "SG",
    name: "Singapore",
    defaultCurrency: "SGD",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "MY",
    name: "Malaysia",
    defaultCurrency: "MYR",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "QA",
    name: "Qatar",
    defaultCurrency: "QAR",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "KW",
    name: "Kuwait",
    defaultCurrency: "KWD",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "OM",
    name: "Oman",
    defaultCurrency: "OMR",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "BH",
    name: "Bahrain",
    defaultCurrency: "BHD",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
  {
    code: "TR",
    name: "Turkey",
    defaultCurrency: "TRY",
    suggestedLanguages: ["en"],
    defaultLanguage: "en",
  },
];

export const CURRENCIES: CurrencyData[] = [
  { code: "BDT", name: "Bangladeshi Taka", label: "BDT - Bangladeshi Taka" },
  { code: "PKR", name: "Pakistani Rupee", label: "PKR - Pakistani Rupee" },
  { code: "GBP", name: "British Pound", label: "GBP - British Pound" },
  { code: "USD", name: "US Dollar", label: "USD - US Dollar" },
  { code: "AED", name: "UAE Dirham", label: "AED - UAE Dirham" },
  { code: "EUR", name: "Euro", label: "EUR - Euro" },
  { code: "CAD", name: "Canadian Dollar", label: "CAD - Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar", label: "AUD - Australian Dollar" },
  { code: "SAR", name: "Saudi Riyal", label: "SAR - Saudi Riyal" },
  { code: "INR", name: "Indian Rupee", label: "INR - Indian Rupee" },
  { code: "SGD", name: "Singapore Dollar", label: "SGD - Singapore Dollar" },
  { code: "MYR", name: "Malaysian Ringgit", label: "MYR - Malaysian Ringgit" },
  { code: "QAR", name: "Qatari Riyal", label: "QAR - Qatari Riyal" },
  { code: "KWD", name: "Kuwaiti Dinar", label: "KWD - Kuwaiti Dinar" },
  { code: "OMR", name: "Omani Rial", label: "OMR - Omani Rial" },
  { code: "BHD", name: "Bahraini Dinar", label: "BHD - Bahraini Dinar" },
  { code: "TRY", name: "Turkish Lira", label: "TRY - Turkish Lira" },
];

export function findCountry(query?: string | null): CountryData | undefined {
  if (!query) return undefined;
  const q = query.trim().toUpperCase();
  // Exact code match
  const byCode = COUNTRIES.find((c) => c.code.toUpperCase() === q);
  if (byCode) return byCode;
  // Exact or case-insensitive name match
  const byName = COUNTRIES.find((c) => c.name.toUpperCase() === q);
  if (byName) return byName;
  // Partial name match if length >= 3
  if (q.length >= 3) {
    return COUNTRIES.find((c) => c.name.toUpperCase().includes(q));
  }
  return undefined;
}

export function getCountryDefaults(countryQuery: string): {
  country: CountryData;
  currency: string;
  language: Language;
} {
  const country = findCountry(countryQuery) ?? COUNTRIES[0];
  return {
    country,
    currency: country.defaultCurrency,
    language: country.defaultLanguage,
  };
}

export function isSupportedCurrency(code: string): boolean {
  const upper = code.trim().toUpperCase();
  return CURRENCIES.some((c) => c.code === upper);
}
