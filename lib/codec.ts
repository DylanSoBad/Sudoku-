/**
 * Blob-layout / codec — <JSON header>\n + 81 puzzle bytes + 81 solution bytes.
 * Each byte is 0..9 (0 = empty).
 */
import type { Difficulty } from "./sudoku";

export interface PuzzleBlob {
  level: number;
  difficulty: Difficulty;
  hintCost: number;
  reward: number;
  puzzle: number[];
  solution: number[];
  ts: number;
  meta?: {
    level: number;
    difficulty: Difficulty;
    empties: number;
    hintCost: number;
    reward: number;
  };
}

const SEP = 0x0a;

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const v = Math.floor(n);
  if (v < 0) return 0;
  if (v > 9) return 9;
  return v;
}

export function encodePuzzleBlob(p: PuzzleBlob): Uint8Array {
  const header = JSON.stringify({
    level: p.level,
    difficulty: p.difficulty,
    hintCost: p.hintCost,
    reward: p.reward,
    ts: p.ts,
  });
  const headerBytes = new TextEncoder().encode(header);
  const cells = new Uint8Array(162);
  for (let i = 0; i < 81; i++) cells[i] = clamp(p.puzzle[i] ?? 0);
  for (let i = 0; i < 81; i++) cells[81 + i] = clamp(p.solution[i] ?? 0);
  const out = new Uint8Array(headerBytes.length + 1 + cells.length);
  out.set(headerBytes, 0);
  out[headerBytes.length] = SEP;
  out.set(cells, headerBytes.length + 1);
  return out;
}

interface BlobHeader {
  level: number;
  difficulty: Difficulty;
  hintCost: number;
  reward: number;
  ts: number;
}

function isBlobHeader(v: unknown): v is BlobHeader {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o["level"] === "number" &&
    typeof o["difficulty"] === "string" &&
    typeof o["hintCost"] === "number" &&
    typeof o["reward"] === "number" &&
    typeof o["ts"] === "number"
  );
}

export function decodePuzzleBlob(buf: Uint8Array): PuzzleBlob {
  let sep = -1;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === SEP) {
      sep = i;
      break;
    }
  }
  if (sep < 0) throw new Error("puzzle blob: missing header separator");
  const headerStr = new TextDecoder().decode(buf.slice(0, sep));
  const parsed: unknown = JSON.parse(headerStr);
  if (!isBlobHeader(parsed)) throw new Error("puzzle blob: header missing fields");
  const body = buf.slice(sep + 1);
  if (body.length < 162) throw new Error("puzzle blob: truncated body");
  const puzzle: number[] = new Array(81);
  const solution: number[] = new Array(81);
  for (let i = 0; i < 81; i++) puzzle[i] = body[i];
  for (let i = 0; i < 81; i++) solution[i] = body[81 + i];
  return {
    level: parsed.level,
    difficulty: parsed.difficulty,
    hintCost: parsed.hintCost,
    reward: parsed.reward,
    ts: parsed.ts,
    puzzle,
    solution,
  };
}

export function parsePuzzleBlobText(body: string): PuzzleBlob {
  return decodePuzzleBlob(new TextEncoder().encode(body));
}
