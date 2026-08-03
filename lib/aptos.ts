/**
 * Aptos client + on-chain balance helpers.
 *
 * - `aptosClient` is the @aptos-labs/ts-sdk singleton bound to Network.TESTNET
 *   and the configured fullnode. Use `getAptosClient()` (or the alias
 *   `aptosClient`) to read resources, FA balances, and wait for txns.
 *
 * - `getAptBalance(addr)` queries the `0x1::coin::CoinStore<AptosCoin>`
 *   resource and returns the value in APT (octas → 1e8).
 *
 * - `getShelbyUsdBalance(addr)` queries the shelbyUSD **fungible asset** held
 *   by the wallet. The FA metadata object address is resolved at runtime
 *   from `NEXT_PUBLIC_SHELBY_USD_MODULE` (which is `0x249f...::shelby_usd`):
 *     a) view call `<module>::shelby_usd::metadata_address()` if exposed
 *     b) resource scan on the module for a `0x1::fungible_asset::Metadata`
 *        resource (the `data.inner` field is the object address)
 *     c) fallback to a cached `NEXT_PUBLIC_SHELBYUSD_FA_METADATA` constant
 *   The resolved address is cached in-memory for the session.
 *
 *   Once metadata is known, the balance is read via the REST fullnode
 *   `/accounts/{addr}/resources` endpoint, scanning for a
 *   `0x1::primary_fungible_store::PrimaryFungibleStore` whose `metadata`
 *   field matches. Decimals are `NEXT_PUBLIC_SHELBY_USD_DECIMALS` (default 6).
 *
 * - `waitForTxSuccess(hash)` polls `aptos.waitForTransaction` and throws on
 *   `success=false`. Returns the full committed transaction response.
 */
import {
  Aptos,
  AptosConfig,
  Network,
} from "@aptos-labs/ts-sdk";

const SHELBYNET_FULLNODE = "https://api.shelbynet.shelby.xyz/v1";
const TESTNET_FULLNODE = "https://api.testnet.aptoslabs.com/v1";

type NetworkName = "testnet" | "mainnet" | "devnet" | "shelbynet";

function readNetwork(): NetworkName {
  const raw = (process.env.NEXT_PUBLIC_APTOS_NETWORK ?? "testnet").toLowerCase();
  if (raw === "mainnet" || raw === "devnet" || raw === "testnet" || raw === "shelbynet") {
    return raw;
  }
  return "testnet";
}

function readApiKey(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_APTOS_API_KEY?.trim();
  if (!raw) return undefined;
  if (raw === "aptoslabs_YOUR_KEY_HERE") return undefined;
  return raw;
}

function readShelbyUsdModule(): string {
  return (
    process.env.NEXT_PUBLIC_SHELBY_USD_MODULE?.trim() ||
    process.env.NEXT_PUBLIC_TOKEN_MODULE_ADDRESS?.trim() ||
    "0x249f5c642a63885ff88a5113b3ba0079840af5a1357706f8c7f3bfc5dd12511f"
  );
}

function readShelbyUsdDecimals(): number {
  const raw = process.env.NEXT_PUBLIC_SHELBY_USD_DECIMALS?.trim();
  if (!raw) return 6;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 18 ? n : 6;
}

function readFullnode(): string {
  const raw = process.env.NEXT_PUBLIC_APTOS_FULLNODE?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/+$/, "") : TESTNET_FULLNODE;
}

let cachedClient: Aptos | null = null;

export function getAptosClient(): Aptos {
  if (cachedClient) return cachedClient;
  const net = readNetwork();
  const apiKey = readApiKey();

  if (net === "shelbynet") {
    const cfg = new AptosConfig({
      network: Network.TESTNET,
      fullnode: SHELBYNET_FULLNODE,
      ...(apiKey ? { clientConfig: { API_KEY: apiKey } } : {}),
    });
    cachedClient = new Aptos(cfg);
    return cachedClient;
  }

  const network =
    net === "mainnet"
      ? Network.MAINNET
      : net === "devnet"
        ? Network.DEVNET
        : Network.TESTNET;
  const cfg = new AptosConfig({
    network,
    fullnode: readFullnode(),
    ...(apiKey ? { clientConfig: { API_KEY: apiKey } } : {}),
  });
  cachedClient = new Aptos(cfg);
  return cachedClient;
}

/** Lazy-initialized alias matching the @aptos-labs/ts-sdk singleton style. */
export const aptosClient: Aptos = new Proxy({} as Aptos, {
  get(_target, prop, receiver) {
    const real = getAptosClient();
    return Reflect.get(real as unknown as object, prop, receiver);
  },
});

export function getAptos(): Aptos {
  return getAptosClient();
}

export function networkName(): NetworkName {
  return readNetwork();
}

export function shelbyUsdModuleAddress(): string {
  return readShelbyUsdModule();
}

export function shelbyUsdDecimalsValue(): number {
  return readShelbyUsdDecimals();
}

// ─── Transaction waiting ──────────────────────────────────────────────────

/**
 * Poll `waitForTransaction` until the transaction is committed. Throws if
 * `success` is false on the response, with the vm_status as the message.
 */
