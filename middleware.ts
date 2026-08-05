import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Gate /curator when CURATOR_GATE_SECRET is set (Vercel env).
 * Access with cookie curator_key=<secret> or ?key=<secret> (then cookie is set).
 * If the secret is unset, curator stays open (local/dev).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/curator")) {
    return NextResponse.next();
  }

  const secret = process.env.CURATOR_GATE_SECRET?.trim();
  if (!secret) {
    return NextResponse.next();
  }

  const fromQuery = req.nextUrl.searchParams.get("key")?.trim();
  const fromCookie = req.cookies.get("curator_key")?.value?.trim();
  const key = fromQuery || fromCookie;

  if (key && key === secret) {
    const res = NextResponse.next();
    if (fromQuery) {
      res.cookies.set("curator_key", secret, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }
    return res;
  }

  return new NextResponse("Curator gated — set CURATOR_GATE_SECRET and open /curator?key=…", {
    status: 401,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/curator/:path*"],
};
