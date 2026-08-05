import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const levelParam = url.searchParams.get("level");
  const isHome = !levelParam;
  const levelLabel =
    levelParam === "0" || levelParam === "daily"
      ? "Daily challenge"
      : levelParam
        ? `Level ${levelParam}`
        : null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0a0a0b",
          color: "#fafafa",
          padding: 64,
          backgroundImage:
            "radial-gradient(circle at 85% 20%, rgba(139,92,246,0.22), transparent 45%), radial-gradient(circle at 10% 90%, rgba(139,92,246,0.1), transparent 40%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 12,
              height: 56,
              borderRadius: 4,
              background: "#8b5cf6",
            }}
          />
          <div style={{ fontSize: 32, fontWeight: 600 }}>Sudoku on Shelby</div>
        </div>

        {isHome ? (
          <>
            <div style={{ marginTop: 72, fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
              Every puzzle is a blob.
            </div>
            <div style={{ marginTop: 28, fontSize: 28, color: "#a1a1aa" }}>
              Aptos testnet · Shelby Protocol · shelbyUSD
            </div>
          </>
        ) : (
          <>
            <div style={{ marginTop: 64, fontSize: 88, fontWeight: 700 }}>
              {levelLabel}
            </div>
            <div style={{ marginTop: 24, fontSize: 28, color: "#a1a1aa" }}>
              Puzzle blob stored on Aptos and Shelby Protocol
            </div>
          </>
        )}
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
