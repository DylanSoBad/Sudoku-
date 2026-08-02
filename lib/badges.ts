/**
 * NFT badge milestones — client records + optional Move mint / Shelby metadata blob.
 */

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  /** Complete this level (inclusive) to unlock. */
  level: number;
  /** Shelby storytelling blob name pattern. */
  metadataBlobHint: string;
}

export const BADGE_MILESTONES: BadgeDef[] = [
  {
    id: "easy_clear",
    name: "Easy Clear",
    description: "Solve Level 3",
    level: 3,
    metadataBlobHint: "badges/easy_clear.json",
  },
  {
    id: "hard_adept",
    name: "Hard Adept",
    description: "Solve Level 10",
    level: 10,
    metadataBlobHint: "badges/hard_adept.json",
  },
  {
    id: "master",
    name: "Master",
    description: "Solve Level 20",
    level: 20,
    metadataBlobHint: "badges/master.json",
  },
];

const BADGES_KEY = "shelby-sudoku-badges";

export interface EarnedBadge {
  id: string;
  earnedAt: number;
  level: number;
  /** Optional Shelby blob / on-chain mint marker. */
  blobName?: string;
  txHash?: string;
  source: "local" | "chain";
}

function loadAll(): Record<string, EarnedBadge[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BADGES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, EarnedBadge[]>;
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, EarnedBadge[]>): void {
  localStorage.setItem(BADGES_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent("shelby:badges"));
}

export function getEarnedBadges(address: string): EarnedBadge[] {
  const key = address || "guest";
  return loadAll()[key] ?? [];
}

export function hasBadge(address: string, id: string): boolean {
  return getEarnedBadges(address).some((b) => b.id === id);
}

/** Milestones newly unlocked by completing `level`. */
export function milestonesForLevel(level: number): BadgeDef[] {
  return BADGE_MILESTONES.filter((b) => b.level === level);
}

export function recordBadge(
  address: string,
  def: BadgeDef,
  extra?: Partial<Pick<EarnedBadge, "blobName" | "txHash" | "source">>,
): EarnedBadge | null {
  const key = address || "guest";
  const all = loadAll();
  const list = all[key] ?? [];
  if (list.some((b) => b.id === def.id)) return null;
  const entry: EarnedBadge = {
    id: def.id,
    earnedAt: Date.now(),
    level: def.level,
    source: extra?.source ?? "local",
    blobName: extra?.blobName,
    txHash: extra?.txHash,
  };
  list.push(entry);
  all[key] = list;
  saveAll(all);
  return entry;
}

/** Build a local metadata storytelling object for Shelby blob upload. */
export function badgeMetadataPayload(
  address: string,
  def: BadgeDef,
  puzzleBlob?: string,
  replayBlob?: string,
): Record<string, unknown> {
  return {
    v: 1,
    type: "sudoku_badge",
    badgeId: def.id,
    name: def.name,
    description: def.description,
    level: def.level,
    addr: address,
    puzzleBlob: puzzleBlob ?? `puzzles/level-${String(def.level).padStart(3, "0")}.bin`,
    replayBlob: replayBlob ?? null,
    metadataBlob: def.metadataBlobHint,
    mintedAt: Date.now(),
  };
}
