/**
 * Aptos client singleton. The lowercase tree imports `getAptosClient`.
 */
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

type NetworkName = "testnet" | "mainnet" | "devnet" | "shelbynet";

function readNetwork(): NetworkName {
  const raw = (process.env.NEXT_PUBLIC_APTOS_NETWORK ?? "testnet").toLowerCase();
  if (raw === "mainnet" || raw === "devnet" || raw === "testnet" || raw === "shelbynet") return raw;
  return "testnet";
}

const SHELBYNET_FULLNODE = "https://api.shelbynet.shelby.xyz/v1";

function readApiKey(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_APTOS_API_KEY?.trim();
  if (!raw) return undefined;
  if (raw === "aptoslabs_YOUR_KEY_HERE") return undefined;
  return raw;
}

let cached: Aptos | null = null;

export function getAptosClient(): Aptos {
  if (cached) return cached;
  const net = readNetwork();
  const network = net === "mainnet" ? Network.MAINNET : net === "devnet" ? Network.DEVNET : Network.TESTNET;
  const apiKey = readApiKey();
  if (net === "shelbynet") {
    const cfg = new AptosConfig({
      network: Network.TESTNET,
      fullnode: SHELBYNET_FULLNODE,
      ...(apiKey ? { clientConfig: { API_KEY: apiKey } } : {}),
    });
    cached = new Aptos(cfg);
    return cached;
  }
  const cfg = new AptosConfig({
    network,
    ...(apiKey ? { clientConfig: { API_KEY: apiKey } } : {}),
  });
  cached = new Aptos(cfg);
  return cached;
}

export function getAptos(): Aptos {
  return getAptosClient();
}

export function networkName(): NetworkName {
  return readNetwork();
}

export function registryAddress(): string {
  return (process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS ?? "").trim();
}

export function registryConfigured(): boolean {
  return registryAddress().length > 0;
}
