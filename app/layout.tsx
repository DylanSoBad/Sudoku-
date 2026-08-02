import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { WalletProvider } from "@/components/wallet-provider";
import { AppProviders } from "@/components/app-providers";

export const metadata: Metadata = {
  title: "Sudoku on Shelby",
  description: "Campaign sudoku on Aptos + Shelby. Earn shelbyUSD, climb 20 levels.",
  metadataBase: new URL("https://sudoku-d.vercel.app"),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <AppProviders>{children}</AppProviders>
        </WalletProvider>
      </body>
    </html>
  );
}
