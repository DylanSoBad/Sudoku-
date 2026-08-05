/**
 * Smoke-test the Shelby download path used by `app/api/blob/[name]/route.ts`.
 *
 * Answers the only question that matters for the pitch: does the configured
 * API key actually pull curated blob bytes out of Shelby, or is production
 * silently serving the public mirror?
 *
 * Usage: npm run shelby:check [-- blob-name]
 */
import { readFileSync, existsSync } from "node:fs";
import { AccountAddress, Network } from "@aptos-labs/ts-sdk";

const SHELBY_RPC = "https://api.shelbynet.shelby.xyz/shelby";
const SHELBY_INDEXER =
  "https://api.shelbynet.aptoslabs.com/nocode/v1/public/cmforrguw0042s601fn71f9l2/v1/graphql";
// Keep in sync with lib/shelby-blob.ts.
const SHELBY_DEPLOYER =
  "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function apiKey() {
  const raw = (process.env.SHELBY_API_KEY || process.env.NEXT_PUBLIC_SHELBY_API_KEY || "").trim();
  return !raw || raw === "shelby_YOUR_KEY_HERE" ? undefined : raw;
}

const blobName = process.argv[2] || "shelby-sudoku-level-1";
const account =
  process.env.NEXT_PUBLIC_CURATOR_ADDRESS?.trim() ||
  process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim();

// Shelbynet allows anonymous reads, so a missing key is only a rate-limit
// concern — not a reason to fail this check.
const key = apiKey();
if (!key) {
  console.log("note: no API key, reading anonymously");
}
if (!account) {
  console.error("FAIL: no curator address configured");
  process.exit(1);
}

const mod = await import("@shelby-protocol/sdk/node");
const Client = mod.ShelbyNodeClient ?? mod.ShelbyClient;
if (typeof Client !== "function") {
  console.error("FAIL: ShelbyNodeClient missing from @shelby-protocol/sdk/node");
  process.exit(1);
}

const client = new Client({
  network: Network.SHELBYNET ?? "shelbynet",
  apiKey: key,
  deployer: AccountAddress.from(SHELBY_DEPLOYER),
  rpc: { baseUrl: SHELBY_RPC, apiKey: key },
  indexer: { baseUrl: SHELBY_INDEXER, apiKey: key },
});

if (typeof client.download !== "function") {
  console.error("FAIL: client.download missing");
  process.exit(1);
}

try {
  const out = await client.download({ account, blobName });
  let len = 0;
  if (out?.readable && typeof out.readable.getReader === "function") {
    const reader = out.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) len += value.length;
    }
  } else {
    const bytes = out instanceof Uint8Array ? out : (out?.data ?? out?.bytes ?? null);
    len = bytes?.length ?? bytes?.byteLength ?? 0;
  }
  if (!len) {
    console.error(`FAIL: ${blobName} downloaded 0 bytes`);
    process.exit(1);
  }
  console.log(`OK: ${blobName} → ${len} bytes from Shelby (account ${account})`);
} catch (err) {
  console.error(`FAIL: ${blobName} —`, err instanceof Error ? err.message : err);
  process.exit(1);
}
