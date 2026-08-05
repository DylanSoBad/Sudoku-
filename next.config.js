/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ["sudoku-d.vercel.app", "localhost:3000"] },
  },
  // Open faucet rewrites removed — they let anyone proxy through this origin.
  // Use the rate-limited POST handlers under /api/faucet/* only.
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      // Next.js + wallet adapters still need inline/eval in practice.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      [
        "connect-src 'self'",
        "https://*.aptoslabs.com",
        "https://api.testnet.aptoslabs.com",
        "https://api.mainnet.aptoslabs.com",
        "https://*.shelby.xyz",
        "https://api.shelbynet.shelby.xyz",
        "wss:",
        "https://fullnode.testnet.aptoslabs.com",
        "https://fullnode.mainnet.aptoslabs.com",
      ].join(" "),
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
