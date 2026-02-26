import type { EarningCategory, Person } from "@prisma/client";

export const GOOGLE_SHEET_ID = "1jWxWEkHPfJywgf8vj8aNDIlZM8j5YWbO8kN9cW06Ceg";

export const PEOPLE: ReadonlyArray<{ value: Person; label: string }> = [
  { value: "AMIR", label: "Amir" },
  { value: "JARRETT", label: "Jarrett" },
  { value: "MIKE", label: "Mike" },
  { value: "MOGAII", label: "Mogaii" },
  { value: "TREASURY", label: "Treasury" },
];

export const EARNING_CATEGORIES: ReadonlyArray<{ value: EarningCategory; label: string }> = [
  { value: "TOKEN_TRADING_FEES", label: "Token Trading Fees" },
  { value: "TOKEN_LIQUIDATIONS", label: "Token Liquidations" },
  { value: "APP_REVENUE", label: "App Revenue" },
  { value: "B2B_REVENUE", label: "B2B Revenue" },
];

export const CATEGORY_LABEL_BY_VALUE: Record<EarningCategory, string> = Object.fromEntries(
  EARNING_CATEGORIES.map((entry) => [entry.value, entry.label]),
) as Record<EarningCategory, string>;

export const PERSON_LABEL_BY_VALUE: Record<Person, string> = Object.fromEntries(
  PEOPLE.map((entry) => [entry.value, entry.label]),
) as Record<Person, string>;

export const VALUE_BY_PERSON_LABEL = Object.fromEntries(
  PEOPLE.map((entry) => [entry.label.toLowerCase(), entry.value]),
) as Record<string, Person>;

export const VALUE_BY_CATEGORY_LABEL = Object.fromEntries(
  EARNING_CATEGORIES.map((entry) => [entry.label.toLowerCase(), entry.value]),
) as Record<string, EarningCategory>;

export const WHITELIST_SEED_EMAILS = [
  "amir.razagh76@gmail.com",
  "jarrett@biptap.com",
  "ma.paypal93@gmail.com",
] as const;

export const SYSTEM_ACTOR_EMAIL = "system@vpay.local";
