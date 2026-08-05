/**
 * Report the curator/deployer balances that a Shelby upload actually spends.
 *
 * Blobs live on shelbynet, so gas (APT) and storage (shelbyUSD) must exist
 * there — a funded testnet account uploads nothing.
 *
 * Usage: npm run shelby:funds
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const file of [".env.local", ".env"]) {
  const p = join(ROOT, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function deployerAddress() {
  const raw = readFileSync(join(ROOT, "move", ".aptos", "config.yaml"), "utf8");
  const m = raw.match(/account:\s*"?([a-fA-F0-9x]+)"?/);
  if (m) return m[1].startsWith("0x") ? m[1] : `0x${m[1]}`;
  return process.env.NEXT_PUBLIC_CURATOR_ADDRESS?.trim();
}

const NETS = [
  ["shelbynet", "https://api.shelbynet.shelby.xyz/v1"],
  ["testnet", "https://api.testnet.aptoslabs.com/v1"],
];

const addr = deployerAddress();
console.log(`deployer=${addr}\n`);

// APT is migrating from CoinStore to a fungible store, so check both and take
// whichever reports a balance.
async function aptOf(base, account) {
  const viaCoin = await fetch(
    `${base}/accounts/${account}/resource/0x1::coin::CoinStore%3C0x1::aptos_coin::AptosCoin%3E`,
  )
    .then(async (r) => (r.ok ? Number((await r.json())?.data?.coin?.value ?? 0) : 0))
    .catch(() => 0);
  const viaFa = (await faOf(base, account, "0xa")) ?? 0;
  return Math.max(viaCoin / 1e8, viaFa);
}

async function faOf(base, account, metadata) {
  const res = await fetch(`${base}/view`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      function: "0x1::primary_fungible_store::balance",
      type_arguments: ["0x1::fungible_asset::Metadata"],
      arguments: [account, metadata],
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return Number(json?.[0] ?? 0) / 1e8;
}

const metadata = process.env.NEXT_PUBLIC_SHELBYUSD_FA_METADATA?.trim();

for (const [label, base] of NETS) {
  const apt = await aptOf(base, addr).catch(() => null);
  const susd = metadata ? await faOf(base, addr, metadata).catch(() => null) : null;
  const fmt = (v) => (v === null ? "n/a" : v.toFixed(4));
  console.log(`${label.padEnd(10)} APT=${fmt(apt).padEnd(10)} sUSD=${fmt(susd)}`);
}
