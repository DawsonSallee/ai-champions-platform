"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/action";
import {
  reviseActiveVersion,
  reviseVersion,
  saveRoiCalculation,
  setNextReviewDate,
} from "./service";

const RoiStepInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  roleCode: z.string().min(1),
  freqPerYear: z.coerce.number().nonnegative(),
  baselineHours: z.coerce.number().nonnegative(),
  newHours: z.coerce.number().nonnegative(),
  qualityIncreaseHours: z.coerce.number().nonnegative(),
});

const SaveRoiInput = z.object({
  projectId: z.string().uuid(),
  versionLabel: z.string().min(1).max(64),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nextReviewDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  steps: z.array(RoiStepInputSchema).min(1).max(50),
});

export const saveRoiAction = defineAction(
  SaveRoiInput,
  async ({ input, principal }) => {
    const calc = await saveRoiCalculation(
      { ...input, nextReviewDate: input.nextReviewDate ?? null },
      { actorUserId: principal.userId },
    );
    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath("/dashboard");
    revalidatePath("/backlog");
    return { id: calc.id };
  },
);

const ReviseRoiInput = z.object({
  projectId: z.string().uuid(),
  steps: z.array(RoiStepInputSchema).min(1).max(50),
});

export const reviseRoiAction = defineAction(
  ReviseRoiInput,
  async ({ input, principal }) => {
    const calc = await reviseActiveVersion({
      projectId: input.projectId,
      steps: input.steps,
      ctx: { actorUserId: principal.userId },
    });
    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath("/dashboard");
    revalidatePath("/backlog");
    return { id: calc.id };
  },
);

const ReviseVersionInput = z.object({
  versionId: z.string().uuid(),
  projectId: z.string().uuid(),
  steps: z.array(RoiStepInputSchema).min(1).max(50),
});

/**
 * Edit any ROI version (active or prior). Rates are re-resolved as of
 * the version's own periodStart.
 */
export const reviseVersionAction = defineAction(
  ReviseVersionInput,
  async ({ input, principal }) => {
    const calc = await reviseVersion({
      versionId: input.versionId,
      steps: input.steps,
      ctx: { actorUserId: principal.userId },
    });
    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath("/dashboard");
    revalidatePath("/backlog");
    return { id: calc.id };
  },
);

const ReviewDateInput = z.object({
  projectId: z.string().uuid(),
  nextReviewDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export const setReviewDateAction = defineAction(
  ReviewDateInput,
  async ({ input, principal }) => {
    await setNextReviewDate({
      projectId: input.projectId,
      nextReviewDate: input.nextReviewDate,
      ctx: { actorUserId: principal.userId },
    });
    revalidatePath(`/projects/${input.projectId}`);
    return { ok: true };
  },
);
