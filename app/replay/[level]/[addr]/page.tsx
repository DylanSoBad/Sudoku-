import type { Metadata } from "next";
import { ReplayView } from "@/components/replay-view";
import { levelShareMetadata } from "@/lib/og";
import { allEntries } from "@/lib/leaderboard";

type Props = { params: { level: string; addr: string } };

export function generateMetadata({ params }: Props): Metadata {
  const lvl = Math.max(1, Number(params.level) || 1);
  return levelShareMetadata(lvl);
}

export default function Page({ params }: Props) {
  const lvl = Math.max(1, Number(params.level) || 1);
  const addr = params.addr.toLowerCase();
  const entry = allEntries().find((e) => e.address === addr && e.level === lvl);
  return <ReplayView level={lvl} address={addr} ms={entry?.ms ?? 0} ts={entry?.ts ?? 0} />;
}