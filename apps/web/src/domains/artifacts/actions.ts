"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/action";
import { getStorage } from "@/lib/storage";
import {
  addSolutionLink,
  addUatEntry,
  recordUploadedArtifact,
  softDeleteArtifact,
} from "./service";

const UploadInput = z.object({
  projectId: z.string().uuid(),
  type: z.enum(["PDD", "TSS", "UAT", "Showcase", "UsageGuide", "Misc"]),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(200),
  dataBase64: z.string().min(1),
});

export const uploadArtifactAction = defineAction(
  UploadInput,
  async ({ input, principal }) => {
    const bytes = Uint8Array.from(Buffer.from(input.dataBase64, "base64"));
    const storage = getStorage();
    const stored = await storage.put({
      bytes,
      contentType: input.contentType,
      filename: input.filename,
      pathPrefix: `projects/${input.projectId}`,
    });
    await recordUploadedArtifact({
      projectId: input.projectId,
      type: input.type,
      blobUrl: stored.url,
      ctx: { actorUserId: principal.userId },
    });
    revalidatePath(`/projects/${input.projectId}`);
    return { url: stored.url };
  },
);

export const deleteArtifactAction = defineAction(
  z.object({ id: z.string().uuid(), projectId: z.string().uuid() }),
  async ({ input, principal }) => {
    await softDeleteArtifact(input.id, { actorUserId: principal.userId });
    revalidatePath(`/projects/${input.projectId}`);
    return { ok: true };
  },
);

const SolutionLinkInput = z.object({
  projectId: z.string().uuid(),
  linkType: z.enum([
    "github_repo",
    "low_code_portal",
    "bi_dashboard",
    "blob_file",
    "other",
  ]),
  url: z.string().url(),
  label: z.string().max(200).optional(),
});

export const addSolutionLinkAction = defineAction(
  SolutionLinkInput,
  async ({ input, principal }) => {
    await addSolutionLink({ ...input, ctx: { actorUserId: principal.userId } });
    revalidatePath(`/projects/${input.projectId}`);
    return { ok: true };
  },
);

const UatInput = z.object({
  projectId: z.string().uuid(),
  testCaseId: z.string().min(1).max(64),
  phase: z.enum(["InternalQA", "BusinessUAT"]),
  scenario: z.string().min(1).max(500),
  dataUsed: z.string().max(500).optional(),
  expected: z.string().min(1).max(1000),
  actual: z.string().max(1000).optional(),
  result: z.enum(["Pass", "Fail", "Blocked"]).optional(),
});

export const addUatEntryAction = defineAction(
  UatInput,
  async ({ input, principal }) => {
    await addUatEntry({ ...input, ctx: { actorUserId: principal.userId } });
    revalidatePath(`/projects/${input.projectId}`);
    return { ok: true };
  },
);
