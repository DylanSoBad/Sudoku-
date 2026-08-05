/**
 * Generate curated puzzle blobs for levels 1–20 + today's daily, write them to
 * public/puzzles/ (same-origin mirror), and register campaign levels on-chain.
 *
 * Blob names and seeds match lib/fetcher.ts:
 *   name: shelby-sudoku-level-{n} | shelby-sudoku-daily-{YYYYMMDD}
 *   seed: fnv1a(`${level}-${YYYYMMDD}`)
 *
 * Usage (from repo root):
 *   node scripts/seed-puzzles.mjs
 *   node scripts/seed-puzzles.mjs --daily-only
 *   node scripts/seed-puzzles.mjs --levels 1,2,3
 *
 * Requires move/.aptos/config.yaml profile `sudoku` for registry txs.
 * Optional: NEXT_PUBLIC_SHELBY_API_KEY (or SHELBY_API_KEY) for Shelby upload.
 * Shelby upload also needs APT + shelbyUSD on the deployer for gas/storage.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  Account,
  AccountAddress,
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

const SHELBY_RPC = "https://api.shelbynet.shelby.xyz/shelby";
const SHELBY_INDEXER =
  "https://api.shelbynet.aptoslabs.com/nocode/v1/public/cmforrguw0042s601fn71f9l2/v1/graphql";
const SHELBY_FULLNODE = "https://api.shelbynet.shelby.xyz/v1";
// Keep in sync with lib/shelby-blob.ts (scripts cannot import the TS module).
const SHELBY_DEPLOYER =
  "0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a";
const SHELBY_LOCATION = "shelbynet-1";

function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const p = join(ROOT, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key || process.env[key] !== undefined) continue;
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

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

function parseLevels(argv) {
  if (argv.includes("--daily-only")) return [0];
  const idx = argv.indexOf("--levels");
  if (idx >= 0 && argv[idx + 1]) {
    return argv[idx + 1]
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 20);
  }
  return [...Array.from({ length: 20 }, (_, i) => i + 1), 0];
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

/**
 * Shelby refuses writes until the account has picked a storage location, and
 * shelbynet is wiped roughly weekly — which drops the preference along with
 * everything else. Re-assert it on every run so a wipe does not silently turn
 * every upload into a mirror-only seed.
 */
async function ensureShelbyLocation(account) {
  const address = account.accountAddress.toString();
  const aptos = new Aptos(
    new AptosConfig({
      network: Network.SHELBYNET ?? "shelbynet",
      fullnode: SHELBY_FULLNODE,
    }),
  );
  try {
    const out = await aptos.view({
      payload: {
        function: `${SHELBY_DEPLOYER}::location_preference::get_location_preference`,
        functionArguments: [address],
      },
    });
    const vec = out?.[0]?.vec;
    if (Array.isArray(vec) && vec.length > 0) return true;
  } catch {
    // Fall through and try to set it; a failed read is not proof of absence.
  }

  try {
    const tx = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${SHELBY_DEPLOYER}::location_preference::set_default_location_preference`,
        functionArguments: [SHELBY_LOCATION],
      },
    });
    const pending = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
    const res = await aptos.waitForTransaction({ transactionHash: pending.hash });
    console.log(`shelby location=${SHELBY_LOCATION} ${res.success ? "set" : res.vm_status}`);
    return res.success;
  } catch (err) {
    console.warn(
      "  shelby location setup failed:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

function shelbyApiKey() {
  const raw = (
    process.env.SHELBY_API_KEY ||
    process.env.NEXT_PUBLIC_SHELBY_API_KEY ||
    ""
  ).trim();
  if (!raw || /YOUR_KEY|changeme|placeholder/i.test(raw)) return null;
  return raw;
}

async function tryShelbyUpload(account, name, bytes) {
  // Shelbynet accepts anonymous requests (lower rate limits), so a missing key
  // is not a reason to skip the upload — seeding 21 blobs stays well inside
  // the anonymous budget. A key only raises the ceiling.
  const apiKey = shelbyApiKey() ?? undefined;
  if (!apiKey) {
    console.log("  shelby: no API key, uploading anonymously");
  }
  try {
    const mod = await import("@shelby-protocol/sdk/node");
    const Client = mod.ShelbyNodeClient ?? mod.ShelbyClient;
    if (!Client) {
      console.warn("  shelby upload skipped: ShelbyNodeClient missing");
      return false;
    }

    // Prefer Network.SHELBYNET when the Aptos SDK exposes it; otherwise pin
    // shelbynet RPC/indexer endpoints explicitly (needed on ts-sdk < 5).
    const network =
      Network.SHELBYNET ??
      /** @type {typeof Network.TESTNET} */ ("shelbynet");
    const client = new Client({
      network,
      apiKey,
      // The SDK's default deployer trails shelbynet redeployments, which shows
      // up as "Module not found … blob_metadata".
      deployer: AccountAddress.from(SHELBY_DEPLOYER),
      rpc: { baseUrl: SHELBY_RPC, apiKey },
      indexer: { baseUrl: SHELBY_INDEXER, apiKey },
    });

    const blobData = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const expirationMicros = (Date.now() + 1000 * 60 * 60 * 24 * 90) * 1000;

    if (typeof client.upload !== "function") {
      console.warn("  shelby upload skipped: client.upload missing");
      return false;
    }

    await client.upload({ blobData, signer: account, blobName: name, expirationMicros });
    console.log("  shelby upload ok");
    return true;
  } catch (err) {
    console.warn("  shelby upload failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

async function main() {
  loadEnvFiles();
  const date = todayUTC();
  const levels = parseLevels(process.argv.slice(2));
  mkdirSync(OUT, { recursive: true });
  console.log(`date=${date} out=${OUT} levels=${levels.join(",")}`);

  const account = loadDeployer();
  const addr = account.accountAddress.toString();
  console.log(`deployer=${addr}`);

  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

  await ensureShelbyLocation(account);
  // Re-uploading after a shelbynet wipe does not need new registry entries,
  // and re-registering an existing level just aborts.
  const skipRegister = process.argv.includes("--no-register");

  for (const level of levels) {
    const built = buildLevel(level, date);
    const name = built.name;
    const path = join(OUT, name);

    // `buildLevel` stamps the current time into the blob, so rebuilding yields
    // different bytes every run. On a re-upload that would invalidate the
    // commitment already registered on-chain, so replay the mirror instead.
    let bytes = built.bytes;
    let reused = false;
    if (skipRegister && existsSync(path)) {
      bytes = new Uint8Array(readFileSync(path));
      reused = true;
    } else {
      writeFileSync(path, bytes);
    }

    const sha = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    console.log(`\nlevel ${level}: ${name} (${bytes.length} bytes, sha256=${sha}…)`);
    console.log(reused ? `  reusing ${path}` : `  wrote ${path}`);

    await tryShelbyUpload(account, name, bytes);

    if (level >= 1 && !skipRegister) {
      try {
        const hash = await registerPuzzle(aptos, account, level, name, bytes);
        console.log(`  registered tx=${hash}`);
      } catch (err) {
        console.error(`  register failed:`, err instanceof Error ? err.message : err);
      }
    } else if (level === 0) {
      console.log("  daily: shelby/public only (no registry entry)");
    }
  }

  console.log("\ndone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
