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
          background: "#0a0a0b",
          color: "#fafafa",
          padding: 64,
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
        <div style={{ marginTop: 64, fontSize: 96, fontWeight: 600 }}>Level {level}</div>
        <div style={{ marginTop: 24, fontSize: 28, color: "#a1a1aa" }}>
          Puzzle blob stored on Aptos and Shelby Protocol
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