export async function waitForTxSuccess(
  hash: string,
  options?: { timeoutSec?: number; checkSuccess?: boolean },
): Promise<unknown> {
  const client = getAptosClient();
  const checkSuccess = options?.checkSuccess ?? true;
  const res = await client.waitForTransaction({
    transactionHash: hash,
    options: options?.timeoutSec ? { timeoutSecs: options.timeoutSec } : undefined,
  });
  if (checkSuccess) {
    const r = res as unknown as { success?: boolean; vm_status?: string };
    if (r && r.success === false) {
      throw new Error(`tx ${hash} failed: ${r.vm_status ?? "unknown vm_status"}`);
    }
  }
  return res;
}

// ─── Balances ────────────────────────────────────────────────────────────

export async function getAptBalance(address: string): Promise<number> {
  const client = getAptosClient();
  const amount = await client.getAccountAPTAmount({ accountAddress: address });
  return Number(amount) / 1e8;
}

// ─── shelbyUSD (Fungible Asset) ───────────────────────────────────────────
//
// Resolution order for the metadata object address:
//   a) view call `<module>::shelby_usd::metadata()` (confirmed exposed on testnet)
//   b) env override `NEXT_PUBLIC_SHELBYUSD_FA_METADATA`
//   c) baked-in fallback discovered 2026-08-03:
//      0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1
//      Holds `0x1::fungible_asset::Metadata` resource.
//
// The resolved address is cached for the lifetime of the client.

let cachedMetadataAddress: string | null = null;

function unwrapStr(input: unknown): string | undefined {
  if (typeof input === "string") return input;
  if (input && typeof input === "object" && "inner" in (input as Record<string, unknown>)) {
    const inner = (input as Record<string, unknown>)["inner"];
    if (typeof inner === "string") return inner;
  }
  return undefined;
}

async function tryViewMetadataAddress(
  client: Aptos,
  moduleAddr: string,
): Promise<string | null> {
  // Path (a): view call `@shelby_usd::shelby_usd::metadata_address()`.
  // We try both `metadata_address` (returns `address`) and `metadata`
  // (returns `Object<Metadata>`) — whichever the module exposes.
  const tryOne = async (name: string): Promise<string | null> => {
    try {
      const fn = `${moduleAddr}::shelby_usd::${name}` as `${string}::${string}::${string}`;
      const out = (await client.view({
        payload: { function: fn, typeArguments: [], functionArguments: [] },
      })) as unknown;
      if (!Array.isArray(out) || out.length === 0) return null;
      const first = out[0] as unknown;
      if (first && typeof first === "object" && "inner" in (first as Record<string, unknown>)) {
        const inner = (first as { inner?: unknown }).inner;
        if (typeof inner === "string" && inner.startsWith("0x")) return inner;
      }
      if (typeof first === "string" && first.startsWith("0x")) return first;
      return null;
    } catch {
      return null;
    }
  };
  return (await tryOne("metadata_address")) ?? (await tryOne("metadata"));
}

async function resolveShelbyUsdMetadata(): Promise<string | null> {
  if (cachedMetadataAddress) return cachedMetadataAddress;
  const moduleAddr = readShelbyUsdModule();
  const client = getAptosClient();

  // (a) view call
  const viaView = await tryViewMetadataAddress(client, moduleAddr);
  if (viaView) {
    cachedMetadataAddress = viaView;
    return viaView;
  }

  // (c) env override
  const envOverride = process.env.NEXT_PUBLIC_SHELBYUSD_FA_METADATA?.trim();
  if (envOverride && envOverride.startsWith("0x")) {
    cachedMetadataAddress = envOverride;
    return envOverride;
  }

  // (d) baked-in fallback (resolved via testnet view on 2026-08-03).
  cachedMetadataAddress =
    "0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1";
  return cachedMetadataAddress;
}

/**
 * Resolve the shelbyUSD FA metadata object address, using the in-memory cache
 * when possible. Returns null if the module hasn't been published yet.
 */
export async function shelbyUsdMetadataAddress(): Promise<string | null> {
  return resolveShelbyUsdMetadata();
}

/**
 * Read the shelbyUSD FA primary store balance for `address` and return it
 * in human units (e.g. 12.34, not raw u64). Returns 0 on failure.
 */
export async function getShelbyUsdBalance(address: string): Promise<number> {
  const decimals = readShelbyUsdDecimals();
  const fullnode = readFullnode();

  let metadata: string | null = cachedMetadataAddress;
  if (!metadata) {
    metadata = await resolveShelbyUsdMetadata();
  }
  if (!metadata) return 0;

  try {
    const res = await fetch(`${fullnode}/accounts/${address}/resources`, {
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) return 0;
    const body = (await res.json()) as Array<{ type: string; data?: unknown }>;
    const metaLower = metadata.toLowerCase();
    for (const r of body) {
      if (!r.type) continue;
      const isPrimary =
        r.type === "0x1::primary_fungible_store::PrimaryFungibleStore" ||
        r.type.endsWith("::primary_fungible_store::PrimaryFungibleStore");
      if (!isPrimary) continue;
      const metaInner = unwrapStr(r.data);
      if (metaInner && metaInner.toLowerCase() === metaLower) {
        const data = r.data as { balance?: string | number };
        const raw = Number(data?.balance ?? 0);
        return Number.isFinite(raw) ? raw / 10 ** decimals : 0;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

// ─── Move registry helpers ────────────────────────────────────────────────

export function registryAddress(): string {
  return (process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS ?? "").trim();
}

export function registryConfigured(): boolean {
  return registryAddress().length > 0;
}

export function localMode(): boolean {
  const raw = (process.env.NEXT_PUBLIC_LOCAL_MODE ?? "false").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
