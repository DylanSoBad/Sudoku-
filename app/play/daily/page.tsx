import type { Metadata } from "next";
import { PlayLevelPage } from "@/components/play-level";

export const metadata: Metadata = {
  title: "Daily challenge · Sudoku on Shelby",
  description: "UTC daily sudoku challenge with 2x shelbyUSD reward.",
};

/** Level 0 is the daily sentinel — fetcher maps it to shelby-sudoku-daily-{date}. */
export default function Page() {
  return <PlayLevelPage level={0} />;
}
