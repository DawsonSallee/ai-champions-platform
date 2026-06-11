"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreProjectAction } from "@/domains/projects/actions";

export function TrashRestoreButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="v3-btn-outline v3-btn-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await restoreProjectAction({ id });
          router.refresh();
        })
      }
    >
      {pending ? "Restoring…" : "Restore"}
    </button>
  );
}
