"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/action";
import {
  restoreProject,
  softDeleteProject,
  transitionStatus,
  updateProject,
} from "./service";
import { ProjectStatusSchema, TierSchema, UpdateProjectInput } from "./schema";

const TransitionInput = z.object({
  id: z.string().uuid(),
  to: ProjectStatusSchema,
  note: z.string().max(2000).optional(),
});

export const transitionStatusAction = defineAction(
  TransitionInput,
  async ({ input, principal }) => {
    const updated = await transitionStatus(input, {
      actorUserId: principal.userId,
    });
    revalidatePath(`/projects/${input.id}`);
    revalidatePath("/backlog");
    revalidatePath("/governance");
    revalidatePath("/dashboard");
    return updated;
  },
);

export const updateProjectAction = defineAction(
  UpdateProjectInput,
  async ({ input, principal }) => {
    const updated = await updateProject(input, { actorUserId: principal.userId });
    revalidatePath(`/projects/${input.id}`);
    revalidatePath("/backlog");
    return updated;
  },
);

const DeleteInput = z.object({ id: z.string().uuid() });

export const softDeleteProjectAction = defineAction(
  DeleteInput,
  async ({ input, principal }) => {
    await softDeleteProject(input.id, { actorUserId: principal.userId });
    revalidatePath("/backlog");
    revalidatePath("/admin/trash");
    return { id: input.id };
  },
);

export const restoreProjectAction = defineAction(
  DeleteInput,
  async ({ input, principal }) => {
    await restoreProject(input.id, { actorUserId: principal.userId });
    revalidatePath("/backlog");
    revalidatePath("/admin/trash");
    return { id: input.id };
  },
);

// Re-export schemas for client form code.
export { ProjectStatusSchema, TierSchema };
