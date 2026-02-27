import { EarningCategory, Person } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthorizedEmailFromRequest } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { badRequestResponse, isoDateOrNull, serverErrorResponse, unauthorizedResponse } from "@/lib/api-helpers";
import { dollarsToCents, isoDateFromDateInput, isoDateToUtcDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const createPayoutSchema = z.object({
  category: z.nativeEnum(EarningCategory),
  name: z.string().trim().min(1),
  receiver: z.nativeEnum(Person),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  const actorEmail = await getAuthorizedEmailFromRequest(request);
  if (!actorEmail) return unauthorizedResponse();

  const payouts = await prisma.payout.findMany({
    where: { deletedAt: null },
    orderBy: { paidDate: "desc" },
  });

  return NextResponse.json(
    payouts.map((entry) => ({
      id: entry.id,
      category: entry.category,
      name: entry.name,
      receiver: entry.receiver,
      amountCents: entry.amountCents,
      paidDate: isoDateOrNull(entry.paidDate)!,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
  );
}

export async function POST(request: Request) {
  try {
    const actorEmail = await getAuthorizedEmailFromRequest(request);
    if (!actorEmail) return unauthorizedResponse();

    const parsed = createPayoutSchema.safeParse(await request.json());
    if (!parsed.success) return badRequestResponse(parsed.error.issues[0]?.message ?? "Invalid payload.");

    const data = parsed.data;
    const paidDateIso = isoDateFromDateInput(data.date);
    const paidDate = isoDateToUtcDate(paidDateIso);

    const created = await prisma.payout.create({
      data: {
        category: data.category,
        name: data.name,
        receiver: data.receiver,
        amountCents: dollarsToCents(data.amount),
        paidDate,
        createdByEmail: actorEmail,
        updatedByEmail: actorEmail,
      },
    });

    await logAudit({
      actorEmail,
      entityType: "PAYOUT",
      entityId: created.id,
      action: "CREATE",
      afterJson: {
        category: created.category,
        name: created.name,
        receiver: created.receiver,
        amountCents: created.amountCents,
        paidDate: paidDateIso,
      },
    });

    return NextResponse.json({
      id: created.id,
      category: created.category,
      name: created.name,
      receiver: created.receiver,
      amountCents: created.amountCents,
      paidDate: isoDateOrNull(created.paidDate),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return serverErrorResponse();
  }
}
