/**
 * Audit middleware — wraps every service mutation.
 *
 * Append-only. Every create / update / delete / restore / state transition
 * gets a row in audit_events with before / after JSON.
 *
 * Services NEVER write to audit_events directly; they go through `audited()`.
 */
import { db, type DB } from "@/db/client";
import { auditEvents } from "@/db/schema/audit";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "transition";

export type AuditContext = {
  actorUserId: string | null;
};

export async function recordAudit(args: {
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  tx?: DB;
}): Promise<void> {
  const target = args.tx ?? db;
  await target.insert(auditEvents).values({
    actorUserId: args.actorUserId,
    entityType: args.entityType,
    entityId: args.entityId,
    action: args.action,
    beforeJson: args.before ? JSON.parse(JSON.stringify(args.before)) : null,
    afterJson: args.after ? JSON.parse(JSON.stringify(args.after)) : null,
  });
}

/**
 * Wrap a service mutation so the audit row is written in the same transaction
 * as the change. If the mutation throws, the audit row is rolled back too.
 */
export async function audited<T>(args: {
  ctx: AuditContext;
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  run: (tx: DB) => Promise<{ result: T; after: unknown }>;
}): Promise<T> {
  return await db.transaction(async (tx) => {
    const { result, after } = await args.run(tx as unknown as DB);
    await recordAudit({
      actorUserId: args.ctx.actorUserId,
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      before: args.before,
      after,
      tx: tx as unknown as DB,
    });
    return result;
  });
}
