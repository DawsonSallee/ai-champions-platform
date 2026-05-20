import { db } from "@/db/client";
import { artifacts, solutionLinks, uatLogEntries } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { audited, type AuditContext } from "@/lib/audit";

export async function recordUploadedArtifact(args: {
  projectId: string;
  type: "PDD" | "TSS" | "UAT" | "Showcase" | "UsageGuide" | "Misc";
  blobUrl: string;
  ctx: AuditContext;
}) {
  return await audited({
    ctx: args.ctx,
    entityType: "artifact",
    entityId: args.projectId,
    action: "create",
    run: async (tx) => {
      const [row] = await tx
        .insert(artifacts)
        .values({
          projectId: args.projectId,
          type: args.type,
          blobUrl: args.blobUrl,
          uploadedByUserId: args.ctx.actorUserId,
        })
        .returning();
      return { result: row, after: row };
    },
  });
}

export async function softDeleteArtifact(id: string, ctx: AuditContext) {
  return await audited({
    ctx,
    entityType: "artifact",
    entityId: id,
    action: "delete",
    run: async (tx) => {
      const [row] = await tx
        .update(artifacts)
        .set({ deletedAt: sql`now()` })
        .where(eq(artifacts.id, id))
        .returning();
      return { result: row, after: { deletedAt: row.deletedAt } };
    },
  });
}

export async function listProjectArtifacts(projectId: string) {
  return await db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.projectId, projectId), isNull(artifacts.deletedAt)));
}

export async function addSolutionLink(args: {
  projectId: string;
  linkType:
    | "github_repo"
    | "low_code_portal"
    | "bi_dashboard"
    | "blob_file"
    | "other";
  url: string;
  label?: string;
  ctx: AuditContext;
}) {
  return await audited({
    ctx: args.ctx,
    entityType: "solution_link",
    entityId: args.projectId,
    action: "create",
    run: async (tx) => {
      const [row] = await tx
        .insert(solutionLinks)
        .values({
          projectId: args.projectId,
          linkType: args.linkType,
          url: args.url,
          label: args.label,
        })
        .returning();
      return { result: row, after: row };
    },
  });
}

export async function addUatEntry(args: {
  projectId: string;
  testCaseId: string;
  phase: "InternalQA" | "BusinessUAT";
  scenario: string;
  dataUsed?: string;
  expected: string;
  actual?: string;
  result?: "Pass" | "Fail" | "Blocked";
  ctx: AuditContext;
}) {
  return await audited({
    ctx: args.ctx,
    entityType: "uat_entry",
    entityId: args.projectId,
    action: "create",
    run: async (tx) => {
      const [row] = await tx
        .insert(uatLogEntries)
        .values({
          projectId: args.projectId,
          testCaseId: args.testCaseId,
          phase: args.phase,
          scenario: args.scenario,
          dataUsed: args.dataUsed,
          expected: args.expected,
          actual: args.actual,
          result: args.result,
          testedByUserId: args.ctx.actorUserId,
          testedAt: new Date().toISOString().slice(0, 10),
        })
        .returning();
      return { result: row, after: row };
    },
  });
}
