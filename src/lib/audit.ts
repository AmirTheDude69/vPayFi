import { type AuditAction, type AuditEntityType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

interface LogAuditInput {
  actorEmail: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  beforeJson?: unknown;
  afterJson?: unknown;
}

export async function logAudit(input: LogAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorEmail: input.actorEmail,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      beforeJson: input.beforeJson as object | undefined,
      afterJson: input.afterJson as object | undefined,
    },
  });
}
