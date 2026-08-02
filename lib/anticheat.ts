/**
 * Client-side anti-cheat helpers: min solve times + solution commitment hash.
 */

import type { Board, Difficulty } from "./sudoku";

const MIN_SECONDS: Record<Difficulty, number> = {
  easy: 5,
  medium: 10,
  hard: 15,
  expert: 20,
  master: 30,
};

export function minSolveSeconds(difficulty: Difficulty): number {
  return MIN_SECONDS[difficulty] ?? 5;
}

export function isSolveTooFast(elapsedSec: number, difficulty: Difficulty): boolean {
  return elapsedSec < minSolveSeconds(difficulty);
}

/**
 * solution_merkle = hex hash of (puzzle | solution | hintsUsed).
 * Uses Web Crypto when available; FNV-1a fallback otherwise.
 */
export async function computeSolutionMerkle(
  puzzle: Board,
  solution: Board,
  hintsUsed: number,
): Promise<string> {
  const payload = `${puzzle.join(",")}|${solution.join(",")}|${hintsUsed}`;

  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // SSR / no-subtle fallback
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
