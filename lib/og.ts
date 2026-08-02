/**
 * Open Graph image helpers used by `app/play/[level]/page.tsx`.
 */
import type { Metadata } from "next";
import { difficultyForLevel, economicsForLevel } from "./tokenomics";

export function levelShareMetadata(level: number): Metadata {
  const econ = economicsForLevel(level);
  const diff = difficultyForLevel(level);
  return {
    title: `Sudoku on Shelby · Level ${level}`,
    description: `${diff.toUpperCase()} · hint ${econ.hintCost} shelbyUSD · reward ${econ.reward} shelbyUSD`,
    openGraph: {
      title: `Level ${level} — Sudoku on Shelby`,
      description: `${diff} puzzle on Shelby blob storage.`,
    },
  };
}