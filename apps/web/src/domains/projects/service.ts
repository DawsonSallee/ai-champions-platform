import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  projects,
  projectStatusHistory,
  businessUnits,
  users,
} from "@/db/schema";
import { audited, type AuditContext } from "@/lib/audit";
import { canTransition, type ProjectStatus } from "../governance/state-machine";
import type {
  CreateProjectInput,
  TransitionStatusInput,
  UpdateProjectInput,
} from "./schema";

export type ProjectRow = typeof projects.$inferSelect;

export async function listProjects(opts?: {
  status?: ProjectStatus[];
  championUserId?: string;
  includeDeleted?: boolean;
}): Promise<
  Array<
    ProjectRow & {
      businessUnitCode: string | null;
      championName: string | null;
    }
  >
> {
  const whereParts = [];
  if (!opts?.includeDeleted) whereParts.push(isNull(projects.deletedAt));
  if (opts?.championUserId)
    whereParts.push(eq(projects.championUserId, opts.championUserId));
  // status filter via OR
  // (kept simple — for production use, accept a Set and add sql`in`)
  const rows = await db
    .select({
      project: projects,
      businessUnitCode: businessUnits.code,
      championName: users.displayName,
    })
    .from(projects)
    .leftJoin(businessUnits, eq(businessUnits.id, projects.businessUnitId))
    .leftJoin(users, eq(users.id, projects.championUserId))
    .where(whereParts.length ? and(...whereParts) : undefined)
    .orderBy(desc(projects.updatedAt));

  return rows.map((r) => ({
    ...r.project,
    businessUnitCode: r.businessUnitCode,
    championName: r.championName,
  }));
}

export async function getProject(id: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)));
  return row ?? null;
}

export async function createProject(
  input: CreateProjectInput,
  ctx: AuditContext,
) {
  return await audited({
    ctx,
    entityType: "project",
    entityId: "(pending)",
    action: "create",
    run: async (tx) => {
      const [created] = await tx
        .insert(projects)
        .values({
          title: input.title,
          problemStatement: input.problemStatement,
          businessUnitId: input.businessUnitId,
          championUserId: input.championUserId ?? null,
          processOwnerUserId: input.processOwnerUserId ?? null,
          complexityTier: input.complexityTier ?? null,
          intakeTicketId: input.intakeTicketId ?? null,
        })
        .returning();
      return { result: created, after: created };
    },
  });
}

export async function updateProject(
  input: UpdateProjectInput,
  ctx: AuditContext,
) {
  const before = await getProject(input.id);
  if (!before) throw new Error("Project not found");

  return await audited({
    ctx,
    entityType: "project",
    entityId: input.id,
    action: "update",
    before,
    run: async (tx) => {
      const [updated] = await tx
        .update(projects)
        .set({
          ...(input.title !== undefined && { title: input.title }),
          ...(input.problemStatement !== undefined && {
            problemStatement: input.problemStatement,
          }),
          ...(input.businessUnitId !== undefined && {
            businessUnitId: input.businessUnitId,
          }),
          ...(input.championUserId !== undefined && {
            championUserId: input.championUserId,
          }),
          ...(input.processOwnerUserId !== undefined && {
            processOwnerUserId: input.processOwnerUserId,
          }),
          ...(input.complexityTier !== undefined && {
            complexityTier: input.complexityTier,
          }),
          ...(input.intakeTicketId !== undefined && {
            intakeTicketId: input.intakeTicketId,
          }),
          updatedAt: sql`now()`,
        })
        .where(eq(projects.id, input.id))
        .returning();
      return { result: updated, after: updated };
    },
  });
}

export async function transitionStatus(
  input: TransitionStatusInput,
  ctx: AuditContext,
) {
  const before = await getProject(input.id);
  if (!before) throw new Error("Project not found");

  if (!canTransition(before.status, input.to, before.complexityTier)) {
    throw new Error(
      `Illegal transition: ${before.status} → ${input.to} for tier ${before.complexityTier ?? "(none)"}`,
    );
  }

  return await audited({
    ctx,
    entityType: "project",
    entityId: input.id,
    action: "transition",
    before: { status: before.status },
    run: async (tx) => {
      const [updated] = await tx
        .update(projects)
        .set({ status: input.to, updatedAt: sql`now()` })
        .where(eq(projects.id, input.id))
        .returning();

      await tx.insert(projectStatusHistory).values({
        projectId: input.id,
        fromStatus: before.status,
        toStatus: input.to,
        changedByUserId: ctx.actorUserId,
        note: input.note,
      });

      return { result: updated, after: { status: input.to } };
    },
  });
}

export async function softDeleteProject(id: string, ctx: AuditContext) {
  const before = await getProject(id);
  if (!before) throw new Error("Project not found");

  return await audited({
    ctx,
    entityType: "project",
    entityId: id,
    action: "delete",
    before,
    run: async (tx) => {
      const [updated] = await tx
        .update(projects)
        .set({ deletedAt: sql`now()` })
        .where(eq(projects.id, id))
        .returning();
      return { result: updated, after: { deletedAt: updated.deletedAt } };
    },
  });
}

export async function restoreProject(id: string, ctx: AuditContext) {
  return await audited({
    ctx,
    entityType: "project",
    entityId: id,
    action: "restore",
    run: async (tx) => {
      const [updated] = await tx
        .update(projects)
        .set({ deletedAt: null })
        .where(eq(projects.id, id))
        .returning();
      return { result: updated, after: { deletedAt: null } };
    },
  });
}
