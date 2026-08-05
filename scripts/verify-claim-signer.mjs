/**
 * Check that the local claim signer matches the verifier key registered in
 * `rewards::ClaimGuard`, and that the signed byte layout is what Move expects.
 *
 *   node scripts/verify-claim-signer.mjs
 *
 * Signs a throwaway ticket with CLAIM_SIGNER_PRIVATE_KEY and asks the fullnode
 * to run the free `rewards::verify_claim_ticket` view over it. `true` means
 * `/api/claim-ticket` tickets will be accepted by `claim_with_proof`.
 */
import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AccountAddress,
  Ed25519PrivateKey,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const path = join(ROOT, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

loadEnv();

const rawKey = process.env.CLAIM_SIGNER_PRIVATE_KEY?.trim();
if (!rawKey) {
  console.error("CLAIM_SIGNER_PRIVATE_KEY missing — run scripts/gen-claim-signer.mjs");
  process.exit(1);
}
const moduleAddress = process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim();
if (!moduleAddress) {
  console.error("NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS missing");
  process.exit(1);
}

const network = process.env.NEXT_PUBLIC_APTOS_NETWORK?.trim() || "testnet";
const nodeUrl = `https://api.${network}.aptoslabs.com/v1/view`;

const key = new Ed25519PrivateKey(
  PrivateKey.formatPrivateKey(rawKey, PrivateKeyVariants.Ed25519),
);

function u64le(value) {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, value, true);
  return buf;
}

const player = moduleAddress;
const level = 1n;
const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 300);
const nonce = BigInt(`0x${randomBytes(8).toString("hex")}`) & 0x7fffffffffffffffn;

const message = Buffer.concat([
  Buffer.from("SUDOKU_CLAIM_V1", "utf8"),
  Buffer.from(AccountAddress.from(player).toUint8Array()),
  Buffer.from(u64le(level)),
  Buffer.from(u64le(expiresAt)),
  Buffer.from(u64le(nonce)),
]);
const signature = key.sign(new Uint8Array(message)).toString();

const res = await fetch(nodeUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    function: `${moduleAddress}::rewards::verify_claim_ticket`,
    type_arguments: [],
    arguments: [
      player,
      level.toString(),
      expiresAt.toString(),
      nonce.toString(),
      signature,
    ],
  }),
});

const body = await res.json();
if (!res.ok) {
  console.error("view call failed:", JSON.stringify(body));
  process.exit(1);
}

const ok = Array.isArray(body) && body[0] === true;
console.log(`verifier public key: ${key.publicKey().toString()}`);
console.log(`on-chain verify_claim_ticket -> ${ok}`);
if (!ok) {
  console.error(
    "Signer does not match ClaimGuard.verifier (or the layout differs). " +
      "Re-run rewards::set_verifier with the public key above.",
  );
  process.exit(1);
}
