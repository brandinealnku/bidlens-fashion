import { db } from '@/lib/db/client';
export async function audit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await db.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      metadata: JSON.stringify(metadata),
    },
  });
}
