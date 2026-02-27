import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

import { GOOGLE_SHEET_ID, SYSTEM_ACTOR_EMAIL, WHITELIST_SEED_EMAILS } from "../src/lib/constants";
import { isoDateToUtcDate } from "../src/lib/format";
import { computeSourceHash, normalizeCategory, normalizePerson, parseCurrencyToCents, parseSheetDate } from "../src/lib/normalization";

const prisma = new PrismaClient();

type SheetName = "Earnings" | "Expenses" | "Payouts";
type Row = Record<string, unknown>;

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toIsoDateFromSerial(serial: number): string {
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) {
    throw new Error(`Unsupported numeric date value: ${serial}`);
  }
  const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  return date.toISOString().slice(0, 10);
}

function parseSheetDateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    return toIsoDateFromSerial(value);
  }

  return parseSheetDate(toStringValue(value));
}

async function fetchWorkbook(): Promise<XLSX.WorkBook> {
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=xlsx`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet workbook: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return XLSX.read(buffer, { type: "buffer", cellDates: true });
}

function getRows(workbook: XLSX.WorkBook, sheetName: SheetName): Row[] {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found in workbook.`);
  }
  return XLSX.utils.sheet_to_json<Row>(worksheet, { defval: "", raw: true });
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

async function importEarnings(workbook: XLSX.WorkBook) {
  const rows = getRows(workbook, "Earnings");
  let importedCount = 0;

  for (const [index, row] of rows.entries()) {
    const source = toStringValue(row["Earning Source"]);
    const amountRaw = toStringValue(row["Amount"]);
    if (!source && !amountRaw) continue;

    const category = normalizeCategory(toStringValue(row["Category"]));
    const receiver = normalizePerson(toStringValue(row["Receiver"]));
    const amountCents = parseCurrencyToCents(amountRaw || "0");
    const parsedDate = parseSheetDateValue(row["Date"]);
    if (!parsedDate) {
      throw new Error(`Earning row is missing date: ${source || `row-${index + 2}`}`);
    }

    const sourceHash = computeSourceHash(
      "earning",
      [index.toString(), category, source.toLowerCase(), receiver, amountCents.toString(), parsedDate].join("|"),
    );
    const receivedDate = isoDateToUtcDate(parsedDate);

    await prisma.earning.upsert({
      where: { sourceHash },
      update: {
        category,
        source,
        receiver,
        amountCents,
        receivedDate,
        updatedByEmail: SYSTEM_ACTOR_EMAIL,
      },
      create: {
        category,
        source,
        receiver,
        amountCents,
        receivedDate,
        sourceHash,
        createdByEmail: SYSTEM_ACTOR_EMAIL,
        updatedByEmail: SYSTEM_ACTOR_EMAIL,
      },
    });

    importedCount += 1;
  }

  return importedCount;
}

async function importExpenses(workbook: XLSX.WorkBook) {
  const rows = getRows(workbook, "Expenses");
  let importedCount = 0;

  for (const [index, row] of rows.entries()) {
    const name = toStringValue(row["Expense"]);
    const amountRaw = toStringValue(row["Amount"]);
    if (!name && !amountRaw) continue;

    const spender = normalizePerson(toStringValue(row["Spent By"]));
    const amountCents = parseCurrencyToCents(amountRaw || "0");
    const spentDateIso = parseSheetDateValue(row["Date"]);

    const sourceHash = computeSourceHash(
      "expense",
      [index.toString(), name.toLowerCase(), spender, amountCents.toString(), spentDateIso ?? "null"].join("|"),
    );
    const spentDate = spentDateIso ? isoDateToUtcDate(spentDateIso) : null;

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

async function importPayouts(workbook: XLSX.WorkBook) {
  const rows = getRows(workbook, "Payouts");
  let importedCount = 0;

  for (const [index, row] of rows.entries()) {
    const name = toStringValue(row["Name"]);
    const amountRaw = toStringValue(row["Amount"]);
    if (!name && !amountRaw) continue;

    const category = normalizeCategory(toStringValue(row["Category"]));
    const receiver = normalizePerson(toStringValue(row["Receiver"]));
    const amountCents = parseCurrencyToCents(amountRaw || "0");
    const parsedDate = parseSheetDateValue(row["Date"]);
    if (!parsedDate) {
      throw new Error(`Payout row is missing date: ${name || `row-${index + 2}`}`);
    }

    const sourceHash = computeSourceHash(
      "payout",
      [index.toString(), category, name.toLowerCase(), receiver, amountCents.toString(), parsedDate].join("|"),
    );
    const paidDate = isoDateToUtcDate(parsedDate);

    await prisma.payout.upsert({
      where: { sourceHash },
      update: {
        category,
        name,
        receiver,
        amountCents,
        paidDate,
        updatedByEmail: SYSTEM_ACTOR_EMAIL,
      },
      create: {
        category,
        name,
        receiver,
        amountCents,
        paidDate,
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
  const workbook = await fetchWorkbook();
  const earningsCount = await importEarnings(workbook);
  const expensesCount = await importExpenses(workbook);
  const payoutsCount = await importPayouts(workbook);

  console.info(`Seed complete. Earnings rows processed: ${earningsCount}`);
  console.info(`Seed complete. Expenses rows processed: ${expensesCount}`);
  console.info(`Seed complete. Payouts rows processed: ${payoutsCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
