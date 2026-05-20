import { z } from "zod";

export const TierSchema = z.enum(["1A", "1B", "1C", "2", "3"]);
export type Tier = z.infer<typeof TierSchema>;

export const ProjectStatusSchema = z.enum([
  "NewIdea",
  "IntakeSubmitted",
  "UnderReview",
  "ITApprovalPending",
  "ITApproved",
  "InProgress",
  "AITeamReview",
  "Completed",
  "Rejected",
  "Decommissioned",
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const CreateProjectInput = z.object({
  title: z.string().min(3).max(200),
  problemStatement: z.string().max(4000).optional(),
  businessUnitId: z.string().uuid(),
  championUserId: z.string().uuid().nullable().optional(),
  processOwnerUserId: z.string().uuid().nullable().optional(),
  complexityTier: TierSchema.nullable().optional(),
  intakeTicketId: z.string().max(64).optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = CreateProjectInput.partial().extend({
  id: z.string().uuid(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;

export const TransitionStatusInput = z.object({
  id: z.string().uuid(),
  to: ProjectStatusSchema,
  note: z.string().max(2000).optional(),
});
export type TransitionStatusInput = z.infer<typeof TransitionStatusInput>;
