import { EarningCategory, Person } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthorizedEmailFromRequest } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { badRequestResponse, isoDateOrNull, serverErrorResponse, unauthorizedResponse } from "@/lib/api-helpers";
import { dollarsToCents, isoDateFromDateInput, isoDateToUtcDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const updatePayoutSchema = z.object({
  category: z.nativeEnum(EarningCategory),
  name: z.string().trim().min(1),
  receiver: z.nativeEnum(Person),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actorEmail = await getAuthorizedEmailFromRequest(request);
    if (!actorEmail) return unauthorizedResponse();

    const { id } = await context.params;
    const parsed = updatePayoutSchema.safeParse(await request.json());
    if (!parsed.success) return badRequestResponse(parsed.error.issues[0]?.message ?? "Invalid payload.");

    const existing = await prisma.payout.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Payout not found." }, { status: 404 });
    }

    const data = parsed.data;
    const paidDate = isoDateToUtcDate(isoDateFromDateInput(data.date));
    const updated = await prisma.payout.update({
      where: { id },
      data: {
        category: data.category,
        name: data.name,
        receiver: data.receiver,
        amountCents: dollarsToCents(data.amount),
        paidDate,
        updatedByEmail: actorEmail,
      },
    });

    await logAudit({
      actorEmail,
      entityType: "PAYOUT",
      entityId: id,
      action: "UPDATE",
      beforeJson: {
        category: existing.category,
        name: existing.name,
        receiver: existing.receiver,
        amountCents: existing.amountCents,
        paidDate: isoDateOrNull(existing.paidDate),
      },
      afterJson: {
        category: updated.category,
        name: updated.name,
        receiver: updated.receiver,
        amountCents: updated.amountCents,
        paidDate: isoDateOrNull(updated.paidDate),
      },
    });

    return NextResponse.json({
      id: updated.id,
      category: updated.category,
      name: updated.name,
      receiver: updated.receiver,
      amountCents: updated.amountCents,
      paidDate: isoDateOrNull(updated.paidDate),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return serverErrorResponse();
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const actorEmail = await getAuthorizedEmailFromRequest(request);
    if (!actorEmail) return unauthorizedResponse();

    const { id } = await context.params;
    const existing = await prisma.payout.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Payout not found." }, { status: 404 });
    }

    const deleted = await prisma.payout.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedByEmail: actorEmail,
      },
    });

    await logAudit({
      actorEmail,
      entityType: "PAYOUT",
      entityId: id,
      action: "SOFT_DELETE",
      beforeJson: {
        category: existing.category,
        name: existing.name,
        receiver: existing.receiver,
        amountCents: existing.amountCents,
        paidDate: isoDateOrNull(existing.paidDate),
      },
      afterJson: {
        deletedAt: deleted.deletedAt?.toISOString() ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return serverErrorResponse();
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actorEmail = await getAuthorizedEmailFromRequest(request);
    if (!actorEmail) return unauthorizedResponse();

    const { id } = await context.params;
    const existing = await prisma.payout.findUnique({ where: { id } });
    if (!existing || !existing.deletedAt) {
      return NextResponse.json({ error: "Archived payout not found." }, { status: 404 });
    }

    const restored = await prisma.payout.update({
      where: { id },
      data: {
        deletedAt: null,
        updatedByEmail: actorEmail,
      },
    });

    await logAudit({
      actorEmail,
      entityType: "PAYOUT",
      entityId: id,
      action: "RESTORE",
      beforeJson: {
        deletedAt: existing.deletedAt.toISOString(),
      },
      afterJson: {
        deletedAt: restored.deletedAt,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return serverErrorResponse();
  }
}
