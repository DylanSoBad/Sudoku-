"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet, type InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { encodePuzzleBlob } from "@/lib/blob-layout";
import { getShelbyClient } from "@/lib/shelby";
import {
  economicsForLevel,
  HINT_COST_SUSD,
  REWARD_PER_LEVEL_SUSD,
} from "@/lib/tokenomics";
import { generatePuzzle, fnv1a } from "@/lib/sudoku";
import { registryAddress, waitForTxSuccess } from "@/lib/aptos";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function toHexBytes(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  return `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Hex dump, 16 bytes per row, so the preview stays readable in a textarea. */
function hexDump(bytes: Uint8Array, maxRows = 24): string {
  const rows: string[] = [];
  for (let i = 0; i < bytes.length && rows.length < maxRows; i += 16) {
    const slice = Array.from(bytes.slice(i, i + 16));
    rows.push(
      `${i.toString(16).padStart(6, "0")}  ${slice
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")}`,
    );
  }
  if (bytes.length > maxRows * 16) rows.push(`... ${bytes.length - maxRows * 16} more bytes`);
  return rows.join("\n");
}

export function CuratorPanel() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [level, setLevel] = useState(1);
  const [busy, setBusy] = useState<null | "upload" | "register">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blobName, setBlobName] = useState<string | null>(null);
  const [registerTxHash, setRegisterTxHash] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<string | null>(null);

  const econ = useMemo(() => economicsForLevel(level), [level]);

  const preview = useMemo(() => {
    const { puzzle, solution } = generatePuzzle(level, fnv1a(level + ":" + todayUTC()));
    return encodePuzzleBlob({
      level,
      difficulty: econ.difficulty,
      hintCost: HINT_COST_SUSD,
      reward: REWARD_PER_LEVEL_SUSD,
      puzzle,
      solution,
      ts: Date.now(),
    });
  }, [level, econ.difficulty]);

  const headerJson = useMemo(
    () =>
      JSON.stringify(
        {
          level,
          difficulty: econ.difficulty,
          empties: econ.empties,
          hintCost: HINT_COST_SUSD,
          reward: REWARD_PER_LEVEL_SUSD,
          bytes: preview.length,
        },
        null,
        2,
      ),
    [level, econ, preview.length],
  );

  useEffect(() => {
    setStatus(null);
    setError(null);
    setBlobName(null);
    setRegisterTxHash(null);
    setCommitment(null);
  }, [level]);

  async function uploadBlob() {
    if (!account?.address) {
      setError("Connect a wallet first");
      return;
    }
    setBusy("upload");
    setError(null);
    try {
      const client = await getShelbyClient();
      if (!client) throw new Error("Shelby SDK unavailable");
      // A hex commitment of the exact bytes so the on-chain registry can pin
      // the blob a player will later fetch.
      const name = `shelby-sudoku-level-${level}`;
      const commitHex = toHexBytes(preview);

      await client.upload({ account: account.address, blobName: name, bytes: preview });
      setBlobName(name);
      setCommitment(commitHex);
      setStatus("Uploaded to Shelby");

      const registry = registryAddress();
      if (!registry) {
        setError("Upload succeeded but NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS is empty");
        return;
      }
      setBusy("register");
      const payload: InputTransactionData = {
        data: {
          function: `${registry}::registry::register_puzzle`,
          typeArguments: [],
          functionArguments: [level, name, commitHex],
        },
      };
      const pending = await signAndSubmitTransaction(payload);
      await waitForTxSuccess(pending.hash);
      setRegisterTxHash(pending.hash);
      setStatus("Registered on-chain");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-content">Curator</h1>
        <p className="text-sm text-content-muted">
          Generate a puzzle blob, upload it to Shelby, and register it via{" "}
          <code className="font-mono text-content">registry::register_puzzle</code>.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-content-muted">
            Blob preview
          </h2>
          <textarea
            readOnly
            aria-label="Blob header JSON"
            value={headerJson}
            rows={8}
            className="w-full resize-none rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs text-content-muted outline-none"
          />
          <textarea
            readOnly
            aria-label="Blob bytes hex dump"
            value={hexDump(preview)}
            rows={16}
            className="w-full resize-none rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs text-content-muted outline-none"
          />
        </section>

        <aside className="flex h-fit flex-col gap-4 rounded-lg border border-line bg-surface p-4">
          <div className="space-y-2">
            <label htmlFor="curator-level" className="block text-xs uppercase tracking-wide text-content-muted">
              Level
            </label>
            <Input
              id="curator-level"
              type="number"
              min={1}
              max={20}
              value={level}
              onChange={(e) => setLevel(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="w-full font-mono"
            />
            <p className="font-mono text-[11px] text-content-subtle">
              {econ.difficulty} · {econ.empties} empty · {preview.length} bytes
            </p>
          </div>

          <Button onClick={uploadBlob} disabled={busy !== null || !account} className="w-full">
            {busy === "upload"
              ? "Uploading"
              : busy === "register"
                ? "Signing registry tx"
                : "Upload and register"}
          </Button>

          {status && <p className="text-xs text-content-muted">{status}</p>}
          {error && <p className="break-all text-xs text-danger">{error}</p>}

          {blobName && (
            <p className="break-all font-mono text-[11px] text-content-subtle">
              blob: {blobName}
            </p>
          )}
          {commitment && (
            <p className="break-all font-mono text-[11px] text-content-subtle">
              commitment: {commitment.slice(0, 34)}...
            </p>
          )}
          {registerTxHash && (
            <a
              className="break-all font-mono text-[11px] text-content-subtle transition-colors duration-100 hover:text-content-muted"
              href={`https://explorer.aptoslabs.com/txn/${registerTxHash}?network=testnet`}
              target="_blank"
              rel="noreferrer"
            >
              tx: {registerTxHash.slice(0, 10)}...{registerTxHash.slice(-6)}
            </a>
          )}
        </aside>
      </div>
    </main>
  );
}
