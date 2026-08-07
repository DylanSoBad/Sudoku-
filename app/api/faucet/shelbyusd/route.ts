import { NextResponse } from "next/server";
import { extractAddressFromBody } from "@/lib/server/aptos-address";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set(["faucet.shelby.xyz"]);

function readBase(): string | null {
  const raw = (
    process.env.SHELBYUSD_FAUCET_URL ||
    process.env.NEXT_PUBLIC_SHELBYUSD_FAUCET_URL ||
    "https://faucet.shelby.xyz/shelbyusd"
  ).trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.replace(/\/+$/, ""));
    if (u.protocol !== "https:") return null;
    if (!ALLOWED_HOSTS.has(u.host)) return null;
    return `${u.origin}${u.pathname}`.replace(/\/+$/, "") || u.origin;
  } catch {
    return null;
  }
}

function faucetEnabled(): boolean {
  const v = (process.env.FAUCET_ENABLED ?? "true").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

export async function POST(req: Request): Promise<Response> {
  if (!faucetEnabled()) {
    return NextResponse.json({ ok: false, error: "faucet disabled" }, { status: 403 });
  }

  const limited = await rateLimit(clientKey(req, "susd-faucet"), 3, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate limited — try again later" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }

  const address = extractAddressFromBody(payload);
  if (!address) {
    return NextResponse.json({ ok: false, error: "missing or invalid `address`" }, { status: 400 });
  }

  const url = readBase();
  if (!url) {
    return NextResponse.json({ ok: false, error: "faucet URL not allowed" }, { status: 500 });
  }

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
