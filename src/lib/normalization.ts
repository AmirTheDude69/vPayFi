import crypto from "node:crypto";

import type { EarningCategory, Person } from "@prisma/client";

export function parseCurrencyToCents(raw: string): number {
  const normalized = raw.replaceAll("$", "").replaceAll(",", "").trim();
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid amount: ${raw}`);
  }
  return Math.round(parsed * 100);
}

const PERSON_MAP: Record<string, Person> = {
  "amir razagh": "AMIR",
  "jarrett goh": "JARRETT",
  "mike amiri": "MIKE",
  amir: "AMIR",
  jarrett: "JARRETT",
  mike: "MIKE",
  mogaii: "MOGAII",
  treasury: "TREASURY",
};

export function normalizePerson(raw: string): Person {
  const key = raw.trim().toLowerCase();
  const person = PERSON_MAP[key];
  if (!person) {
    throw new Error(`Unsupported person value: ${raw}`);
  }
  return person;
}

const CATEGORY_MAP: Record<string, EarningCategory> = {
  "token trading fee": "TOKEN_TRADING_FEES",
  "token trading fees": "TOKEN_TRADING_FEES",
  "token liquidation": "TOKEN_LIQUIDATIONS",
  "token liquidations": "TOKEN_LIQUIDATIONS",
  "app revenue": "APP_REVENUE",
  "b2b revenue": "B2B_REVENUE",
};

export function normalizeCategory(raw: string): EarningCategory {
  const key = raw.trim().toLowerCase();
  const category = CATEGORY_MAP[key];
  if (!category) {
    throw new Error(`Unsupported category value: ${raw}`);
  }
  return category;
}

const MONTH_BY_NAME: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function toIsoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date parts: ${year}-${month}-${day}`);
  }
  return date.toISOString().slice(0, 10);
}

export function parseSheetDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const wordMatch = value.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (wordMatch) {
    const day = Number.parseInt(wordMatch[1], 10);
    const month = MONTH_BY_NAME[wordMatch[2].toLowerCase()];
    const year = Number.parseInt(wordMatch[3], 10);
    if (!month) {
      throw new Error(`Invalid month name: ${value}`);
    }
    return toIsoDate(year, month, day);
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const first = Number.parseInt(slashMatch[1], 10);
    const second = Number.parseInt(slashMatch[2], 10);
    const year = Number.parseInt(slashMatch[3], 10);

    // Accept both M/D/YYYY and D/M/YYYY to handle historical data inconsistencies.
    if (first > 12) return toIsoDate(year, second, first);
    if (second > 12) return toIsoDate(year, first, second);
    return toIsoDate(year, second, first);
  }

  throw new Error(`Unsupported date format: ${raw}`);
}

export function computeSourceHash(prefix: "earning" | "expense", payload: string): string {
  return crypto.createHash("sha256").update(`${prefix}:${payload}`).digest("hex");
}

export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csvText[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
