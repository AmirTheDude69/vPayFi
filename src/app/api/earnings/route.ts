import { EarningCategory, Person } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthorizedEmail } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { badRequestResponse, isoDateOrNull, serverErrorResponse, unauthorizedResponse } from "@/lib/api-helpers";
import { dollarsToCents, isoDateFromDateInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const createEarningSchema = z.object({
  category: z.nativeEnum(EarningCategory),
  source: z.string().trim().min(1),
  receiver: z.nativeEnum(Person),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET() {
  const actorEmail = await getAuthorizedEmail();
  if (!actorEmail) return unauthorizedResponse();

  const earnings = await prisma.earning.findMany({
    where: { deletedAt: null },
    orderBy: { receivedDate: "desc" },
  });

  return NextResponse.json(
    earnings.map((entry) => ({
      id: entry.id,
      category: entry.category,
      source: entry.source,
      receiver: entry.receiver,
      amountCents: entry.amountCents,
      receivedDate: isoDateOrNull(entry.receivedDate)!,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
  );
}

export async function POST(request: Request) {
  try {
    const actorEmail = await getAuthorizedEmail();
    if (!actorEmail) return unauthorizedResponse();

    const parsed = createEarningSchema.safeParse(await request.json());
    if (!parsed.success) return badRequestResponse(parsed.error.issues[0]?.message ?? "Invalid payload.");

    const data = parsed.data;
    const receivedDate = isoDateFromDateInput(data.date);

    const created = await prisma.earning.create({
      data: {
        category: data.category,
        source: data.source,
        receiver: data.receiver,
        amountCents: dollarsToCents(data.amount),
        receivedDate,
        createdByEmail: actorEmail,
        updatedByEmail: actorEmail,
      },
    });

    await logAudit({
      actorEmail,
      entityType: "EARNING",
      entityId: created.id,
      action: "CREATE",
      afterJson: {
        category: created.category,
        source: created.source,
        receiver: created.receiver,
        amountCents: created.amountCents,
        receivedDate,
      },
    });

    return NextResponse.json({
      id: created.id,
      category: created.category,
      source: created.source,
      receiver: created.receiver,
      amountCents: created.amountCents,
      receivedDate: isoDateOrNull(created.receivedDate),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return serverErrorResponse();
  }
}
