import { PrismaClient } from "@prisma/client";

import { GOOGLE_SHEET_ID, SYSTEM_ACTOR_EMAIL, WHITELIST_SEED_EMAILS } from "../src/lib/constants";
import {
  computeSourceHash,
  normalizeCategory,
  normalizePerson,
  parseCsvRows,
  parseCurrencyToCents,
  parseSheetDate,
} from "../src/lib/normalization";

const prisma = new PrismaClient();

function toObjectRows(csvText: string): Array<Record<string, string>> {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = (row[index] ?? "").trim();
    });
    return obj;
  });
}

async function fetchSheetCsv(sheetName: "Earnings" | "Expenses"): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sheetName}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function seedWhitelistEmails() {
  for (const email of WHITELIST_SEED_EMAILS) {
    await prisma.allowedEmail.upsert({
      where: { email },
      update: { isActive: true },
      create: { email, isActive: true },
    });
  }
}

async function importEarnings() {
  const csvText = await fetchSheetCsv("Earnings");
  const rows = toObjectRows(csvText);
  let importedCount = 0;

  for (const row of rows) {
    if (!row["Earning Source"] && !row["Amount"]) continue;
    const category = normalizeCategory(row["Category"] ?? "");
    const source = (row["Earning Source"] ?? "").trim();
    const receiver = normalizePerson(row["Receiver"] ?? "");
    const amountCents = parseCurrencyToCents(row["Amount"] ?? "0");
    const parsedDate = parseSheetDate(row["Date"] ?? "");
    if (!parsedDate) {
      throw new Error(`Earning row is missing date: ${source}`);
    }

    const sourceHash = computeSourceHash(
      "earning",
      [category, source.toLowerCase(), receiver, amountCents.toString(), parsedDate].join("|"),
    );

    await prisma.earning.upsert({
      where: { sourceHash },
      update: {
        category,
        source,
        receiver,
        amountCents,
        receivedDate: parsedDate,
        updatedByEmail: SYSTEM_ACTOR_EMAIL,
      },
      create: {
        category,
        source,
        receiver,
        amountCents,
        receivedDate: parsedDate,
        sourceHash,
        createdByEmail: SYSTEM_ACTOR_EMAIL,
        updatedByEmail: SYSTEM_ACTOR_EMAIL,
      },
    });

    importedCount += 1;
  }

  return importedCount;
}

async function importExpenses() {
  const csvText = await fetchSheetCsv("Expenses");
  const rows = toObjectRows(csvText);
  let importedCount = 0;

  for (const row of rows) {
    if (!row["Expense"] && !row["Amount"]) continue;
    const name = (row["Expense"] ?? "").trim();
    const spender = normalizePerson(row["Spent By"] ?? "");
    const amountCents = parseCurrencyToCents(row["Amount"] ?? "0");
    const spentDate = parseSheetDate(row["Date"] ?? "");

    const sourceHash = computeSourceHash(
      "expense",
      [name.toLowerCase(), spender, amountCents.toString(), spentDate ?? "null"].join("|"),
    );

    await prisma.expense.upsert({
      where: { sourceHash },
      update: {
        name,
        spender,
        amountCents,
        spentDate,
        updatedByEmail: SYSTEM_ACTOR_EMAIL,
      },
      create: {
        name,
        spender,
        amountCents,
        spentDate,
        sourceHash,
        createdByEmail: SYSTEM_ACTOR_EMAIL,
        updatedByEmail: SYSTEM_ACTOR_EMAIL,
      },
    });

    importedCount += 1;
  }

  return importedCount;
}

async function main() {
  await seedWhitelistEmails();
  const earningsCount = await importEarnings();
  const expensesCount = await importExpenses();

  console.info(`Seed complete. Earnings rows processed: ${earningsCount}`);
  console.info(`Seed complete. Expenses rows processed: ${expensesCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
