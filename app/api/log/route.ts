import { NextResponse } from "next/server";

export const runtime = "edge";

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const NETWORKS = new Set(["testnet", "mainnet", "devnet", "shelbynet"]);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const hash = typeof body.hash === "string" ? body.hash.trim() : "";
  if (!TX_HASH_RE.test(hash)) {
    return NextResponse.json({ ok: false, error: "invalid tx hash" }, { status: 400 });
  }

  const rawNet =
    (typeof body.network === "string" && body.network) ||
    process.env.NEXT_PUBLIC_APTOS_NETWORK ||
    "testnet";
  const network = NETWORKS.has(rawNet.toLowerCase()) ? rawNet.toLowerCase() : "testnet";
  const explorer = `https://explorer.aptoslabs.com/txn/${hash}?network=${network}`;
  return NextResponse.json({ ok: true, explorer, hash, network });
}
