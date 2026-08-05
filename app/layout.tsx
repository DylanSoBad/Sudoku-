import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Syne, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/wallet-provider";
import { AppProviders } from "@/components/app-providers";
import { Header } from "@/components/Header";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { homeShareMetadata } from "@/lib/og";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  ...homeShareMetadata(),
  metadataBase: new URL("https://sudoku-d.vercel.app"),
  // Browsers cache favicons far longer than any other asset, so every URL
  // carries a version query that must be bumped when the artwork changes.
  icons: {
    icon: [
      { url: "/favicon.ico?v=3", sizes: "any" },
      { url: "/favicon-32x32.png?v=3", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png?v=3", type: "image/png", sizes: "16x16" },
      { url: "/icons/icon.svg?v=3", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=3", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sudoku",
  },
  applicationName: "Sudoku on Shelby",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.045]"
          style={{ backgroundImage: "url('/grain.svg')", backgroundSize: "180px" }}
        />
        <WalletProvider>
          <AppProviders>
            <Header />
            <div className="relative z-10">{children}</div>
            <ToastProvider />
            <ServiceWorkerRegister />
          </AppProviders>
        </WalletProvider>
      </body>
    </html>
  );
}
