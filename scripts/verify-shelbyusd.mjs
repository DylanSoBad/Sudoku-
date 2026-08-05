/**
 * Confirm the shelbyUSD the dApp charges/pays is the official Shelby token and
 * not a look-alike minted by this project.
 *
 * Compares the configured addresses against the SDK's own constants and reads
 * the fungible asset metadata off both networks.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SHELBYUSD_FA_METADATA_ADDRESS,
  SHELBYUSD_TOKEN_ADDRESS,
  SHELBYUSD_TOKEN_MODULE,
  SHELBYUSD_TOKEN_NAME,
  TOKEN_DEPLOYER,
} from "@shelby-protocol/sdk/node";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  const p = join(ROOT, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const configuredToken = process.env.NEXT_PUBLIC_SHELBY_USD_MODULE?.trim();
const configuredMeta = process.env.NEXT_PUBLIC_SHELBYUSD_FA_METADATA?.trim();

console.log("=== official constants from @shelby-protocol/sdk ===");
console.log(`token name      ${SHELBYUSD_TOKEN_NAME}`);
console.log(`token module    ${SHELBYUSD_TOKEN_MODULE}`);
console.log(`token address   ${SHELBYUSD_TOKEN_ADDRESS}`);
console.log(`FA metadata     ${SHELBYUSD_FA_METADATA_ADDRESS}`);
console.log(`token deployer  ${TOKEN_DEPLOYER}`);

console.log("\n=== this dApp's configuration ===");
const tokenMatch = configuredToken?.toLowerCase() === SHELBYUSD_TOKEN_ADDRESS.toLowerCase();
const metaMatch = configuredMeta?.toLowerCase() === SHELBYUSD_FA_METADATA_ADDRESS.toLowerCase();
console.log(`token address   ${configuredToken} ${tokenMatch ? "MATCH" : "MISMATCH"}`);
console.log(`FA metadata     ${configuredMeta} ${metaMatch ? "MATCH" : "MISMATCH"}`);

const NETS = [
  ["shelbynet", "https://api.shelbynet.shelby.xyz/v1"],
  ["testnet", "https://api.testnet.aptoslabs.com/v1"],
];

console.log("\n=== on-chain fungible asset metadata ===");
for (const [label, base] of NETS) {
  try {
    const res = await fetch(
      `${base}/accounts/${SHELBYUSD_FA_METADATA_ADDRESS}/resource/0x1::fungible_asset::Metadata`,
    );
    if (!res.ok) {
      console.log(`${label.padEnd(10)} ${res.status} (metadata object absent)`);
      continue;
    }
    const json = await res.json();
    const d = json.data ?? {};
    console.log(
      `${label.padEnd(10)} name="${d.name}" symbol="${d.symbol}" decimals=${d.decimals}`,
    );
  } catch (err) {
    console.log(`${label.padEnd(10)} ERR ${err instanceof Error ? err.message : err}`);
  }
}

// If this project held mint rights the in-game economy would be self-printed,
// which is the substantive sense in which a token could be called "fake".
console.log("\n=== who controls minting ===");
const ourDeployer = process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim();
for (const [label, base] of NETS) {
  try {
    const res = await fetch(`${base}/view`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        function: `${SHELBYUSD_TOKEN_ADDRESS}::${SHELBYUSD_TOKEN_MODULE}::admin`,
        type_arguments: [],
        arguments: [],
      }),
    });
    const json = await res.json();
    const admin = Array.isArray(json) ? String(json[0]) : JSON.stringify(json);
    const isUs = ourDeployer && admin.toLowerCase() === ourDeployer.toLowerCase();
    console.log(`${label.padEnd(10)} admin=${admin} ${isUs ? "<-- THIS PROJECT" : "(not this project)"}`);
  } catch (err) {
    console.log(`${label.padEnd(10)} ERR ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`our deployer   ${ourDeployer}`);

console.log("\n=== who published the shelby_usd module ===");
for (const [label, base] of NETS) {
  const res = await fetch(
    `${base}/accounts/${SHELBYUSD_TOKEN_ADDRESS}/module/${SHELBYUSD_TOKEN_MODULE}`,
  ).catch(() => null);
  if (!res || !res.ok) {
    console.log(`${label.padEnd(10)} module not found`);
    continue;
  }
  const json = await res.json();
  const fns = (json?.abi?.exposed_functions ?? []).map((f) => f.name).join(", ");
  console.log(`${label.padEnd(10)} module present, functions: ${fns}`);
}
