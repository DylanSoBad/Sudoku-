import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const level = url.searchParams.get("level") ?? "1";
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg,#0b0d12 0%,#1b1230 100%)",
          color: "white",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg,#7b5cff,#22d3ee)",
            }}
          />
          <div style={{ fontSize: 32, fontWeight: 700 }}>Sudoku on Shelby</div>
        </div>
        <div style={{ marginTop: 64, fontSize: 96, fontWeight: 800 }}>Level {level}</div>
        <div style={{ marginTop: 24, fontSize: 28, color: "#c7d2fe" }}>
          Puzzle blob stored on Aptos × Shelby Protocol
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
