import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { WalletProvider } from "@/components/wallet-provider";
import { AppProviders } from "@/components/app-providers";
import { Header } from "@/components/Header";
import { ToastProvider } from "@/components/ui/toast";

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
          <AppProviders>
            <Header />
            {children}
            <ToastProvider />
          </AppProviders>
        </WalletProvider>
      </body>
    </html>
  );
}
