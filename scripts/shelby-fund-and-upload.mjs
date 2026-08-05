/**
 * Fund the curator on shelbynet with ShelbyUSD (via the SDK's built-in faucet)
 * and prove a real blob round-trip.
 *
 * The web faucet at faucet.shelbynet.shelby.xyz is interactive, but the SDK
 * exposes `fundAccountWithShelbyUSD`, which is scriptable. Blob uploads are
 * paid in ShelbyUSD, so without this the upload aborts on an empty store.
 *
 * Usage: npm run shelby:fund
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Account,
  AccountAddress,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  Network,
} from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const file of [".env.local", ".env"]) {
  const p = join(ROOT, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function apiKey() {
  const raw = (process.env.SHELBY_API_KEY || "").trim();
  return !raw || /YOUR_KEY/i.test(raw) ? undefined : raw;
}

function loadDeployer() {
  const raw = readFileSync(join(ROOT, "move", ".aptos", "config.yaml"), "utf8");
  const m = raw.match(/private_key:\s*"?ed25519-priv-(0x[a-fA-F0-9]+)"?/);
  if (!m) throw new Error("private_key not found in move/.aptos/config.yaml");
  return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(m[1]) });
}

const key = apiKey();
const account = loadDeployer();
const address = account.accountAddress.toString();
console.log(`curator=${address}`);
console.log(`api key: ${key ? "present" : "none (anonymous)"}\n`);

// The installed SDK still defaults to an older shelbynet deployer, so the
// current contract address has to be passed explicitly or `blob_metadata`
// resolves to a dead account.
const SHELBY_DEPLOYER =
  "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";

const client = new ShelbyNodeClient({
  network: Network.SHELBYNET,
  apiKey: key,
  deployer: AccountAddress.from(SHELBY_DEPLOYER),
  rpc: { baseUrl: "https://api.shelbynet.shelby.xyz/shelby", apiKey: key },
});

// 1 APT + 5 ShelbyUSD is far more than 21 blobs of ~250 bytes each need.
const APT_AMOUNT = 100_000_000;
const SUSD_AMOUNT = 500_000_000;

try {
  const hash = await client.fundAccountWithAPT({ address, amount: APT_AMOUNT });
  console.log(`APT funded: ${hash}`);
} catch (err) {
  console.log(`APT fund failed: ${err instanceof Error ? err.message : err}`);
}

try {
  const hash = await client.fundAccountWithShelbyUSD({ address, amount: SUSD_AMOUNT });
  console.log(`ShelbyUSD funded: ${hash}`);
} catch (err) {
  console.log(`ShelbyUSD fund failed: ${err instanceof Error ? err.message : err}`);
  if (err?.cause) console.log(`  cause: ${JSON.stringify(err.cause).slice(0, 400)}`);
}

// Shelby refuses writes until the account picks a storage location. Only
// `shelbynet-1` is activated today; the preference is a one-time on-chain flag.
const LOCATION = process.env.SHELBY_LOCATION?.trim() || "shelbynet-1";
try {
  const aptos = new Aptos(
    new AptosConfig({
      network: Network.SHELBYNET,
      fullnode: "https://api.shelbynet.shelby.xyz/v1",
      ...(key ? { clientConfig: { API_KEY: key } } : {}),
    }),
  );
  const current = await aptos
    .view({
      payload: {
        function: `${SHELBY_DEPLOYER}::location_preference::get_location_preference`,
        functionArguments: [address],
      },
    })
    .catch(() => null);
  console.log(`location preference before: ${JSON.stringify(current)}`);

  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${SHELBY_DEPLOYER}::location_preference::set_default_location_preference`,
      functionArguments: [LOCATION],
    },
  });
  const pending = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
  const res = await aptos.waitForTransaction({ transactionHash: pending.hash });
  console.log(`location set to ${LOCATION}: ${res.success ? "ok" : res.vm_status}`);
} catch (err) {
  console.log(`location set failed: ${err instanceof Error ? err.message : err}`);
}

// Round-trip a throwaway blob so a failure here is unambiguous.
const probeName = `shelby-sudoku-probe-${Date.now()}`;
const probeData = new TextEncoder().encode("sudoku-shelby upload probe");
try {
  await client.upload({
    blobData: probeData,
    signer: account,
    blobName: probeName,
    expirationMicros: (Date.now() + 1000 * 60 * 60 * 24) * 1000,
  });
  console.log(`\nupload ok: ${probeName}`);
  const blob = await client.download({ account: address, blobName: probeName });
  const chunks = [];
  const reader = blob.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const len = chunks.reduce((n, c) => n + c.length, 0);
  const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
  console.log(`download ok: ${len} bytes (contentLength=${blob.contentLength}) "${text}"`);
} catch (err) {
  console.log(`\nupload/download failed: ${err instanceof Error ? err.message : err}`);
  if (err?.stack) console.log(err.stack.split("\n").slice(0, 6).join("\n"));
}
