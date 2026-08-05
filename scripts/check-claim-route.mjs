/**
 * Smoke-test /api/claim-ticket against a running server.
 *
 *   npm run dev
 *   node scripts/check-claim-route.mjs [--base http://localhost:3000] [--level 1]
 *
 * Replays the curated blob's own solution (expect 200 + a ticket) plus four
 * rejection cases, so a regression that starts signing unverified grids fails
 * loudly here instead of on the treasury.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const base = arg("base", "http://localhost:3000").replace(/\/$/, "");
const level = Number(arg("level", "1"));
const address =
  process.env.CHECK_ADDRESS ??
  "0x071a8a3d2ca013623dba02737a3824d898756eddad5f991aa55d2155c45fa20a";

const blob = readFileSync(join(ROOT, "public", "puzzles", `shelby-sudoku-level-${level}`));
const cells = blob.subarray(blob.indexOf(0x0a) + 1);
const puzzle = Array.from(cells.subarray(0, 81));
const solution = Array.from(cells.subarray(81, 162));

let issuedTicket = null;

async function post(label, payload, expected) {
  const res = await fetch(`${base}/api/claim-ticket`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  const ok = res.status === expected;
  if (res.status === 200 && json?.signature) issuedTicket = json;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label.padEnd(16)} ${res.status} (want ${expected}) ` +
      `${JSON.stringify(json).slice(0, 120)}`,
  );
  return ok;
}

/**
 * The signed ticket is only worth anything if `ClaimGuard.verifier` accepts it,
 * so replay it through the free view before trusting the endpoint.
 */
async function verifyOnChain(ticket) {
  const moduleAddress = process.env.NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS?.trim();
  if (!moduleAddress || !ticket) {
    console.log("SKIP  chain verify     (no module address or no ticket)");
    return true;
  }
  const network = process.env.NEXT_PUBLIC_APTOS_NETWORK?.trim() || "testnet";
  const res = await fetch(`https://api.${network}.aptoslabs.com/v1/view`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      function: `${moduleAddress}::rewards::verify_claim_ticket`,
      type_arguments: [],
      arguments: [
        address,
        String(ticket.level),
        String(ticket.expiresAt),
        ticket.nonce,
        ticket.signature,
      ],
    }),
  });
  const body = await res.json().catch(() => null);
  const ok = res.ok && Array.isArray(body) && body[0] === true;
  console.log(
    `${ok ? "PASS" : "FAIL"}  chain verify     ${JSON.stringify(body).slice(0, 120)}`,
  );
  return ok;
}

const tampered = solution.slice();
tampered[0] = tampered[0] === 9 ? 1 : tampered[0] + 1;
const otherLevel = level === 1 ? 2 : 1;

const results = [
  await post("valid solve", { address, level, board: solution, elapsedMs: 40_000 }, 200),
  await post("too fast", { address, level, board: solution, elapsedMs: 500 }, 400),
  await post("tampered grid", { address, level, board: tampered, elapsedMs: 40_000 }, 400),
  await post("unsolved grid", { address, level, board: puzzle, elapsedMs: 40_000 }, 400),
  await post(
    "wrong level",
    { address, level: otherLevel, board: solution, elapsedMs: 40_000 },
    400,
  ),
  await verifyOnChain(issuedTicket),
];

if (results.some((r) => !r)) process.exit(1);
console.log("all claim-ticket checks passed");
