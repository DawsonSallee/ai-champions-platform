"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadArtifactAction } from "@/domains/artifacts/actions";

const TYPES = ["PDD", "TSS", "UAT", "Showcase", "UsageGuide", "Misc"] as const;

export function ArtifactUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<(typeof TYPES)[number]>("PDD");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const buf = await file.arrayBuffer();
      const dataBase64 = arrayBufferToBase64(buf);
      const res = await uploadArtifactAction({
        projectId,
        type,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        dataBase64,
      });
      if (!res.ok) setError(res.error);
      else {
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    });
  }

  return (
    <div className="card p-4 space-y-3 text-sm">
      <h3 className="section-title">Upload artifact</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select
          className="input"
          value={type}
          onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input ref={fileRef} type="file" className="md:col-span-2" />
      </div>
      {error && <div className="text-red-600">{error}</div>}
      <button onClick={submit} disabled={pending} className="btn-primary">
        {pending ? "Uploading…" : "Upload"}
      </button>
    </div>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
