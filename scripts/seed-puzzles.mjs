/**
 * Generate curated puzzle blobs for levels 1–3 + today's daily, write them to
 * public/puzzles/ (same-origin mirror), and register levels 1–3 on-chain.
 *
 * Blob names and seeds match lib/fetcher.ts:
 *   name: shelby-sudoku-level-{n} | shelby-sudoku-daily-{YYYYMMDD}
 *   seed: fnv1a(`${level}-${YYYYMMDD}`)
 *
 * Usage (from repo root):
 *   node --experimental-strip-types scripts/seed-puzzles.mjs
 *
 * Requires move/.aptos/config.yaml profile `sudoku` for registry txs.
 * Optional: NEXT_PUBLIC_SHELBY_API_KEY for a real Shelby upload attempt.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  Account,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  Network,
} from "@aptos-labs/ts-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const REG =
  "0x071a8a3d2ca013623dba02737a3824d898756eddad5f991aa55d2155c45fa20a";
const OUT = join(ROOT, "public", "puzzles");

const REWARD = 0.01;
const HINT = 0.0005;

function todayUTC() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptiesFor(level) {
  if (level <= 3) return 36;
  if (level <= 6) return 44;
  if (level <= 10) return 50;
  if (level <= 14) return 55;
  return 60;
}

function difficultyFor(level) {
  if (level <= 3) return "easy";
  if (level <= 6) return "medium";
  if (level <= 10) return "hard";
  if (level <= 14) return "expert";
  return "master";
}

function generateFullSolution(seed) {
  const rng = mulberry32(seed);
  const board = Array(81).fill(0);
  const row = Array.from({ length: 9 }, () => 0);
  const col = Array.from({ length: 9 }, () => 0);
  const box = Array.from({ length: 9 }, () => 0);

  function ok(i, d) {
    const r = (i / 9) | 0;
    const c = i % 9;
    const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    const bit = 1 << d;
    return !(row[r] & bit) && !(col[c] & bit) && !(box[b] & bit);
  }
  function place(i, d) {
    const r = (i / 9) | 0;
    const c = i % 9;
    const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    const bit = 1 << d;
    board[i] = d;
    row[r] |= bit;
    col[c] |= bit;
    box[b] |= bit;
  }
  function unplace(i, d) {
    const r = (i / 9) | 0;
    const c = i % 9;
    const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    const bit = 1 << d;
    board[i] = 0;
    row[r] &= ~bit;
    col[c] &= ~bit;
    box[b] &= ~bit;
  }
  function fill(i) {
    if (i === 81) return true;
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let k = digits.length - 1; k > 0; k--) {
      const j = (rng() * (k + 1)) | 0;
      [digits[k], digits[j]] = [digits[j], digits[k]];
    }
    for (const d of digits) {
      if (!ok(i, d)) continue;
      place(i, d);
      if (fill(i + 1)) return true;
      unplace(i, d);
    }
    return false;
  }
  if (!fill(0)) throw new Error("failed to generate solution");
  return board;
}

function carve(puzzle, empties, rng) {
  const order = Array.from({ length: 81 }, (_, i) => i);
  for (let k = order.length - 1; k > 0; k--) {
    const j = (rng() * (k + 1)) | 0;
    [order[k], order[j]] = [order[j], order[k]];
  }
  let removed = 0;
  const rowG = Array(9).fill(9);
  const colG = Array(9).fill(9);
  const boxG = Array(9).fill(9);
  for (const i of order) {
    if (removed >= empties) break;
    const r = (i / 9) | 0;
    const c = i % 9;
    const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    if (rowG[r] <= 1 || colG[c] <= 1 || boxG[b] <= 1) continue;
    puzzle[i] = 0;
    rowG[r]--;
    colG[c]--;
    boxG[b]--;
    removed++;
  }
  return removed;
}

function encodeBlob({ level, difficulty, puzzle, solution, ts }) {
  const header = JSON.stringify({
    level,
    difficulty,
    hintCost: HINT,
    reward: REWARD,
    ts,
  });
  const headerBytes = Buffer.from(header, "utf8");
  const cells = Buffer.alloc(162);
  for (let i = 0; i < 81; i++) cells[i] = puzzle[i] & 0xff;
  for (let i = 0; i < 81; i++) cells[81 + i] = solution[i] & 0xff;
  return Buffer.concat([headerBytes, Buffer.from([0x0a]), cells]);
}

function blobName(level, date) {
  if (level === 0) return `shelby-sudoku-daily-${date}`;
  return `shelby-sudoku-level-${level}`;
}

function buildLevel(level, date) {
  const seed = fnv1a(`${level}-${date}`);
  const solution = generateFullSolution(seed);
  const puzzle = solution.slice();
  const carveRng = mulberry32(fnv1a(`${level}|${seed}`));
  const target = level === 0 ? 36 : emptiesFor(level);
  carve(puzzle, target, carveRng);
  const bytes = encodeBlob({
    level,
    difficulty: level === 0 ? "easy" : difficultyFor(level),
    puzzle,
    solution,
    ts: Date.now(),
  });
  return { bytes, name: blobName(level, date) };
}

function loadDeployer() {
  const cfgPath = join(ROOT, "move", ".aptos", "config.yaml");
  const raw = readFileSync(cfgPath, "utf8");
  const keyMatch = raw.match(/private_key:\s*ed25519-priv-(0x[a-fA-F0-9]+)/);
  if (!keyMatch) throw new Error("private_key not found in move/.aptos/config.yaml");
  const pk = new Ed25519PrivateKey(keyMatch[1]);
  return Account.fromPrivateKey({ privateKey: pk });
}

async function registerPuzzle(aptos, account, level, name, bytes) {
  // Pass raw bytes — a hex string would be UTF-8-encoded into the vector.
  const commitment = Array.from(bytes);
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${REG}::registry::register_puzzle`,
      functionArguments: [level, name, commitment],
    },
  });
  const pending = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
  const res = await aptos.waitForTransaction({ transactionHash: pending.hash });
  if (!res.success) throw new Error(`register_puzzle failed: ${res.vm_status}`);
  return pending.hash;
}

async function tryShelbyUpload(accountAddr, name, bytes) {
  const apiKey = process.env.NEXT_PUBLIC_SHELBY_API_KEY?.trim();
  if (!apiKey || /YOUR_KEY|changeme|placeholder/i.test(apiKey)) {
    console.warn("  shelby upload skipped: NEXT_PUBLIC_SHELBY_API_KEY is placeholder/missing");
    return false;
  }
  try {
    const mod = await import("@shelby-protocol/sdk/node");
    const Client = mod.ShelbyBlobClient ?? mod.ShelbyClient;
    if (!Client) {
      console.warn("  shelby upload skipped: no ShelbyBlobClient in node SDK");
      return false;
    }
    const client = new Client({ apiKey, network: "shelbynet" });
    if (typeof client.upload === "function") {
      await client.upload({ account: accountAddr, blobName: name, data: bytes });
    } else if (typeof client.putBlob === "function") {
      await client.putBlob({ account: accountAddr, blobName: name, bytes });
    } else {
      console.warn("  shelby upload skipped: client has no upload/putBlob");
      return false;
    }
    console.log("  shelby upload ok");
    return true;
  } catch (err) {
    console.warn("  shelby upload failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

async function main() {
  const date = todayUTC();
  mkdirSync(OUT, { recursive: true });
  console.log(`date=${date} out=${OUT}`);

  const account = loadDeployer();
  const addr = account.accountAddress.toString();
  console.log(`deployer=${addr}`);

  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  const levels = [1, 2, 3, 0];
  for (const level of levels) {
    const { bytes, name } = buildLevel(level, date);
    const path = join(OUT, name);
    writeFileSync(path, bytes);
    const sha = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    console.log(`\nlevel ${level}: ${name} (${bytes.length} bytes, sha256=${sha}…)`);
    console.log(`  wrote ${path}`);

    await tryShelbyUpload(addr, name, bytes);

    if (level >= 1) {
      try {
        const hash = await registerPuzzle(aptos, account, level, name, bytes);
        console.log(`  registered tx=${hash}`);
      } catch (err) {
        console.error(`  register failed:`, err instanceof Error ? err.message : err);
      }
    } else {
      console.log("  daily: shelby/public only (no registry entry)");
    }
  }

  // Sanity: registry table item for level 1
  try {
    const res = await fetch(
      `https://api.testnet.aptoslabs.com/v1/accounts/${REG}/resource/${REG}::registry::Registry`,
    );
    const json = await res.json();
    const handle = json.data?.puzzles?.handle;
    if (handle) {
      const item = await fetch(
        `https://api.testnet.aptoslabs.com/v1/tables/${handle}/item`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key_type: "u64",
            value_type: `${REG}::registry::Puzzle`,
            key: "1",
          }),
        },
      );
      if (item.ok) {
        const puzzle = await item.json();
        console.log("\nregistry level 1:", JSON.stringify(puzzle));
      } else {
        console.warn("\nregistry level 1 still missing after seed");
      }
    }
  } catch (err) {
    console.warn("registry verify failed", err);
  }

  console.log("\ndone. public/puzzles mirror is live; Shelby upload needs a real API key.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
