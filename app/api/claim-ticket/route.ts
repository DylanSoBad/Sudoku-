/**
 * Claim ticket issuer — the off-chain half of `rewards::claim_with_proof`.
 *
 * The puzzle blob is public, so a completed grid cannot be proven on-chain.
 * This route checks the submitted grid against the puzzle the player was
 * served, then signs a single-use ticket `(address, level, expiresAt, nonce)`
 * that `rewards::claim_with_proof` verifies against the Ed25519 public key in
 * `ClaimGuard`. Without a valid ticket the treasury pays nothing.
 *
 * Requires `CLAIM_SIGNER_PRIVATE_KEY` (server-only). Returns 501 when unset so
 * the client can surface a configuration error instead of a silent failure.
 */
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  AccountAddress,
  Ed25519PrivateKey,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import { decodePuzzleBlob, type PuzzleBlob } from "@/lib/codec";
import { fnv1a, generatePuzzle } from "@/lib/sudoku";
import { parseAptosAddress } from "@/lib/server/aptos-address";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOMAIN = new TextEncoder().encode("SUDOKU_CLAIM_V1");
const TICKET_TTL_SECS = 300;
const MAX_LEVEL = 20;
/** Nobody enters ~40 digits by hand faster than this. */
const MIN_SOLVE_MS = 10_000;
const IP_LIMIT = 12;
const ADDR_LIMIT = 6;
const LIMIT_WINDOW_MS = 10 * 60 * 1000;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function blobName(level: number): string {
  return level === 0
    ? `shelby-sudoku-daily-${todayUTC()}`
    : `shelby-sudoku-level-${level}`;
}

function u64le(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, value, true);
  return buf;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  let s = "0x";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

function parseBoard(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== 81) return null;
  const out: number[] = new Array(81);
  for (let i = 0; i < 81; i++) {
    const v = raw[i];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 9) return null;
    out[i] = v;
  }
  return out;
}

/** Every row, column and 3x3 box holds 1–9 exactly once. */
function isSolvedGrid(board: number[]): boolean {
  const groups: number[][] = [];
  for (let r = 0; r < 9; r++) groups.push(board.slice(r * 9, r * 9 + 9));
  for (let c = 0; c < 9; c++) {
    const col: number[] = [];
    for (let r = 0; r < 9; r++) col.push(board[r * 9 + c]);
    groups.push(col);
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box: number[] = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          box.push(board[(br * 3 + r) * 9 + (bc * 3 + c)]);
        }
      }
      groups.push(box);
    }
  }
  return groups.every((g) => new Set(g).size === 9);
}

/** The solved board must keep every given of the puzzle that was served. */
function keepsGivens(puzzle: number[], board: number[]): boolean {
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] !== 0 && puzzle[i] !== board[i]) return false;
  }
  return true;
}

/**
 * Candidate puzzles for a level. The client cascade may land on the curated
 * mirror or the deterministic generator, so accept either — both are checked
 * against the same solved-grid rule.
 */
async function candidates(level: number, origin: string): Promise<number[][]> {
  const out: number[][] = [];
  try {
    const res = await fetch(new URL(`/puzzles/${blobName(level)}`, origin), {
      cache: "no-store",
    });
    if (res.ok) {
      const blob: PuzzleBlob = decodePuzzleBlob(new Uint8Array(await res.arrayBuffer()));
      out.push(blob.puzzle);
    }
  } catch {
    /* mirror is optional — the generator below always yields a candidate */
  }
  const generated = generatePuzzle(level, fnv1a(level + "-" + todayUTC()));
  out.push(generated.puzzle);
  return out;
}

function signer(): Ed25519PrivateKey | null {
  const raw = process.env.CLAIM_SIGNER_PRIVATE_KEY?.trim();
  if (!raw) return null;
  try {
    return new Ed25519PrivateKey(
      PrivateKey.formatPrivateKey(raw, PrivateKeyVariants.Ed25519),
    );
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const key = signer();
  if (!key) {
    return NextResponse.json(
      { error: "claim signer not configured" },
      { status: 501 },
    );
  }

  const ipGate = await rateLimit(clientKey(req, "claim-ticket"), IP_LIMIT, LIMIT_WINDOW_MS);
  if (!ipGate.ok) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: { "retry-after": String(ipGate.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const input = (body ?? {}) as Record<string, unknown>;

  const address = parseAptosAddress(input["address"]);
  if (!address) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const levelRaw = input["level"];
  const level =
    typeof levelRaw === "number" && Number.isInteger(levelRaw) ? levelRaw : -1;
  if (level < 0 || level > MAX_LEVEL) {
    return NextResponse.json({ error: "invalid level" }, { status: 400 });
  }

  const board = parseBoard(input["board"]);
  if (!board) {
    return NextResponse.json({ error: "invalid board" }, { status: 400 });
  }

  const elapsedRaw = input["elapsedMs"];
  const elapsedMs = typeof elapsedRaw === "number" ? elapsedRaw : 0;
  if (!Number.isFinite(elapsedMs) || elapsedMs < MIN_SOLVE_MS) {
    return NextResponse.json({ error: "solve too fast" }, { status: 400 });
  }

  const addrGate = await rateLimit(`addr:${address}`, ADDR_LIMIT, LIMIT_WINDOW_MS);
  if (!addrGate.ok) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: { "retry-after": String(addrGate.retryAfterSec) } },
    );
  }

  if (!isSolvedGrid(board)) {
    return NextResponse.json({ error: "board is not solved" }, { status: 400 });
  }

  const puzzles = await candidates(level, req.url);
  if (!puzzles.some((p) => keepsGivens(p, board))) {
    return NextResponse.json(
      { error: "board does not match this level" },
      { status: 400 },
    );
  }

  const expiresAt = Math.floor(Date.now() / 1000) + TICKET_TTL_SECS;
  // 63-bit nonce keeps it inside u64 for both BCS and JSON round-trips.
  const nonce =
    BigInt(`0x${randomBytes(8).toString("hex")}`) & 0x7fffffffffffffffn;

  const message = concat([
    DOMAIN,
    AccountAddress.from(address).toUint8Array(),
    u64le(BigInt(level)),
    u64le(BigInt(expiresAt)),
    u64le(nonce),
  ]);
  const signature = key.sign(message);

  return NextResponse.json(
    {
      level,
      expiresAt,
      nonce: nonce.toString(),
      signature: toHex(signature.toUint8Array()),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
