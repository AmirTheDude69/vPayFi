import { EarningCategory, Person } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthorizedEmail } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { badRequestResponse, isoDateOrNull, serverErrorResponse, unauthorizedResponse } from "@/lib/api-helpers";
import { dollarsToCents, isoDateFromDateInput, isoDateToUtcDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const updateEarningSchema = z.object({
  category: z.nativeEnum(EarningCategory),
  source: z.string().trim().min(1),
  receiver: z.nativeEnum(Person),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actorEmail = await getAuthorizedEmail();
    if (!actorEmail) return unauthorizedResponse();

    const { id } = await context.params;
    const parsed = updateEarningSchema.safeParse(await request.json());
    if (!parsed.success) return badRequestResponse(parsed.error.issues[0]?.message ?? "Invalid payload.");

    const existing = await prisma.earning.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Earning not found." }, { status: 404 });
    }

    const data = parsed.data;
    const receivedDate = isoDateToUtcDate(isoDateFromDateInput(data.date));
    const updated = await prisma.earning.update({
      where: { id },
      data: {
        category: data.category,
        source: data.source,
        receiver: data.receiver,
        amountCents: dollarsToCents(data.amount),
        receivedDate,
        updatedByEmail: actorEmail,
      },
    });

    await logAudit({
      actorEmail,
      entityType: "EARNING",
      entityId: id,
      action: "UPDATE",
      beforeJson: {
        category: existing.category,
        source: existing.source,
        receiver: existing.receiver,
        amountCents: existing.amountCents,
        receivedDate: isoDateOrNull(existing.receivedDate),
      },
      afterJson: {
        category: updated.category,
        source: updated.source,
        receiver: updated.receiver,
        amountCents: updated.amountCents,
        receivedDate: isoDateOrNull(updated.receivedDate),
      },
    });

    return NextResponse.json({
      id: updated.id,
      category: updated.category,
      source: updated.source,
      receiver: updated.receiver,
      amountCents: updated.amountCents,
      receivedDate: isoDateOrNull(updated.receivedDate),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return serverErrorResponse();
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actorEmail = await getAuthorizedEmail();
    if (!actorEmail) return unauthorizedResponse();

    const { id } = await context.params;
    const existing = await prisma.earning.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Earning not found." }, { status: 404 });
    }

    const deleted = await prisma.earning.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedByEmail: actorEmail,
      },
    });

    await logAudit({
      actorEmail,
      entityType: "EARNING",
      entityId: id,
      action: "SOFT_DELETE",
      beforeJson: {
        category: existing.category,
        source: existing.source,
        receiver: existing.receiver,
        amountCents: existing.amountCents,
        receivedDate: isoDateOrNull(existing.receivedDate),
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

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actorEmail = await getAuthorizedEmail();
    if (!actorEmail) return unauthorizedResponse();

    const { id } = await context.params;
    const existing = await prisma.earning.findUnique({ where: { id } });
    if (!existing || !existing.deletedAt) {
      return NextResponse.json({ error: "Archived earning not found." }, { status: 404 });
    }

    const restored = await prisma.earning.update({
      where: { id },
      data: {
        deletedAt: null,
        updatedByEmail: actorEmail,
      },
    });

    await logAudit({
      actorEmail,
      entityType: "EARNING",
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
