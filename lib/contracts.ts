import type { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { toRawShelbyUsd } from "@/lib/aptos";
import { SEASON_PASS } from "@/lib/tokenomics";

const DEFAULT_REGISTRY_ADDRESS =
  "0x071a8a3d2ca013623dba02737a3824d898756eddad5f991aa55d2155c45fa20a";

function registryAddress(): string {
  const addr =
    process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim() || DEFAULT_REGISTRY_ADDRESS;
  return addr;
}

function toHexBytes(input: string | Uint8Array): string {
  if (typeof input === "string") {
    const bytes = new TextEncoder().encode(input);
    return `0x${Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`;
  }
  return `0x${Array.from(input)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export interface BuyHintArgs {
  level: number;
  /** When true, charge half price via `season_pass::buy_hint` (requires active pass). */
  seasonPass?: boolean;
  /** Unused: on-chain price is derived from the entry chosen above. */
  sessionId?: string;
  /** Unused: on-chain price is derived from the entry chosen above. */
  priceShelbyUSDMicro?: number;
}

/** Build wallet-adapter payload for a hint purchase (full or season-pass half). */
export function buildBuyHintPayload(args: BuyHintArgs): InputTransactionData {
  const mod = registryAddress();
  return {
    data: {
      function: args.seasonPass
        ? `${mod}::season_pass::buy_hint`
        : `${mod}::hint_shop::buy_hint`,
      typeArguments: [],
      functionArguments: [args.level],
    },
  };
}

export interface ClaimRewardArgs {
  level: number;
  /** Unused: `rewards::claim` keys the payout table by (signer, level). */
  sessionId?: string;
  /** Unused: the reward amount is fixed on-chain by `reward_for(level)`. */
  solutionMerkle?: string;
  /** Unused on-chain; kept for local leaderboard bookkeeping. */
  timeMs?: number;
  /** Unused on-chain; kept for local leaderboard bookkeeping. */
  hintsUsed?: number;
}

/** Build wallet-adapter payload for `rewards::claim(level: u64)`. */
export function buildClaimRewardPayload(args: ClaimRewardArgs): InputTransactionData {
  const mod = registryAddress();
  return {
    data: {
      function: `${mod}::rewards::claim`,
      typeArguments: [],
      functionArguments: [args.level],
    },
  };
}

export interface RegisterPuzzleArgs {
  level: number;
  blobName: string;
  /** Merkle root / hash committing to the blob contents. */
  commitment?: Uint8Array | string;
}

/**
 * Build wallet-adapter payload for
 * `registry::register_puzzle(level: u64, blob_name: String, commitment: vector<u8>)`.
 * `blob_name` is a Move `String`, so it is passed as a plain UTF-8 string
 * rather than hex-encoded bytes.
 */
export function buildRegisterPuzzlePayload(args: RegisterPuzzleArgs): InputTransactionData {
  const mod = registryAddress();
  return {
    data: {
      function: `${mod}::registry::register_puzzle`,
      typeArguments: [],
      functionArguments: [
        args.level,
        args.blobName,
        toHexBytes(args.commitment ?? new Uint8Array()),
      ],
    },
  };
}

export interface MintBadgeArgs {
  milestoneId: string;
  level: number;
  metadataBlobName?: string;
}

/** Build wallet-adapter payload for sudoku::nft_badge::mint_milestone */
export function buildMintBadgePayload(args: MintBadgeArgs): InputTransactionData {
  const mod = registryAddress();
  return {
    data: {
      function: `${mod}::nft_badge::mint_milestone`,
      typeArguments: [],
      functionArguments: [
        toHexBytes(args.milestoneId),
        args.level,
        toHexBytes(args.metadataBlobName ?? ""),
      ],
    },
  };
}

export interface PurchaseSeasonPassArgs {
  /**
   * Price in raw shelbyUSD units. Build it with `toRawShelbyUsd()` so the
   * scale follows `NEXT_PUBLIC_SHELBY_USD_DECIMALS` (8 on testnet).
   */
  priceMicro?: number;
}

/** Build wallet-adapter payload for sudoku::season_pass::purchase */
export function buildPurchaseSeasonPassPayload(
  args: PurchaseSeasonPassArgs = {},
): InputTransactionData {
  const mod = registryAddress();
  return {
    data: {
      function: `${mod}::season_pass::purchase`,
      typeArguments: [],
      functionArguments: [
        args.priceMicro ?? toRawShelbyUsd(SEASON_PASS.priceShelbyUsd),
      ],
    },
  };
}

export interface ReferralRegisterArgs {
  code: string;
  referrerHint?: string;
}

/** Build wallet-adapter payload for sudoku::referral::publish_code. */
export function buildPublishCodePayload(code: string): InputTransactionData {
  const mod = registryAddress();
  return {
    data: {
      function: `${mod}::referral::publish_code`,
      typeArguments: [],
      functionArguments: [toHexBytes(code.trim().toUpperCase())],
    },
  };
}

/** Build wallet-adapter payload for sudoku::referral::register. */
export function buildReferralRegisterPayload(args: ReferralRegisterArgs): InputTransactionData {
  const mod = registryAddress();
  return {
    data: {
      function: `${mod}::referral::register`,
      typeArguments: [],
      functionArguments: [toHexBytes(args.code.trim().toUpperCase()), toHexBytes(args.referrerHint ?? "")],
    },
  };
}
