/**
 * Serves files stored on the local-filesystem backend.
 * The Azure backend returns blob URLs directly — this route only fires
 * when STORAGE_BACKEND=local.
 */
import { NextResponse } from "next/server";
import { getLocalStorage, getStorage } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  // Make sure storage is initialized
  getStorage();
  const local = getLocalStorage();
  if (!local) {
    return NextResponse.json(
      { error: "Local storage not active" },
      { status: 404 },
    );
  }
  const { key } = await params;
  const joined = key.join("/");
  try {
    const { bytes, contentType } = await local.readLocal(joined);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
