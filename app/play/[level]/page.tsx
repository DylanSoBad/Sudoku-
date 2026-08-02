import type { Metadata } from "next";
import { PlayLevelPage } from "@/components/play-level";
import { levelShareMetadata } from "@/lib/og";

type Props = { params: { level: string } };

export function generateMetadata({ params }: Props): Metadata {
  const level = Math.max(0, Number(params.level) || 1);
  return levelShareMetadata(level);
}

export default function Page() {
  return <PlayLevelPage />;
}