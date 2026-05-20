import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  approvalComments,
  approvals,
  itAssessments,
  projects,
  tierReviewMatrix,
  userReviewerRoles,
  users,
} from "@/db/schema";
import { audited, type AuditContext } from "@/lib/audit";
import { addBusinessDays } from "@/lib/dates";
import type { Tier } from "../projects/schema";

/**
 * Open the IT approval gate.
 *
 * Reads tier_review_matrix → finds required reviewer roles → resolves
 * each role to its active users → opens an Approval row per (project,
 * role) with the SLA computed from the matrix.
 *
 * Idempotent: if approvals already exist for this project they're left
 * alone (caller can reset by deleting first).
 */
export async function openApprovalGate(
  projectId: string,
  tier: Tier,
  ctx: AuditContext,
) {
  return await db.transaction(async (tx) => {
    const matrix = await tx
      .select()
      .from(tierReviewMatrix)
      .where(and(eq(tierReviewMatrix.tier, tier), eq(tierReviewMatrix.required, true)));

    const created: { reviewerRoleCode: string; approvalId: string }[] = [];

    for (const row of matrix) {
      const existing = await tx
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.projectId, projectId),
            eq(approvals.reviewerRoleCode, row.reviewerRoleCode),
            isNull(approvals.decidedAt),
          ),
        );
      if (existing.length > 0) continue;

      const reviewers = await tx
        .select({ userId: userReviewerRoles.userId })
        .from(userReviewerRoles)
        .innerJoin(users, eq(users.id, userReviewerRoles.userId))
        .where(
          and(
            eq(userReviewerRoles.reviewerRoleCode, row.reviewerRoleCode),
            eq(users.active, true),
          ),
        );

      const slaDueAt = addBusinessDays(new Date(), row.slaBusinessDays);

      // Open one Approval per active holder of the role.
      // If no holder exists yet, still create a placeholder so the gate
      // is visible — admins can assign a user later.
      if (reviewers.length === 0) {
        const [a] = await tx
          .insert(approvals)
          .values({
            projectId,
            reviewerRoleCode: row.reviewerRoleCode,
            slaDueAt,
          })
          .returning();
        created.push({
          reviewerRoleCode: row.reviewerRoleCode,
          approvalId: a.id,
        });
      } else {
        for (const r of reviewers) {
          const [a] = await tx
            .insert(approvals)
            .values({
              projectId,
              reviewerUserId: r.userId,
              reviewerRoleCode: row.reviewerRoleCode,
              slaDueAt,
            })
            .returning();
          created.push({
            reviewerRoleCode: row.reviewerRoleCode,
            approvalId: a.id,
          });
        }
      }
    }

    // Move project status forward.
    await tx
      .update(projects)
      .set({ status: "ITApprovalPending", updatedAt: sql`now()` })
      .where(eq(projects.id, projectId));

    return created;
  });
}

export async function listPendingApprovalsFor(userId: string) {
  return await db
    .select({
      approval: approvals,
      project: projects,
    })
    .from(approvals)
    .innerJoin(projects, eq(projects.id, approvals.projectId))
    .where(
      and(
        eq(approvals.reviewerUserId, userId),
        eq(approvals.status, "Pending"),
        isNull(projects.deletedAt),
      ),
    )
    .orderBy(asc(approvals.slaDueAt));
}

export async function listApprovalsForProject(projectId: string) {
  return await db
    .select()
    .from(approvals)
    .where(eq(approvals.projectId, projectId))
    .orderBy(asc(approvals.createdAt));
}

export type ApprovalDecision = "Approved" | "ChangesRequested" | "Rejected";

export async function decideApproval(
  approvalId: string,
  decision: ApprovalDecision,
  comment: string | undefined,
  ctx: AuditContext,
) {
  if (!ctx.actorUserId) throw new Error("Unauthenticated");

  return await audited({
    ctx,
    entityType: "approval",
    entityId: approvalId,
    action: "transition",
    run: async (tx) => {
      const [updated] = await tx
        .update(approvals)
        .set({ status: decision, decidedAt: sql`now()` })
        .where(eq(approvals.id, approvalId))
        .returning();

      if (comment && comment.trim().length > 0) {
        await tx.insert(approvalComments).values({
          approvalId,
          authorUserId: ctx.actorUserId!,
          body: comment.trim(),
        });
      }

      // If every approval for this project is decided and none rejected,
      // advance the project to ITApproved.
      const remaining = await tx
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.projectId, updated.projectId),
            inArray(approvals.status, ["Pending"]),
          ),
        );
      const anyRejected = (
        await tx
          .select()
          .from(approvals)
          .where(
            and(
              eq(approvals.projectId, updated.projectId),
              eq(approvals.status, "Rejected"),
            ),
          )
      ).length;

      if (remaining.length === 0) {
        await tx
          .update(projects)
          .set({
            status: anyRejected ? "Rejected" : "ITApproved",
            updatedAt: sql`now()`,
          })
          .where(eq(projects.id, updated.projectId));
      }

      return { result: updated, after: { status: decision } };
    },
  });
}

export async function upsertItAssessment(args: {
  projectId: string;
  data: Partial<typeof itAssessments.$inferInsert>;
  ctx: AuditContext;
}) {
  const { projectId, data, ctx } = args;
  return await audited({
    ctx,
    entityType: "it_assessment",
    entityId: projectId,
    action: "update",
    run: async (tx) => {
      const [row] = await tx
        .insert(itAssessments)
        .values({ projectId, ...data, submittedAt: sql`now()` })
        .onConflictDoUpdate({
          target: itAssessments.projectId,
          set: { ...data, updatedAt: sql`now()` },
        })
        .returning();
      return { result: row, after: row };
    },
  });
}
