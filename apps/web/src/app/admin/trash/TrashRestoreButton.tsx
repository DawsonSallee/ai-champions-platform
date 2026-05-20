"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreProjectAction } from "@/domains/projects/actions";

export function TrashRestoreButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn"
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
