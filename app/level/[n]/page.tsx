import { LevelPlay } from "@/components/level-play";

export default function Page({ params }: { params: { n: string } }) {
  const level = Math.max(1, Math.min(20, Number(params.n) || 1));
  return <LevelPlay level={level} />;
}
