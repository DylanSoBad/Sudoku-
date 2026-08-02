/**
 * Shelby Protocol browser SDK wrapper (SSR-safe).
 * Falls back to local generation when unavailable.
 */

export interface ShelbyDownloadClient {
  download(args: { account: string; blobName: string }): Promise<Uint8Array>;
}

export interface ShelbyUploadClient extends ShelbyDownloadClient {
  upload(args: { account: string; blobName: string; bytes: Uint8Array }): Promise<void>;
  registerPayload?(args: { account: string; blobName: string; blobBytes: Uint8Array }): Promise<Record<string, unknown>>;
}

export interface ShelbyPutClient {
  putBlob(args: {
    account: string;
    blobName: string;
    bytes: Uint8Array;
  }): Promise<{ txHash: string; merkleRoot: string }>;
}

export interface ShelbySigner {
  address?: string;
  signAndSubmitTransaction?: (payload: unknown) => Promise<{ hash: string }>;
  putBlob?: (args: { account: string; blobName: string; bytes: Uint8Array }) => Promise<{ txHash: string }>;
}

export interface PuzzleSource {
  cache: "cache";
  shelby: "shelby";
  generated: "generated";
}
export type { PuzzleSource as PuzzleSourceTag };

export interface FetchedPuzzle {
  puzzle: number[];
  solution: number[];
  empties: number;
  source: "shelby" | "cache" | "generated";
}

let cachedClient: ShelbyUploadClient | null = null;
let cachedPut: ShelbyPutClient | null = null;

function readApiKey(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SHELBY_API_KEY?.trim();
  if (!raw || raw === "shelby_YOUR_KEY_HERE") return undefined;
  return raw;
}

export async function getBrowserClient(): Promise<ShelbyUploadClient | null> {
  if (typeof window === "undefined") return null;
  if (cachedClient) return cachedClient;
  try {
    const mod = await import("@shelby-protocol/sdk/browser");
    const apiKey = readApiKey();
    const ctor = (mod as Record<string, unknown>)["ShelbyBlobClient"];
    if (typeof ctor !== "function") {
      console.warn("[shelby:fallback]", "ShelbyBlobClient constructor missing");
      return null;
    }
    const Ctor = ctor as new (opts: { apiKey?: string; network: string }) => unknown;
    const raw = new Ctor({ apiKey, network: "shelbynet" }) as Record<string, unknown>;
    const dl = raw["download"] as
      | ((args: { account: string; blobName: string }) => Promise<Uint8Array | ArrayBuffer>)
      | undefined;
    const ul = raw["upload"] as
      | ((args: { account: string; blobName: string; data: Uint8Array }) => Promise<void>)
      | undefined;
    if (typeof dl !== "function" || typeof ul !== "function") {
      console.warn("[shelby:fallback]", "client missing download/upload");
      return null;
    }
    cachedClient = {
      async download(args) {
        const out = await dl(args);
        return out instanceof Uint8Array ? out : new Uint8Array(out);
      },
      async upload(args) {
        await ul({ account: args.account, blobName: args.blobName, data: args.bytes });
      },
    };
    return cachedClient;
  } catch (err) {
    console.warn("[shelby:fallback]", err);
    return null;
  }
}

export async function getShelbyClient(): Promise<ShelbyUploadClient | null> {
  return getBrowserClient();
}

export async function getRegisterClient(): Promise<ShelbyUploadClient | null> {
  return getBrowserClient();
}

export async function getShelbyPutClient(): Promise<ShelbyPutClient | null> {
  if (typeof window === "undefined") return null;
  if (cachedPut) return cachedPut;
  try {
    const mod = await import("@shelby-protocol/sdk/browser");
    const ns = mod as Record<string, unknown>;
    const putBlob =
      (ns["putBlob"] as ((args: {
        account: string;
        blobName: string;
        bytes: Uint8Array;
      }) => Promise<{ txHash: string; merkleRoot: string }>) | undefined) ??
      ((ns["default"] as Record<string, unknown> | undefined)?.["putBlob"] as
        | ((args: {
            account: string;
            blobName: string;
            bytes: Uint8Array;
          }) => Promise<{ txHash: string; merkleRoot: string }>)
        | undefined);
    if (typeof putBlob !== "function") {
      console.warn("[shelby:fallback]", "putBlob not exposed by browser SDK");
      return null;
    }
    cachedPut = {
      async putBlob(args) {
        return putBlob({ account: args.account, blobName: args.blobName, bytes: args.bytes });
      },
    };
    return cachedPut;
  } catch (err) {
    console.warn("[shelby:fallback]", err);
    return null;
  }
}

export async function fetchBlobBytes(args: { account: string; blobName: string }): Promise<Uint8Array | null> {
  const c = await getBrowserClient();
  if (!c) return null;
  try {
    return await c.download(args);
  } catch (err) {
    console.warn("[shelby:fallback]", err);
    return null;
  }
}

export async function uploadRawBlob(args: {
  account: string;
  blobName: string;
  bytes: Uint8Array;
}): Promise<{ blobName: string; txHash: string }> {
  const c = await getBrowserClient();
  if (!c) throw new Error("shelby unavailable");
  await c.upload(args);
  return { blobName: args.blobName, txHash: "local-upload" };
}

export function readLedgerEntry(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem("shelby-sudoku-read-count");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export type ReadLedgerEntry = {
  ts: number;
  at?: number;
  level: number;
  source: "shelby" | "cache" | "generated";
  owner?: string;
  blobName?: string;
  bytes?: number;
};

export function getReadLedger(): ReadLedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("shelby-sudoku-read-log");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ReadLedgerEntry[];
  } catch {
    return [];
  }
}

export function appendReadLedger(entry: ReadLedgerEntry): void {
  if (typeof window === "undefined") return;
  const list = getReadLedger();
  list.push(entry);
  if (list.length > 200) list.splice(0, list.length - 200);
  window.localStorage.setItem("shelby-sudoku-read-log", JSON.stringify(list));
  const next = readLedgerEntry() + 1;
  window.localStorage.setItem("shelby-sudoku-read-count", String(next));
}

export type ShelbyUploadSigner = ShelbySigner;

export function recordRead(level: number, source: "shelby" | "cache" | "generated"): void {
  appendReadLedger({ ts: Date.now(), level, source });
}
