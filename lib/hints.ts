/**
 * Per-level hint counters.
 *
 * On-chain, `hint_shop` keys the count by (player, level) and rejects the
 * purchase once it reaches `MAX_HINTS_PER_LEVEL`. When the registry is not
 * configured the same cap is enforced locally so the local-fallback path
 * cannot hand out unlimited hints.
 */
import { getAptosClient } from "./aptos";
import { MAX_HINTS_PER_LEVEL } from "./tokenomics";

const KEY_PREFIX = "shelby-sudoku-hints:";

type HintCounts = Record<string, number>;

function storageKey(address: string): string {
  return `${KEY_PREFIX}${address}`;
}

function readAll(address: string): HintCounts {
  if (typeof window === "undefined" || !address) return {};
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: HintCounts = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        out[k] = Math.floor(v);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(address: string, counts: HintCounts): void {
  if (typeof window === "undefined" || !address) return;
  try {
    window.localStorage.setItem(storageKey(address), JSON.stringify(counts));
  } catch {
    /* quota */
  }
}

/** Locally recorded hint count for (address, level). */
export function getLocalHintsUsed(address: string, level: number): number {
  return readAll(address)[String(level)] ?? 0;
}

/** Increment and persist the local counter, returning the new value. */
export function bumpLocalHintsUsed(address: string, level: number): number {
  const counts = readAll(address);
  const key = String(level);
  const next = (counts[key] ?? 0) + 1;
  counts[key] = next;
  writeAll(address, counts);
  return next;
}

export function hintLimitReached(used: number): boolean {
  return used >= MAX_HINTS_PER_LEVEL;
}

/**
 * Read the authoritative on-chain counter. Returns null when the view cannot
 * be reached (package not published yet, RPC error), so callers can decide
 * whether to fall back to the local counter.
 */
export async function fetchOnChainHintsUsed(
  registry: string,
  address: string,
  level: number,
): Promise<number | null> {
  if (!registry || !address) return null;
  try {
    const client = getAptosClient();
    const out = (await client.view({
      payload: {
        function: `${registry}::hint_shop::hints_used`,
        typeArguments: [],
        functionArguments: [address, level],
      },
    })) as unknown;
    const raw = Array.isArray(out) ? Number(out[0] ?? 0) : 0;
    return Number.isFinite(raw) ? raw : null;
  } catch (err) {
    console.warn("[fetchOnChainHintsUsed]", err);
    return null;
  }
}
