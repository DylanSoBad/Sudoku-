/**
 * Open Graph image helpers used by `app/play/[level]/page.tsx`.
 */
import type { Metadata } from "next";
import {
  difficultyForLevel,
  HINT_COST_SUSD,
  REWARD_PER_LEVEL_SUSD,
} from "./tokenomics";

export function levelShareMetadata(level: number): Metadata {
  const diff = difficultyForLevel(level);
  return {
    title: `Sudoku on Shelby · Level ${level}`,
    description: `${diff.toUpperCase()} · hint ${HINT_COST_SUSD} shelbyUSD · reward ${REWARD_PER_LEVEL_SUSD} shelbyUSD`,
    openGraph: {
      title: `Level ${level} — Sudoku on Shelby`,
      description: `${diff} puzzle on Shelby blob storage.`,
    },
  };
}