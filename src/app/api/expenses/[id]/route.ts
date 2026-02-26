import { Person } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthorizedEmail } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { badRequestResponse, isoDateOrNull, serverErrorResponse, unauthorizedResponse } from "@/lib/api-helpers";
import { dollarsToCents, isoDateFromDateInput, isoDateToUtcDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const updateExpenseSchema = z.object({
  name: z.string().trim().min(1),
  spender: z.nativeEnum(Person),
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
    const parsed = updateExpenseSchema.safeParse(await request.json());
    if (!parsed.success) return badRequestResponse(parsed.error.issues[0]?.message ?? "Invalid payload.");

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    }

    const data = parsed.data;
    const spentDate = isoDateToUtcDate(isoDateFromDateInput(data.date));
    const updated = await prisma.expense.update({
      where: { id },
      data: {
        name: data.name,
        spender: data.spender,
        amountCents: dollarsToCents(data.amount),
        spentDate,
        updatedByEmail: actorEmail,
      },
    });

    await logAudit({
      actorEmail,
      entityType: "EXPENSE",
      entityId: id,
      action: "UPDATE",
      beforeJson: {
        name: existing.name,
        spender: existing.spender,
        amountCents: existing.amountCents,
        spentDate: isoDateOrNull(existing.spentDate),
      },
      afterJson: {
        name: updated.name,
        spender: updated.spender,
        amountCents: updated.amountCents,
        spentDate: isoDateOrNull(updated.spentDate),
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      spender: updated.spender,
      amountCents: updated.amountCents,
      spentDate: isoDateOrNull(updated.spentDate),
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
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    }

    const deleted = await prisma.expense.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedByEmail: actorEmail,
      },
    });

    await logAudit({
      actorEmail,
      entityType: "EXPENSE",
      entityId: id,
      action: "SOFT_DELETE",
      beforeJson: {
        name: existing.name,
        spender: existing.spender,
        amountCents: existing.amountCents,
        spentDate: isoDateOrNull(existing.spentDate),
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
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || !existing.deletedAt) {
      return NextResponse.json({ error: "Archived expense not found." }, { status: 404 });
    }

    const restored = await prisma.expense.update({
      where: { id },
      data: {
        deletedAt: null,
        updatedByEmail: actorEmail,
      },
    });

    await logAudit({
      actorEmail,
      entityType: "EXPENSE",
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
