/**
 * Level metadata: which levels are unlocked, which difficulties exist, etc.
 */
import { MAX_LEVEL, difficultyForLevel } from "./tokenomics";

export interface LevelMeta {
  n: number;
  difficulty: string;
  unlocked: boolean;
}

export function levelsForUI(address: string | undefined, cleared: number[]): LevelMeta[] {
  const clearedSet = new Set(cleared);
  const out: LevelMeta[] = [];
  for (let n = 1; n <= MAX_LEVEL; n++) {
    out.push({
      n,
      difficulty: difficultyForLevel(n),
      unlocked: n === 1 || clearedSet.has(n - 1),
    });
  }
  return out;
}