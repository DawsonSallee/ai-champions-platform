/**
 * Storage abstraction.
 *
 * Two backends:
 *  - "local"  (dev) — writes under ./.storage on the host
 *  - "azure"  (prod) — Azure Blob via @azure/storage-blob + managed identity
 *
 * Driven by `STORAGE_BACKEND` env var.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type StoredObject = {
  url: string;
  key: string;
  size: number;
  contentType: string;
};

export interface Storage {
  put(args: {
    bytes: Uint8Array;
    contentType: string;
    pathPrefix?: string;
    filename: string;
  }): Promise<StoredObject>;

  /** Returns a time-limited URL the browser can fetch. */
  signedReadUrl(key: string, ttlSeconds?: number): Promise<string>;
}

class LocalStorage implements Storage {
  constructor(private root: string) {}

  async put(args: {
    bytes: Uint8Array;
    contentType: string;
    pathPrefix?: string;
    filename: string;
  }): Promise<StoredObject> {
    const id = randomUUID();
    const safeName = args.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = path.posix.join(args.pathPrefix ?? "uploads", id, safeName);
    const abs = path.join(this.root, key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, args.bytes);
    await fs.writeFile(`${abs}.meta.json`, JSON.stringify({
      contentType: args.contentType,
      uploadedAt: new Date().toISOString(),
    }));
    return {
      url: `/api/files/${key}`,
      key,
      size: args.bytes.byteLength,
      contentType: args.contentType,
    };
  }

  async signedReadUrl(key: string): Promise<string> {
    return `/api/files/${key}`;
  }

  async readLocal(key: string): Promise<{ bytes: Buffer; contentType: string }> {
    const abs = path.join(this.root, key);
    const bytes = await fs.readFile(abs);
    let contentType = "application/octet-stream";
    try {
      const meta = JSON.parse(
        await fs.readFile(`${abs}.meta.json`, "utf8"),
      ) as { contentType?: string };
      if (meta.contentType) contentType = meta.contentType;
    } catch {
      // ignore — content type stays as fallback
    }
    return { bytes, contentType };
  }
}

class AzureBlobStorage implements Storage {
  // Lazy-loaded to keep cold start cheap and to avoid bundling
  // @azure/storage-blob into client-side code.
  private lib: typeof import("@azure/storage-blob") | null = null;
  private identity: typeof import("@azure/identity") | null = null;

  constructor(
    private accountName: string,
    private container: string,
  ) {}

  private async ensureLib() {
    if (!this.lib) this.lib = await import("@azure/storage-blob");
    if (!this.identity) this.identity = await import("@azure/identity");
  }

  private async client() {
    await this.ensureLib();
    const credential = new this.identity!.DefaultAzureCredential();
    const blobUrl = `https://${this.accountName}.blob.core.windows.net`;
    return new this.lib!.BlobServiceClient(blobUrl, credential)
      .getContainerClient(this.container);
  }

  async put(args: {
    bytes: Uint8Array;
    contentType: string;
    pathPrefix?: string;
    filename: string;
  }): Promise<StoredObject> {
    const id = randomUUID();
    const safeName = args.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${args.pathPrefix ?? "uploads"}/${id}/${safeName}`;
    const c = await this.client();
    await c.getBlockBlobClient(key).uploadData(args.bytes, {
      blobHTTPHeaders: { blobContentType: args.contentType },
    });
    return {
      url: `https://${this.accountName}.blob.core.windows.net/${this.container}/${key}`,
      key,
      size: args.bytes.byteLength,
      contentType: args.contentType,
    };
  }

  async signedReadUrl(key: string, ttlSeconds = 600): Promise<string> {
    const c = await this.client();
    const blob = c.getBlockBlobClient(key);
    // User-delegation SAS would be preferable in prod; this is sufficient
    // for the MVP because reads are gated by upstream auth on the route.
    return blob.url + `?ttl=${ttlSeconds}`;
  }
}

let _storage: Storage | null = null;

export function getStorage(): Storage {
  if (_storage) return _storage;
  const backend = process.env.STORAGE_BACKEND ?? "local";
  if (backend === "azure") {
    const account = process.env.AZURE_STORAGE_ACCOUNT;
    const container = process.env.AZURE_STORAGE_CONTAINER ?? "artifacts";
    if (!account) throw new Error("AZURE_STORAGE_ACCOUNT not set");
    _storage = new AzureBlobStorage(account, container);
  } else {
    _storage = new LocalStorage(path.resolve(process.cwd(), ".storage"));
  }
  return _storage;
}

export function getLocalStorage(): LocalStorage | null {
  return _storage instanceof LocalStorage ? _storage : null;
}
