/**
 * Full-bleed atmospheric 9×9 grid — visual anchor for the homepage hero.
 * Decorative only; not interactive.
 */
export function HeroGrid() {
  const cells = Array.from({ length: 81 }, (_, i) => i);
  // Sparse “given” digits for atmosphere — not a real puzzle.
  const accents: Record<number, string> = {
    4: "7",
    12: "3",
    20: "9",
    30: "1",
    40: "5",
    50: "8",
    60: "2",
    68: "6",
    76: "4",
  };

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-bg/20 via-transparent to-bg" />
      <div className="absolute -right-[8%] top-[8%] w-[min(92vw,720px)] origin-top-right scale-100 opacity-90 sm:right-[2%] sm:top-[4%] lg:w-[min(58vw,780px)]">
        <div
          className="animate-grid-pulse grid aspect-square grid-cols-9 border border-line/60 bg-surface/30 backdrop-blur-[2px]"
          style={{
            boxShadow: "0 0 80px rgba(139, 92, 246, 0.12), inset 0 0 60px rgba(10, 10, 11, 0.5)",
          }}
        >
          {cells.map((i) => {
            const r = (i / 9) | 0;
            const c = i % 9;
            const digit = accents[i];
            return (
              <div
                key={i}
                className={[
                  "relative flex items-center justify-center border-b border-r border-line/40 font-mono text-sm text-accent/50 sm:text-base md:text-lg",
                  (c === 2 || c === 5) && "border-r-line-strong/70 border-r-2",
                  (r === 2 || r === 5) && "border-b-line-strong/70 border-b-2",
                  c === 8 && "border-r-0",
                  r === 8 && "border-b-0",
                  digit ? "bg-accent/[0.04]" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {digit ?? ""}
              </div>
            );
          })}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" />
    </div>
  );
}
