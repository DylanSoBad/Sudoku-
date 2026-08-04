/**
 * Tokenomics — flat model sized to fit shelbyUSD faucet limits.
 *
 * Every level pays the same reward and charges the same hint price, and a
 * player may buy at most `MAX_HINTS_PER_LEVEL` hints on a given level.
 *
 * Raw values are the u64 amounts the Move modules move on-chain. shelbyUSD
 * reports 8 decimals on testnet (verified against the FA metadata object), so
 * 1 sUSD = 1e8 raw. Keep the raw constants in sync with `hint_shop.move` and
 * `rewards.move`.
 */
import type { Difficulty } from "./sudoku";

export const REWARD_PER_LEVEL_SUSD = 0.01;
export const HINT_COST_SUSD = 0.0005;
export const MAX_HINTS_PER_LEVEL = 5;

export const REWARD_PER_LEVEL_RAW = 1_000_000;
export const HINT_COST_RAW = 50_000;

/** Display labels, kept here so UI copy cannot drift from the constants. */
export const REWARD_LABEL = `${REWARD_PER_LEVEL_SUSD} sUSD`;
export const HINT_COST_LABEL = `${HINT_COST_SUSD} sUSD`;

/** Difficulty and grid shape per level — unchanged by the flat pricing. */
export interface LevelEconomics {
  difficulty: Difficulty;
  empties: number;
}

const DIFFICULTY_TABLE: ReadonlyArray<{ max: number; econ: LevelEconomics }> = [
  { max: 3, econ: { difficulty: "easy", empties: 36 } },
  { max: 6, econ: { difficulty: "medium", empties: 44 } },
  { max: 10, econ: { difficulty: "hard", empties: 50 } },
  { max: 14, econ: { difficulty: "expert", empties: 55 } },
  { max: Infinity, econ: { difficulty: "master", empties: 60 } },
];

export const MAX_LEVEL = 20;

export function economicsForLevel(level: number): LevelEconomics {
  const row =
    DIFFICULTY_TABLE.find((r) => level <= r.max) ??
    DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1];
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
