/**
 * Tokenomics table — single source of truth for level difficulty / empties /
 * hint price / reward. Mirrors the README table.
 */
import type { Difficulty } from "./sudoku";

export interface LevelEconomics {
  difficulty: Difficulty;
  empties: number;
  hintCost: number; // shelbyUSD
  reward: number;   // shelbyUSD
}

const TABLE: ReadonlyArray<{ max: number; econ: LevelEconomics }> = [
  { max: 3,  econ: { difficulty: "easy",   empties: 36, hintCost: 0.1, reward: 0.5  } },
  { max: 6,  econ: { difficulty: "medium", empties: 44, hintCost: 0.2, reward: 1.0  } },
  { max: 10, econ: { difficulty: "hard",   empties: 50, hintCost: 0.4, reward: 2.5  } },
  { max: 14, econ: { difficulty: "expert", empties: 55, hintCost: 0.7, reward: 5.0  } },
  { max: Infinity, econ: { difficulty: "master", empties: 60, hintCost: 1.0, reward: 10.0 } },
];

export const MAX_LEVEL = 20;

export function economicsForLevel(level: number): LevelEconomics {
  const row = TABLE.find((r) => level <= r.max) ?? TABLE[TABLE.length - 1];
  return row.econ;
}

export function difficultyForLevel(level: number): Difficulty {
  return economicsForLevel(level).difficulty;
}

export function registryAddress(): string {
  const addr = process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS ?? "";
  return addr.trim();
}

export function registryConfigured(): boolean {
  return registryAddress().length > 0;
}

export function hintCostFor(level: number): number {
  return economicsForLevel(level).hintCost;
}

export function rewardFor(level: number): number {
  return economicsForLevel(level).reward;
}

// ── Tokenomics extensions used by the marketing/UI surfaces ──────────────────

export const HINT_FEE_SPLIT = {
  treasury: 0.5,
  curator: 0.3,
  burn: 0.2,
} as const;

export const REFERRAL_BONUS_SUSD = 0.25;

export const SEASON_PASS = {
  price: 25,
  priceShelbyUsd: 25,
  durationDays: 30,
  bonusMultiplier: 1.5,
  freeHintsPerDay: 3,
  hintDiscount: 0.5,
} as const;

export const DAILY_BONUS_MULT = 1.2;
