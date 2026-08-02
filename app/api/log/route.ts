import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const network = body.network ?? process.env.NEXT_PUBLIC_APTOS_NETWORK ?? "testnet";
  const explorer = `https://explorer.aptoslabs.com/txn/${body.hash}?network=${network}`;
  return NextResponse.json({ ok: true, explorer, ...body });
}
