/**
 * Shelby Protocol browser SDK wrapper (SSR-safe).
 * Falls back to local generation when unavailable.
 */

import { Network } from "@aptos-labs/ts-sdk";

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

/**
 * Where a puzzle actually came from. `shelby` means the bytes were served by
 * Shelby; `mirror` is the same curated blob replayed from `public/puzzles`,
 * kept distinct so the read ledger cannot overstate Shelby usage.
 */
export type PuzzleSourceName = "shelby" | "mirror" | "cache" | "generated";

export interface FetchedPuzzle {
  puzzle: number[];
  solution: number[];
  empties: number;
  source: PuzzleSourceName;
}

import {
  SHELBY_DEPLOYER,
  SHELBY_INDEXER_URL as SHELBY_INDEXER,
  SHELBY_RPC_URL as SHELBY_RPC,
  readShelbyBlob,
} from "./shelby-blob";

let cachedClient: ShelbyUploadClient | null = null;
let cachedPut: ShelbyPutClient | null = null;

function readApiKey(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SHELBY_API_KEY?.trim();
  if (!raw || raw === "shelby_YOUR_KEY_HERE") return undefined;
  return raw;
}

function shelbyNetwork(): Network {
  const n = Network as unknown as Record<string, Network>;
  return n.SHELBYNET ?? Network.TESTNET;
}

async function createRawShelbyClient(): Promise<{
  download: (args: { account: string; blobName: string }) => Promise<Uint8Array>;
  putBlob: (args: { account: string; blobName: string; bytes: Uint8Array }) => Promise<void>;
} | null> {
  try {
    const mod = (await import("@shelby-protocol/sdk/browser")) as unknown as {
      ShelbyClient?: new (opts: Record<string, unknown>) => unknown;
      ShelbyBlobClient?: new (opts: Record<string, unknown>) => unknown;
    };
    const apiKey = readApiKey();
    const Client = mod.ShelbyClient ?? mod.ShelbyBlobClient;
    if (typeof Client !== "function") {
      console.warn("[shelby:fallback]", "ShelbyClient constructor missing");
      return null;
    }
    const raw = new Client({
      network: shelbyNetwork(),
      apiKey,
      // The SDK's built-in deployer default has lagged behind shelbynet
      // redeployments, which surfaces as "Module not found … blob_metadata".
      deployer: SHELBY_DEPLOYER,
      rpc: { baseUrl: SHELBY_RPC, apiKey },
      indexer: { baseUrl: SHELBY_INDEXER, apiKey },
    }) as {
      download?: (args: { account: string; blobName: string }) => Promise<unknown>;
      rpc?: {
        putBlob?: (args: {
          account: string;
          blobName: string;
          blobData: Uint8Array;
        }) => Promise<unknown>;
      };
      upload?: (args: Record<string, unknown>) => Promise<void>;
    };

    return {
      async download(args) {
        if (typeof raw.download !== "function") {
          throw new Error("shelby download unavailable");
        }
        const bytes = await readShelbyBlob(await raw.download(args));
        if (!bytes) throw new Error("shelby download returned unexpected shape");
        return bytes;
      },
      async putBlob(args) {
        if (typeof raw.rpc?.putBlob === "function") {
          await raw.rpc.putBlob({
            account: args.account,
            blobName: args.blobName,
            blobData: args.bytes,
          });
          return;
        }
        // Last resort: some SDK builds expose a top-level upload that still
        // expects a signer Account — curator flows should prefer putBlob.
        if (typeof raw.upload === "function") {
          await raw.upload({
            account: args.account,
            blobName: args.blobName,
            data: args.bytes,
            blobData: args.bytes,
          });
          return;
        }
        throw new Error("shelby putBlob unavailable");
      },
    };
  } catch (err) {
    console.warn("[shelby:fallback]", err);
    return null;
  }
}

export async function getBrowserClient(): Promise<ShelbyUploadClient | null> {
  if (typeof window === "undefined") return null;
  if (cachedClient) return cachedClient;
  const raw = await createRawShelbyClient();
  if (!raw) return null;
  cachedClient = {
    download: raw.download,
    async upload(args) {
      await raw.putBlob(args);
    },
  };
  return cachedClient;
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
  const raw = await createRawShelbyClient();
  if (!raw) return null;
  cachedPut = {
    async putBlob(args) {
      await raw.putBlob(args);
      return { txHash: "rpc-put", merkleRoot: "" };
    },
  };
  return cachedPut;
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
  source: PuzzleSourceName;
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

export function recordRead(level: number, source: PuzzleSourceName): void {
  appendReadLedger({ ts: Date.now(), level, source });
}
