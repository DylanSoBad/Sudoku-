"use client";

import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import type { AvailableWallets } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import type { PropsWithChildren } from "react";
import { toast } from "sonner";

/**
 * `optInWallets` is an allowlist: any wallet whose registered name is missing here
 * is dropped from both the detected and not-detected lists, so it silently
 * disappears from the picker. It still has to be set, because the adapter registry
 * also carries ~30 Solana/Ethereum/Sui entries that would otherwise fill the list.
 *
 * "Pontem Wallet" was removed from the adapter's own union but still registers
 * under that name, so it is cast in rather than locking those users out.
 */
const OPT_IN_WALLETS = [
  "Petra",
  "Nightly",
  "OKX Wallet",
  "Backpack",
  "Bitget Wallet",
  "Pontem Wallet",
] as unknown as ReadonlyArray<AvailableWallets>;

function resolveNetwork(): Network {
  const name = (process.env.NEXT_PUBLIC_APTOS_NETWORK ?? "testnet").toLowerCase();
  if (name === "mainnet") return Network.MAINNET;
  if (name === "devnet") return Network.DEVNET;
  return Network.TESTNET;
}

function resolveApiKey(): string | undefined {
  const apiKey = process.env.NEXT_PUBLIC_APTOS_API_KEY?.trim();
  if (!apiKey || apiKey === "aptoslabs_YOUR_KEY_HERE") return undefined;
  return apiKey;
}

/**
 * Real Aptos wallet adapter (AIP-62). No mock wallets — connect requires a real wallet.
 */
export function WalletProvider({ children }: PropsWithChildren) {
  const network = resolveNetwork();
  const apiKey = resolveApiKey();
  // Adapter may pin an older ts-sdk Network enum (no SHELBYNET). Cast at boundary.
  const adapterNetwork = network as unknown as typeof Network.TESTNET;

  return (
    <AptosWalletAdapterProvider
      autoConnect
      optInWallets={OPT_IN_WALLETS}
      dappConfig={{
        network: adapterNetwork as never,
        ...(apiKey
          ? {
              aptosApiKeys: {
                testnet: network === Network.TESTNET ? apiKey : undefined,
                mainnet: network === Network.MAINNET ? apiKey : undefined,
                devnet: network === Network.DEVNET ? apiKey : undefined,
              },
            }
          : {}),
      }}
      onError={(error) => {
        console.error("Wallet error:", error);
        const msg =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Wallet error";
        toast.error(msg);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}
