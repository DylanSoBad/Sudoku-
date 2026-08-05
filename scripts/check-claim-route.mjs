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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

async function post(label, payload, expected) {
  const res = await fetch(`${base}/api/claim-ticket`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  const ok = res.status === expected;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label.padEnd(16)} ${res.status} (want ${expected}) ` +
      `${JSON.stringify(json).slice(0, 120)}`,
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
];

if (results.some((r) => !r)) process.exit(1);
console.log("all claim-ticket checks passed");
