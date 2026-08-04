"use client";

import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import type { PropsWithChildren } from "react";
import { toast } from "sonner";

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
 * Real Aptos wallet adapter (AIP-62).
 * Opt-in: Petra, Pontem, Nightly (+ Martian if registered as standard wallet).
 * No mock wallets — connect requires an installed extension.
 */
export function WalletProvider({ children }: PropsWithChildren) {
  const network = resolveNetwork();
  const apiKey = resolveApiKey();
  // Adapter may pin an older ts-sdk Network enum (no SHELBYNET). Cast at boundary.
  const adapterNetwork = network as unknown as typeof Network.TESTNET;

  return (
    <AptosWalletAdapterProvider
      autoConnect
      optInWallets={["Petra", "Pontem Wallet", "Nightly"]}
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
