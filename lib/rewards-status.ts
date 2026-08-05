/**
 * Pre-flight reads for the reward treasury.
 *
 * Cheaper (and clearer) to tell a player "the treasury is empty" before they
 * sign than to let the transfer abort inside `0x1::fungible_asset`.
 */
import {
  getAptosClient,
  registryAddress,
  shelbyUsdDecimals,
  shelbyUsdMetadataAddress,
} from "@/lib/aptos";

async function viewOne<T>(fn: string, args: unknown[] = []): Promise<T | null> {
  try {
    const out = (await getAptosClient().view({
      payload: {
        function: fn as `${string}::${string}::${string}`,
        typeArguments: [],
        functionArguments: args as never[],
      },
    })) as unknown;
    return Array.isArray(out) ? ((out[0] ?? null) as T) : null;
  } catch (err) {
    console.warn("[rewards-status]", fn, err);
    return null;
  }
}

export async function fetchTreasuryAddress(): Promise<string | null> {
  const mod = registryAddress();
  if (!mod) return null;
  return viewOne<string>(`${mod}::rewards::treasury_address`);
}

/** Remaining 24h payout budget in human shelbyUSD, or null when unknown. */
export async function fetchBudgetRemaining(): Promise<number | null> {
  const mod = registryAddress();
  if (!mod) return null;
  const raw = await viewOne<string | number>(`${mod}::rewards::budget_remaining`);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n / 10 ** shelbyUsdDecimals() : null;
}

/** Treasury shelbyUSD balance in human units, or null when unknown. */
export async function fetchTreasuryBalance(): Promise<number | null> {
  const [treasury, metadata] = await Promise.all([
    fetchTreasuryAddress(),
    shelbyUsdMetadataAddress(),
  ]);
  if (!treasury || !metadata) return null;
  try {
    const out = (await getAptosClient().view({
      payload: {
        function: "0x1::primary_fungible_store::balance",
        typeArguments: ["0x1::fungible_asset::Metadata"],
        functionArguments: [treasury, metadata],
      },
    })) as unknown;
    const raw = Array.isArray(out) ? Number(out[0] ?? 0) : 0;
    return Number.isFinite(raw) ? raw / 10 ** shelbyUsdDecimals() : null;
  } catch (err) {
    console.warn("[rewards-status] treasury balance", err);
    return null;
  }
}

export interface ClaimBlocker {
  title: string;
  detail: string;
}

/**
 * Reasons a claim would fail, checked before asking the wallet to sign.
 * Returns null when nothing is obviously wrong — views that fail to load are
 * treated as "fine", because a stale RPC must not block a legitimate claim.
 */
export async function findClaimBlocker(
  reward: number,
  aptBalance: number,
): Promise<ClaimBlocker | null> {
  if (aptBalance <= 0) {
    return {
      title: "No APT for gas",
      detail: "Get testnet APT from the Aptos faucet, then claim.",
    };
  }

  const [treasury, budget] = await Promise.all([
    fetchTreasuryBalance(),
    fetchBudgetRemaining(),
  ]);

  if (treasury !== null && treasury < reward) {
    return {
      title: "Treasury is empty",
      detail: `The reward pool holds ${treasury.toFixed(3)} sUSD, less than the ${reward.toFixed(
        3,
      )} sUSD payout. Ping the curator to top it up.`,
    };
  }

  if (budget !== null && budget < reward) {
    return {
      title: "Daily payout cap reached",
      detail: "The treasury pays a fixed amount per day. Try again tomorrow.",
    };
  }

  return null;
}
