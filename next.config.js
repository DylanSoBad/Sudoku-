/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ["sudoku-d.vercel.app", "localhost:3000"] },
  },
  async rewrites() {
    return [
      {
        source: "/api/_apt_faucet/:path*",
        destination: "https://faucet.testnet.aptoslabs.com/:path*",
      },
      {
        source: "/api/_shelby_faucet/:path*",
        destination: "https://faucet.shelby.xyz/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
