import type { InputTransactionData } from "@aptos-labs/wallet-adapter-react";

function registryAddress(): string {
  const addr = process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim();
  if (!addr) {
    throw new Error(
      "NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS is empty. Deploy the Move package under move/ first, then set the published module address in .env.local.",
    );
  }
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

export interface OpenSessionArgs {
  level: number;
  sessionId: string;
  /** Stub block height (client may pass 0). */
  blockHeight?: number;
}

/** Build wallet-adapter payload for sudoku::rewards::open_session */
export function buildOpenSessionPayload(args: OpenSessionArgs): InputTransactionData {
  const mod = registryAddress();
  return {
    data: {
      function: `${mod}::rewards::open_session`,
      typeArguments: [],
      functionArguments: [
        args.level,
        toHexBytes(args.sessionId),
        args.blockHeight ?? 0,
      ],
    },
  };
}

export interface BuyHintArgs {
  level: number;
  sessionId: string;
  priceShelbyUSDMicro: number;
}

/** Build wallet-adapter payload for sudoku::hint_shop::buy_hint */
export function buildBuyHintPayload(args: BuyHintArgs): InputTransactionData {
  const mod = registryAddress();
  return {
    data: {
      function: `${mod}::hint_shop::buy_hint`,
      typeArguments: [],
      functionArguments: [args.level, toHexBytes(args.sessionId)],
    },
  };
}

export interface ClaimRewardArgs {
  level: number;
  sessionId: string;
  solutionMerkle: string;
  timeMs?: number;
  hintsUsed?: number;
}

/** Build wallet-adapter payload for sudoku::rewards::claim */
export function buildClaimRewardPayload(args: ClaimRewardArgs): InputTransactionData {
  const mod = registryAddress();
  return {
    data: {
      function: `${mod}::rewards::claim`,
      typeArguments: [],
      functionArguments: [
        args.level,
        toHexBytes(args.sessionId),
        toHexBytes(args.solutionMerkle),
        args.timeMs ?? 0,
        args.hintsUsed ?? 0,
      ],
    },
  };
}

export interface RegisterPuzzleArgs {
  level: number;
  blobName: string;
}

/** Build wallet-adapter payload for sudoku::registry::register_puzzle */
export function buildRegisterPuzzlePayload(args: RegisterPuzzleArgs): InputTransactionData {
  const mod = registryAddress();
  return {
    data: {
      function: `${mod}::registry::register_puzzle`,
      typeArguments: [],
      functionArguments: [args.level, toHexBytes(args.blobName)],
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
  /** Price in micro-shelbyUSD (6 decimals). */
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
      functionArguments: [args.priceMicro ?? 5_000_000],
    },
  };
}

export interface ReferralRegisterArgs {
  code: string;
  referrerHint?: string;
}

/** Build wallet-adapter payload for sudoku::referral::register (optional). */
export function buildReferralRegisterPayload(args: ReferralRegisterArgs): InputTransactionData {
  const mod = registryAddress();
  return {
    data: {
      function: `${mod}::referral::register`,
      typeArguments: [],
      functionArguments: [toHexBytes(args.code), toHexBytes(args.referrerHint ?? "")],
    },
  };
}
