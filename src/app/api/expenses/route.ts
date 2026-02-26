import { Person } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthorizedEmail } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { badRequestResponse, isoDateOrNull, serverErrorResponse, unauthorizedResponse } from "@/lib/api-helpers";
import { dollarsToCents, isoDateFromDateInput, isoDateToUtcDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const createExpenseSchema = z.object({
  name: z.string().trim().min(1),
  spender: z.nativeEnum(Person),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET() {
  const actorEmail = await getAuthorizedEmail();
  if (!actorEmail) return unauthorizedResponse();

  const expenses = await prisma.expense.findMany({
    where: { deletedAt: null },
    orderBy: [{ spentDate: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(
    expenses.map((entry) => ({
      id: entry.id,
      name: entry.name,
      spender: entry.spender,
      amountCents: entry.amountCents,
      spentDate: isoDateOrNull(entry.spentDate),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
  );
}

export async function POST(request: Request) {
  try {
    const actorEmail = await getAuthorizedEmail();
    if (!actorEmail) return unauthorizedResponse();

    const parsed = createExpenseSchema.safeParse(await request.json());
    if (!parsed.success) return badRequestResponse(parsed.error.issues[0]?.message ?? "Invalid payload.");

    const data = parsed.data;
    const spentDateIso = isoDateFromDateInput(data.date);
    const spentDate = isoDateToUtcDate(spentDateIso);

    const created = await prisma.expense.create({
      data: {
        name: data.name,
        spender: data.spender,
        amountCents: dollarsToCents(data.amount),
        spentDate,
        createdByEmail: actorEmail,
        updatedByEmail: actorEmail,
      },
    });

    await logAudit({
      actorEmail,
      entityType: "EXPENSE",
      entityId: created.id,
      action: "CREATE",
      afterJson: {
        name: created.name,
        spender: created.spender,
        amountCents: created.amountCents,
        spentDate: spentDateIso,
      },
    });

    return NextResponse.json({
      id: created.id,
      name: created.name,
      spender: created.spender,
      amountCents: created.amountCents,
      spentDate: isoDateOrNull(created.spentDate),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return serverErrorResponse();
  }
}
