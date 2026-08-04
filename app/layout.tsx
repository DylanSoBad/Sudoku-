import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/wallet-provider";
import { AppProviders } from "@/components/app-providers";
import { Header } from "@/components/Header";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sudoku on Shelby",
  description: "Campaign sudoku on Aptos and Shelby. Earn shelbyUSD, climb 20 levels.",
  metadataBase: new URL("https://sudoku-d.vercel.app"),
  // Browsers cache favicons far longer than any other asset, so every URL
  // carries a version query that must be bumped when the artwork changes.
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/favicon-32x32.png?v=2", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png?v=2", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
          style={{ backgroundImage: "url('/grain.svg')", backgroundSize: "220px" }}
        />
        <WalletProvider>
          <AppProviders>
            <Header />
            <div className="relative z-10">{children}</div>
            <ToastProvider />
          </AppProviders>
        </WalletProvider>
      </body>
    </html>
  );
}
