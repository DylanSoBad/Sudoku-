import type { Metadata } from "next";
import { PlayLevelPage } from "@/components/play-level";
import { ogImageUrl } from "@/lib/og";

export const metadata: Metadata = {
  title: "Daily challenge · Sudoku on Shelby",
  description: "UTC daily sudoku challenge with 2x shelbyUSD reward.",
  openGraph: {
    title: "Daily challenge — Sudoku on Shelby",
    description: "UTC daily sudoku challenge with 2x shelbyUSD reward.",
    images: [{ url: ogImageUrl({ level: 0 }), width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Daily challenge — Sudoku on Shelby",
    images: [ogImageUrl({ level: 0 })],
  },
};

/** Level 0 is the daily sentinel — fetcher maps it to shelby-sudoku-daily-{date}. */
export default function Page() {
  return <PlayLevelPage level={0} />;
}
