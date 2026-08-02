/**
 * Wallet provider wrapping `@aptos-labs/wallet-adapter-react`.
 *
 * We use the standard adapter but limit the opt-in wallet list to Petra,
 * Pontem, and Nightly — which is what the dApp's UI advertises and the
 * set the spec calls out.
 */
"use client";

import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import type { ReactNode } from "react";

function resolveNetwork(): Network {
  const name = (process.env.NEXT_PUBLIC_APTOS_NETWORK ?? "testnet").toLowerCase();
  if (name === "mainnet") return Network.MAINNET;
  if (name === "devnet") return Network.DEVNET;
  return Network.TESTNET;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <AptosWalletAdapterProvider
      autoConnect
      optInWallets={["Petra", "Nightly", "Pontem Wallet"]}
      dappConfig={{ network: resolveNetwork() }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}