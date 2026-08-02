import type { Metadata } from "next";
import { PlayLevelPage } from "@/components/play-level";
import { levelShareMetadata } from "@/lib/og";

type Props = { params: { level: string } };

export function generateMetadata({ params }: Props): Metadata {
  return levelShareMetadata(Math.max(0, Number(params.level) || 1));
}

export default function Page() {
  return <PlayLevelPage />;
}
