import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getAuthorizedEmailFromRequest } from "@/lib/auth-guard";
import { unauthorizedResponse } from "@/lib/api-helpers";
import { CATEGORY_LABEL_BY_VALUE, PERSON_LABEL_BY_VALUE } from "@/lib/constants";
import { formatIsoDateLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function dollarsFromCents(cents: number): number {
  return Math.round((cents / 100) * 100) / 100;
}

export async function GET(request: Request) {
  const actorEmail = await getAuthorizedEmailFromRequest(request);
  if (!actorEmail) return unauthorizedResponse();

  const [earnings, expenses, payouts] = await Promise.all([
    prisma.earning.findMany({
      where: { deletedAt: null },
      orderBy: [{ receivedDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.expense.findMany({
      where: { deletedAt: null },
      orderBy: [{ spentDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.payout.findMany({
      where: { deletedAt: null },
      orderBy: [{ paidDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const earningsSheetRows = earnings.map((row) => ({
    Category: CATEGORY_LABEL_BY_VALUE[row.category],
    "Earning Source": row.source,
    Receiver: PERSON_LABEL_BY_VALUE[row.receiver],
    Amount: dollarsFromCents(row.amountCents),
    Date: formatIsoDateLabel(row.receivedDate.toISOString().slice(0, 10)),
  }));

  const expensesSheetRows = expenses.map((row) => ({
    Expense: row.name,
    "Spent By": PERSON_LABEL_BY_VALUE[row.spender],
    Amount: dollarsFromCents(row.amountCents),
    Date: formatIsoDateLabel(row.spentDate ? row.spentDate.toISOString().slice(0, 10) : null),
  }));

  const payoutsSheetRows = payouts.map((row) => ({
    Category: CATEGORY_LABEL_BY_VALUE[row.category],
    Name: row.name,
    Receiver: PERSON_LABEL_BY_VALUE[row.receiver],
    Amount: dollarsFromCents(row.amountCents),
    Date: formatIsoDateLabel(row.paidDate.toISOString().slice(0, 10)),
  }));

  const workbook = XLSX.utils.book_new();
  const earningsSheet = XLSX.utils.json_to_sheet(earningsSheetRows, {
    header: ["Category", "Earning Source", "Receiver", "Amount", "Date"],
  });
  const expensesSheet = XLSX.utils.json_to_sheet(expensesSheetRows, {
    header: ["Expense", "Spent By", "Amount", "Date"],
  });
  const payoutsSheet = XLSX.utils.json_to_sheet(payoutsSheetRows, {
    header: ["Category", "Name", "Receiver", "Amount", "Date"],
  });

  XLSX.utils.book_append_sheet(workbook, earningsSheet, "Earnings");
  XLSX.utils.book_append_sheet(workbook, expensesSheet, "Expenses");
  XLSX.utils.book_append_sheet(workbook, payoutsSheet, "Payouts");

  const fileBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  const filename = `vpay-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
