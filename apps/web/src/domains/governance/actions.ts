"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/action";
import {
  decideApproval,
  upsertItAssessment,
  type ApprovalDecision,
} from "./service";
import { db } from "@/db/client";
import {
  reviewerRoles,
  tierReviewMatrix,
  userReviewerRoles,
  users,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";

const DecideInput = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(["Approved", "ChangesRequested", "Rejected"]),
  comment: z.string().max(4000).optional(),
});

export const decideApprovalAction = defineAction(
  DecideInput,
  async ({ input, principal }) => {
    const result = await decideApproval(
      input.approvalId,
      input.decision as ApprovalDecision,
      input.comment,
      { actorUserId: principal.userId },
    );
    revalidatePath(`/projects/${result.projectId}`);
    revalidatePath("/governance");
    revalidatePath("/dashboard");
    return { projectId: result.projectId };
  },
);

const ItAssessmentInput = z.object({
  projectId: z.string().uuid(),
  dataClassification: z
    .enum(["Public", "Internal", "Confidential", "Restricted"])
    .optional(),
  dataFlowFrom: z.string().max(500).optional(),
  dataFlowTo: z.string().max(500).optional(),
  recordsPerDay: z.coerce.number().int().nonnegative().optional(),
  toolingType: z.string().max(200).optional(),
  hostingLocation: z.string().max(200).optional(),
  authMethod: z.string().max(200).optional(),
  llmSource: z.string().max(200).optional(),
  llmTrainingRisk: z.boolean().optional(),
  businessImpact: z.enum(["Low", "Medium", "High"]).optional(),
  manualWorkaround: z.string().max(4000).optional(),
});

export const submitItAssessmentAction = defineAction(
  ItAssessmentInput,
  async ({ input, principal }) => {
    const { projectId, ...rest } = input;
    await upsertItAssessment({
      projectId,
      data: { ...rest, submittedByUserId: principal.userId },
      ctx: { actorUserId: principal.userId },
    });
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  },
);

const MatrixUpsertInput = z.object({
  tier: z.enum(["1A", "1B", "1C", "2", "3"]),
  reviewerRoleCode: z.string().min(1),
  required: z.boolean(),
  slaBusinessDays: z.coerce.number().int().min(1).max(60),
});

export const upsertTierMatrixRowAction = defineAction(
  MatrixUpsertInput,
  async ({ input }) => {
    await db
      .insert(tierReviewMatrix)
      .values(input)
      .onConflictDoUpdate({
        target: [tierReviewMatrix.tier, tierReviewMatrix.reviewerRoleCode],
        set: {
          required: input.required,
          slaBusinessDays: input.slaBusinessDays,
        },
      });
    revalidatePath("/admin");
    return { ok: true };
  },
);

const MatrixDeleteInput = z.object({
  tier: z.enum(["1A", "1B", "1C", "2", "3"]),
  reviewerRoleCode: z.string().min(1),
});

export const deleteTierMatrixRowAction = defineAction(
  MatrixDeleteInput,
  async ({ input }) => {
    await db
      .delete(tierReviewMatrix)
      .where(
        and(
          eq(tierReviewMatrix.tier, input.tier),
          eq(tierReviewMatrix.reviewerRoleCode, input.reviewerRoleCode),
        ),
      );
    revalidatePath("/admin");
    return { ok: true };
  },
);

const ReviewerHolderInput = z.object({
  email: z.string().email(),
  reviewerRoleCode: z.string().min(1),
});

export const assignReviewerRoleAction = defineAction(
  ReviewerHolderInput,
  async ({ input }) => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (!user) throw new Error(`No user with email ${input.email}`);
    const [role] = await db
      .select()
      .from(reviewerRoles)
      .where(eq(reviewerRoles.code, input.reviewerRoleCode))
      .limit(1);
    if (!role) throw new Error(`No reviewer role ${input.reviewerRoleCode}`);
    await db
      .insert(userReviewerRoles)
      .values({ userId: user.id, reviewerRoleCode: input.reviewerRoleCode })
      .onConflictDoNothing();
    revalidatePath("/admin");
    return { ok: true };
  },
);
