# artifacts — CLAUDE.md

File uploads, solution links, UAT log entries, and the showcase PDF.

## Storage abstraction

`lib/storage.ts` picks `local` or `azure` from `STORAGE_BACKEND`. All
domain code talks to the `Storage` interface — never directly to Blob
or `fs`.

## Upload flow

1. Client base64-encodes the file in `ArtifactUpload.tsx`.
2. Server action validates with Zod, decodes, calls `Storage.put`.
3. Service writes an `artifacts` row in an audited transaction.

The local backend serves files at `/api/files/[...key]`. The Azure
backend returns blob URLs the browser fetches directly (subject to SAS
or upstream auth).

## PDF showcase

`pdf.tsx` renders a one-pager from project + latest ROI. Pure render —
the data load lives in the route handler. Change the PDF? Edit `pdf.tsx`
and refresh; no schema change required.
