/**
 * Generate the Ed25519 keypair that signs claim tickets.
 *
 *   node scripts/gen-claim-signer.mjs [--force]
 *
 * Writes CLAIM_SIGNER_PRIVATE_KEY into .env.local (gitignored) and prints only
 * the public key — that is the half you register on-chain with
 * `rewards::set_verifier` / `rewards::init_claim_guard`.
 *
 * The private key is never printed: copy it out of .env.local when adding it to
 * the hosting provider's environment.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env.local");
const KEY_NAME = "CLAIM_SIGNER_PRIVATE_KEY";
const force = process.argv.includes("--force");

const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
if (existing.includes(`${KEY_NAME}=`) && !force) {
  console.error(
    `${KEY_NAME} already present in .env.local — pass --force to replace it ` +
      `(you must then re-run rewards::set_verifier with the new public key).`,
  );
  process.exit(1);
}

const key = Ed25519PrivateKey.generate();
const publicKeyHex = key.publicKey().toString();

const line = `${KEY_NAME}=${key.toString()}`;
const withoutOld = existing
  .split(/\r?\n/)
  .filter((l) => !l.startsWith(`${KEY_NAME}=`))
  .join("\n")
  .replace(/\n+$/, "");
const next = withoutOld
  ? `${withoutOld}\n\n# Signs /api/claim-ticket payouts. Public half is on-chain in ClaimGuard.\n${line}\n`
  : `${line}\n`;
writeFileSync(ENV_PATH, next, { encoding: "utf8", mode: 0o600 });

console.log("Wrote CLAIM_SIGNER_PRIVATE_KEY to .env.local (not printed here).");
console.log(`verifier public key: ${publicKeyHex}`);
