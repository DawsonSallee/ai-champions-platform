"use server";

import { z } from "zod";
import { db } from "@/db/client";
import { businessUnits } from "@/db/schema";
import { eq } from "drizzle-orm";
import { defineAction } from "@/lib/action";
import { createProject, transitionStatus } from "@/domains/projects/service";
import { openApprovalGate } from "@/domains/governance/service";
import { assignTier, type IntakeAnswers } from "./wizard";
import { revalidatePath } from "next/cache";

const IntakeAnswersSchema = z.object({
  customizesBehavior: z.boolean(),
  hasRestrictedData: z.boolean(),
  hasErpWriteAccess: z.boolean(),
  touchesHrSystem: z.boolean(),
  trainsCustomAiModel: z.boolean(),
  companyWideRollout: z.boolean(),
  touchesNonM365: z.boolean(),
  usesPremiumPlatformFeatures: z.boolean(),
});

const SubmitIntakeInput = z.object({
  title: z.string().min(3).max(200),
  problemStatement: z.string().min(0).max(4000),
  businessUnitCode: z.string().min(1),
  answers: IntakeAnswersSchema,
});

export const submitIntakeAction = defineAction(
  SubmitIntakeInput,
  async ({ input, principal }) => {
    const decision = assignTier(input.answers as IntakeAnswers);

    const [bu] = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.code, input.businessUnitCode))
      .limit(1);
    if (!bu) throw new Error(`Unknown business unit: ${input.businessUnitCode}`);

    const created = await createProject(
      {
        title: input.title,
        problemStatement: input.problemStatement,
        businessUnitId: bu.id,
        championUserId: principal.userId.startsWith("dev-") ? null : principal.userId,
        complexityTier: decision.tier,
      },
      { actorUserId: principal.userId.startsWith("dev-") ? null : principal.userId },
    );

    // Route based on tier:
    //   1A → straight to InProgress (no governance gate)
    //   1B → IntakeSubmitted; champion builds first, AI team reviews after
    //   1C/2/3 → IntakeSubmitted, then immediately open the approval gate
    const ctx = {
      actorUserId: principal.userId.startsWith("dev-") ? null : principal.userId,
    };

    if (decision.tier === "1A") {
      await transitionStatus(
        { id: created.id, to: "InProgress", note: "Tier 1A self-service" },
        ctx,
      );
    } else {
      await transitionStatus(
        {
          id: created.id,
          to: "IntakeSubmitted",
          note: `Auto-assigned ${decision.tier}: ${decision.rationale}`,
        },
        ctx,
      );
      if (["1C", "2", "3"].includes(decision.tier)) {
        await openApprovalGate(created.id, decision.tier, ctx);
      }
    }

    revalidatePath("/backlog");
    revalidatePath("/governance");
    revalidatePath("/dashboard");
    return { projectId: created.id, tier: decision.tier };
  },
);
