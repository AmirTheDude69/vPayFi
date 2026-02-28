import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { getAuthorizedEmailFromRequest } from "@/lib/auth-guard";
import { unauthorizedResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { type AuditLogRecord } from "@/lib/types";

const LOGS_FROM_ISO = "2026-02-28T10:24:35.000Z";

function normalizeJsonValue(value: Prisma.JsonValue | null | undefined): Record<string, string | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string | null> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue === null) {
      result[key] = null;
      continue;
    }
    if (typeof fieldValue === "string" || typeof fieldValue === "number" || typeof fieldValue === "boolean") {
      result[key] = String(fieldValue);
      continue;
    }
    try {
      result[key] = JSON.stringify(fieldValue);
    } catch {
      result[key] = String(fieldValue);
    }
  }
  return result;
}

function buildChanges(beforeJson: Prisma.JsonValue | null, afterJson: Prisma.JsonValue | null): AuditLogRecord["changes"] {
  const before = normalizeJsonValue(beforeJson);
  const after = normalizeJsonValue(afterJson);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  const changes: AuditLogRecord["changes"] = [];
  keys.forEach((key) => {
    const prev = before[key] ?? null;
    const next = after[key] ?? null;
    if (prev === next) return;
    changes.push({
      field: key,
      before: prev,
      after: next,
    });
  });
  return changes;
}

export async function GET(request: Request) {
  const actorEmail = await getAuthorizedEmailFromRequest(request);
  if (!actorEmail) return unauthorizedResponse();

  const logs = await prisma.auditLog.findMany({
    where: {
      createdAt: {
        gte: new Date(LOGS_FROM_ISO),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const response: AuditLogRecord[] = logs.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    actorEmail: row.actorEmail,
    entityType: row.entityType,
    action: row.action,
    entityId: row.entityId,
    changes: buildChanges(row.beforeJson as Prisma.JsonValue | null, row.afterJson as Prisma.JsonValue | null),
  }));

  return NextResponse.json(response);
}
