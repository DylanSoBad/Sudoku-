import { NextResponse } from "next/server";

export const runtime = "nodejs";

function readBase(): string {
  const raw = process.env.NEXT_PUBLIC_SHELBYUSD_FAUCET_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/+$/, "") : "https://faucet.shelby.xyz/shelbyusd";
}

interface Body {
  address?: unknown;
}

function extractAddress(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const v = (body as Record<string, unknown>)["address"];
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed.startsWith("0x") || trimmed.length < 10) return null;
  return trimmed;
}

export async function POST(req: Request): Promise<Response> {
  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }

  const address = extractAddress(payload);
  if (!address) {
    return NextResponse.json({ ok: false, error: "missing or invalid `address`" }, { status: 400 });
  }

  const url = readBase();
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, network: "shelbynet" }),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "shelbyusd faucet unreachable" },
      { status: 502 },
    );
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ ok: true, hint: "POST { address }" }, { status: 200 });
}