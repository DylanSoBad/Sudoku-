/**
 * Server-side Shelby blob reader.
 *
 * Downloading in the browser needs `NEXT_PUBLIC_SHELBY_API_KEY`, which ships
 * the key to every visitor. This route reads the server-only `SHELBY_API_KEY`
 * instead, so production can genuinely serve puzzles from Shelby without
 * publishing the credential. The key is optional: shelbynet also serves
 * anonymous reads, just with a lower rate limit.
 *
 * Returns 404 (not 500) on any Shelby failure so `lib/fetcher.ts` falls through
 * to the public mirror and then the deterministic generator.
 */
import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import {
  SHELBY_DEPLOYER,
  SHELBY_INDEXER_URL as SHELBY_INDEXER,
  SHELBY_RPC_URL as SHELBY_RPC,
  readShelbyBlob,
} from "@/lib/shelby-blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAME_RE = /^shelby-sudoku-(?:level-\d{1,2}|daily-\d{8})$/;
const DEFAULT_CURATOR =
  "0x071a8a3d2ca013623dba02737a3824d898756eddad5f991aa55d2155c45fa20a";

const IP_LIMIT = 120;
const LIMIT_WINDOW_MS = 5 * 60 * 1000;

function apiKey(): string | undefined {
  const raw = (process.env.SHELBY_API_KEY || process.env.NEXT_PUBLIC_SHELBY_API_KEY || "").trim();
  if (!raw || raw === "shelby_YOUR_KEY_HERE") return undefined;
  return raw;
}

function curator(): string {
  return (
    process.env.NEXT_PUBLIC_CURATOR_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim() ||
    DEFAULT_CURATOR
  );
}

export async function GET(req: Request, { params }: { params: { name: string } }) {
  const name = params.name;
  if (!NAME_RE.test(name)) {
    return NextResponse.json({ error: "invalid blob name" }, { status: 400 });
  }

  const gate = await rateLimit(clientKey(req, "blob"), IP_LIMIT, LIMIT_WINDOW_MS);
  if (!gate.ok) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: { "retry-after": String(gate.retryAfterSec) } },
    );
  }

  // Shelbynet serves anonymous reads at a lower rate limit, so a missing key
  // degrades throughput rather than disabling Shelby entirely. Responses are
  // cached below, which keeps the anonymous budget viable in production.
  const key = apiKey();

  try {
    const [{ Network }, mod] = await Promise.all([
      import("@aptos-labs/ts-sdk"),
      import("@shelby-protocol/sdk/node") as Promise<Record<string, unknown>>,
    ]);
    const Client = (mod["ShelbyNodeClient"] ?? mod["ShelbyClient"]) as
      | (new (opts: Record<string, unknown>) => { download?: (a: unknown) => Promise<unknown> })
      | undefined;
    if (typeof Client !== "function") {
      return NextResponse.json({ error: "shelby sdk unavailable" }, { status: 404 });
    }

    const network =
      (Network as unknown as Record<string, unknown>)["SHELBYNET"] ?? "shelbynet";
    const client = new Client({
      network,
      apiKey: key,
      deployer: SHELBY_DEPLOYER,
      rpc: { baseUrl: SHELBY_RPC, apiKey: key },
      indexer: { baseUrl: SHELBY_INDEXER, apiKey: key },
    });
    if (typeof client.download !== "function") {
      return NextResponse.json({ error: "shelby download unavailable" }, { status: 404 });
    }

    const out = await client.download({ account: curator(), blobName: name });
    const bytes = await readShelbyBlob(out);
    if (!bytes || bytes.length < 100) {
      return NextResponse.json({ error: "empty blob" }, { status: 404 });
    }

    // Campaign blobs are immutable; the daily one rolls at 00:05 UTC.
    const immutable = !name.startsWith("shelby-sudoku-daily-");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": immutable
          ? "public, max-age=86400, s-maxage=86400, immutable"
          : "public, max-age=300, s-maxage=300",
        "x-blob-source": "shelby",
      },
    });
  } catch (err) {
    console.warn("[api/blob] shelby download failed", name, err);
    return NextResponse.json({ error: "shelby download failed" }, { status: 404 });
  }
}
