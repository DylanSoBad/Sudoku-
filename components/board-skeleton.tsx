import { cn } from "@/lib/utils";

/** 9x9 skeleton shown while fetching a puzzle blob. */
export function BoardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col items-center gap-4", className)}
      aria-busy="true"
      aria-label="Loading puzzle"
    >
      <div className="inline-grid grid-cols-9 gap-px rounded-lg border-2 border-shelby-border bg-shelby-border p-0.5">
        {Array.from({ length: 81 }, (_, i) => {
          const r = Math.floor(i / 9);
          const c = i % 9;
          const thickRight = c === 2 || c === 5;
          const thickBottom = r === 2 || r === 5;
          return (
            <div
              key={i}
              className={cn(
                "sudoku-cell bg-shelby-panel/80",
                thickRight && "border-r-2 border-r-shelby-border",
                thickBottom && "border-b-2 border-b-shelby-border",
              )}
              style={{ animationDelay: `${(i % 9) * 40}ms` }}
            />
          );
        })}
      </div>
      <p className="text-sm text-shelby-muted">Fetching puzzle blob…</p>
    </div>
  );
}
