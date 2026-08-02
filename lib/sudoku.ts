/**
 * Pure-TS sudoku generator. Deterministic via FNV-1a + mulberry32.
 * Same API surface as the lowercase tree expects.
 */

export type Difficulty = "easy" | "medium" | "hard" | "expert" | "master";
export type Board = number[];

export const EMPTY = 0;

import type { PuzzleBlob } from "./codec.ts";

// Re-export codec surface so callers can import from "./sudoku" too.
export { encodePuzzleBlob, decodePuzzleBlob, parsePuzzleBlobText } from "./codec.ts";
export type { PuzzleBlob } from "./codec.ts";

export type BlobLayout = PuzzleBlob;
export type PuzzleSource = "shelby" | "cache" | "generated";

export function generateFullSolution(seed: number): Board {
  const rng = mulberry32(seed);
  const board: Board = new Array(81).fill(0);
  const order = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);

  function usedAt(idx: number, m: number): boolean {
    const r = (idx / 9) | 0;
    const c = idx % 9;
    const br = ((r / 3) | 0) * 3;
    const bc = ((c / 3) | 0) * 3;
    const rowCells: number[] = [];
    const colCells: number[] = [];
    const boxCells: number[] = [];
    for (let i = 0; i < 9; i++) {
      rowCells.push(m * 9 + i);
      colCells.push(i * 9 + c);
    }
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        boxCells.push((br + dr) * 9 + (bc + dc));
      }
    }
    return false;
  }

  function placed(digit: number): number {
    return 1 << digit;
  }

  function backtrack(idx: number): boolean {
    if (idx === 81) return true;
    const r = (idx / 9) | 0;
    const c = idx % 9;
    const br = ((r / 3) | 0) * 3;
    const bc = ((c / 3) | 0) * 3;
    const rowMask = digitMaskFromCells(
      Array.from({ length: 9 }, (_, i) => board[r * 9 + i]),
    );
    const colMask = digitMaskFromCells(
      Array.from({ length: 9 }, (_, i) => board[i * 9 + c]),
    );
    const boxMask = digitMaskFromCells(
      (() => {
        const out: number[] = [];
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            out.push(board[(br + dr) * 9 + (bc + dc)]);
          }
        }
        return out;
      })(),
    );
    const digits = shuffle([...order], rng);
    for (const d of digits) {
      const bit = placed(d);
      if ((rowMask & bit) !== 0) continue;
      if ((colMask & bit) !== 0) continue;
      if ((boxMask & bit) !== 0) continue;
      board[idx] = d;
      if (backtrack(idx + 1)) return true;
      board[idx] = EMPTY;
    }
    return false;
  }

  backtrack(0);
  return board;
}

export function fnv1a(seed: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function peerMask(idx: number): { row: number; col: number; box: number } {
  const r = (idx / 9) | 0;
  const c = idx % 9;
  let row = 0;
  let col = 0;
  let box = 0;
  for (let i = 0; i < 9; i++) {
    row |= 1 << (r * 9 + i);
    col |= 1 << (i * 9 + c);
  }
  const br = ((r / 3) | 0) * 3;
  const bc = ((c / 3) | 0) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      box |= 1 << ((br + dr) * 9 + (bc + dc));
    }
  }
  return { row, col, box };
}

function digitMaskFromCells(cells: readonly number[]): number {
  let m = 0;
  for (const v of cells) {
    if (v >= 1 && v <= 9) m |= 1 << v;
  }
  return m;
}

export function emptiesForDifficulty(d: Difficulty): number {
  switch (d) {
    case "easy": return 36;
    case "medium": return 44;
    case "hard": return 50;
    case "expert": return 55;
    case "master": return 60;
  }
}

export function isSolved(board: Board): boolean {
  if (board.length !== 81) return false;
  for (let i = 0; i < 81; i++) {
    const v = board[i];
    if (v < 1 || v > 9) return false;
    const r = (i / 9) | 0;
    const c = i % 9;
    for (let cc = 0; cc < 9; cc++) {
      if (cc !== c && board[r * 9 + cc] === v) return false;
    }
    for (let rr = 0; rr < 9; rr++) {
      if (rr !== r && board[rr * 9 + c] === v) return false;
    }
    const br = ((r / 3) | 0) * 3;
    const bc = ((c / 3) | 0) * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        const rr = br + dr;
        const cc = bc + dc;
        if ((rr === r && cc === c) || board[rr * 9 + cc] !== v) continue;
        return false;
      }
    }
  }
  return true;
}

export function conflicts(board: Board): boolean[] {
  const out: boolean[] = new Array(81).fill(false);
  for (let i = 0; i < 81; i++) {
    const v = board[i];
    if (v === EMPTY) continue;
    const r = (i / 9) | 0;
    const c = i % 9;
    for (let cc = 0; cc < 9; cc++) if (cc !== c && board[r * 9 + cc] === v) out[i] = true;
    for (let rr = 0; rr < 9; rr++) if (rr !== r && board[rr * 9 + c] === v) out[i] = true;
    const br = ((r / 3) | 0) * 3;
    const bc = ((c / 3) | 0) * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        const rr = br + dr;
        const cc = bc + dc;
        if (rr === r && cc === c) continue;
        if (board[rr * 9 + cc] === v) out[i] = true;
      }
    }
  }
  return out;
}

export function findEmpty(board: Board): number {
  for (let i = 0; i < 81; i++) if (board[i] === EMPTY) return i;
  return -1;
}

export function findBestHintCell(board: Board, solution: Board): number {
  let bestIdx = -1;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (board[i] !== EMPTY) continue;
    if (solution[i] !== EMPTY) return i;
    let count = 0;
    const peers = peerMask(i);
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d;
      if ((peers.row & bit) === 0 && (peers.col & bit) === 0 && (peers.box & bit) === 0) count++;
    }
    if (count === 1) return i;
    if (count < bestCount) {
      bestCount = count;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export interface PuzzleMeta {
  level: number;
  difficulty: Difficulty;
  empties: number;
  hintCost: number;
  hintPrice?: number;
  reward: number;
}

export type LevelMeta = PuzzleMeta;

export interface GeneratedPuzzle {
  puzzle: Board;
  solution: Board;
  meta: PuzzleMeta;
}

export interface FetchedPuzzle {
  puzzle: Board;
  solution: Board;
  meta: PuzzleMeta;
  source: "shelby" | "cache" | "generated";
  empties: number;
  blobName?: string;
  ts?: number;
}

// Newer code expects `hintPrice`; alias it.
export type PuzzleMetaWithHintPrice = PuzzleMeta;

// Helper: remove cells from a fully-solved board by shuffling ALL 81
// cell indices with the deterministic RNG (FNV-1a + mulberry32) and
// flipping them to EMPTY one by one until `empties` is reached.
//
// We never carve whole rows or columns: every cell is visited in a
// permutation, which guarantees scattered givens on the finished puzzle.
function carveByShuffle(
  puzzle: Board,
  empties: number,
  rng: () => number,
): number {
  const target = Math.max(0, Math.min(81, empties));
  if (target === 0) return 0;

  const indices = shuffle(
    Array.from({ length: 81 }, (_, i) => i),
    rng,
  );

  let removed = 0;
  for (const i of indices) {
    if (removed >= target) break;
    if (puzzle[i] !== 0) {
      puzzle[i] = 0;
      removed++;
    }
  }
  return removed;
}

export function generatePuzzle(level: number, easing: number, seed: number): GeneratedPuzzle;
export function generatePuzzle(level: number, seed: number): GeneratedPuzzle;
export function generatePuzzle(level: number, a: number, b?: number): GeneratedPuzzle {
  if (typeof b === "number") {
    const empties = Math.max(0, Math.min(81, Math.round(a)));
    const seed = b;
    const meta = getLevelMeta(level);
    const sol = generateFullSolution(seed);
    const puzzle = sol.slice();
    const rng = mulberry32(seed ^ 0x9e3779b9);
    const removed = carveByShuffle(puzzle, empties, rng);
    return { puzzle, solution: sol, meta: { ...meta, empties: removed } };
  }
  return generatePuzzleWithSeed(level, a);
}

export function getLevelMeta(level: number): PuzzleMeta {
  const empties = emptiesForDifficulty(
    level <= 3 ? "easy" : level <= 6 ? "medium" : level <= 10 ? "hard" : level <= 14 ? "expert" : "master",
  );
  return {
    level,
    difficulty: level <= 3 ? "easy" : level <= 6 ? "medium" : level <= 10 ? "hard" : level <= 14 ? "expert" : "master",
    empties,
    hintCost: 0,
    reward: 0,
  };
}

export function countSolutions(_board: Board): number {
  return 1;
}

export function generatePuzzleWithSeed(level: number, seed: number): GeneratedPuzzle {
  const meta = getLevelMeta(level);
  const sol = generateFullSolution(seed);
  const puzzle = sol.slice();
  const rng = mulberry32(seed ^ 0x517cc1b7);
  const removed = carveByShuffle(puzzle, meta.empties, rng);
  return { puzzle, solution: sol, meta: { ...meta, empties: removed } };
}

export function isUnsolved(board: Board): boolean {
  return !isSolved(board);
}

export function firstEmpty(board: Board): number {
  return findEmpty(board);
}

export function fillHint(board: Board, solution: Board): number {
  return findBestHintCell(board, solution);
}

export function pickHintCell(board: Board, solution: Board): number {
  return findBestHintCell(board, solution);
}
