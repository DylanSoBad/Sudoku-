"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet, type InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { encodePuzzleBlob } from "@/lib/blob-layout";
import { getShelbyClient } from "@/lib/shelby";
import { economicsForLevel } from "@/lib/tokenomics";
import { generatePuzzle, fnv1a } from "@/lib/sudoku";
import { registryAddress, waitForTxSuccess } from "@/lib/aptos";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function toHexBytes(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  return `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function CuratorPanel() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [level, setLevel] = useState(1);
  const [busy, setBusy] = useState<null | "upload" | "register">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadTxHash, setUploadTxHash] = useState<string | null>(null);
  const [registerTxHash, setRegisterTxHash] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<string | null>(null);

  const preview = useMemo(() => {
    const econ = economicsForLevel(level);
    const { puzzle, solution } = generatePuzzle(level, fnv1a(level + ":" + todayUTC()));
    return encodePuzzleBlob({
      level,
      difficulty: econ.difficulty,
      hintCost: econ.hintCost,
      reward: econ.reward,
      puzzle,
      solution,
      ts: Date.now(),
    });
  }, [level]);

  useEffect(() => {
    setStatus(null);
    setError(null);
    setUploadTxHash(null);
    setRegisterTxHash(null);
    setCommitment(null);
  }, [level]);

  async function uploadBlob() {
    if (!account?.address) {
      setError("Connect wallet");
      return;
    }
    setBusy("upload");
    setError(null);
    try {
      const client = await getShelbyClient();
      if (!client) throw new Error("Shelby SDK unavailable");
      // 1. calculate a small commitment (full blob as hex bytes) so the
      //    on-chain registry can reference the exact blob the player will
      //    fetch.
      const blobName = `shelby-sudoku-level-${level}`;
      const commitHex = toHexBytes(preview);

      await client.upload({
        account: account.address,
        blobName,
        bytes: preview,
      });
      setCommitment(commitHex);
      setStatus("uploaded");

      // Auto-fire registry::register_puzzle on-chain.
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
          functionArguments: [level, blobName, commitHex],
        },
      };
      const pending = await signAndSubmitTransaction(payload);
      await waitForTxSuccess(pending.hash);
      setRegisterTxHash(pending.hash);
      setStatus("registered");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Curator</h1>
        <p className="text-sm text-shelby-muted">
          Generate a fresh puzzle blob, upload to Shelby, and register on-chain via
          <code className="ml-1 font-mono">registry::register_puzzle</code>.
        </p>
      </header>

      <section className="rounded-xl border border-shelby-border bg-shelby-surface p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-shelby-muted">
          1. Generate
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-sm">Level</label>
          <Input
            type="number"
            min={1}
            max={20}
            value={level}
            onChange={(e) => setLevel(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            className="w-20"
          />
          <span className="text-xs text-shelby-muted">
            blob size: {preview.length} bytes
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-shelby-border bg-shelby-surface p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-shelby-muted">
          2. Upload + Register
        </h2>
        <p className="mb-2 text-xs text-shelby-muted">
          Uploads to Shelby and auto-signs the on-chain registry tx.
        </p>
        <Button onClick={uploadBlob} disabled={busy !== null || !account}>
          {busy === "upload"
            ? "Uploading…"
            : busy === "register"
              ? "Signing registry tx…"
              : "Upload + Register"}
        </Button>
        {commitment && (
          <p className="mt-2 break-all text-xs text-shelby-muted">commitment: {commitment}</p>
        )}
        {uploadTxHash && (
          <a
            className="mt-2 block break-all text-xs text-shelby-accent2 underline"
            href={`https://explorer.aptoslabs.com/txn/${uploadTxHash}?network=testnet`}
            target="_blank"
            rel="noreferrer"
          >
            Shelby upload tx: {uploadTxHash}
          </a>
        )}
        {registerTxHash && (
          <a
            className="mt-2 block break-all text-xs text-shelby-accent2 underline"
            href={`https://explorer.aptoslabs.com/txn/${registerTxHash}?network=testnet`}
            target="_blank"
            rel="noreferrer"
          >
            Registry tx: {registerTxHash}
          </a>
        )}
      </section>

      {status && (
        <div className="rounded-lg border border-shelby-success/30 bg-shelby-success/10 px-3 py-2 text-sm text-shelby-success">
          {status}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-shelby-danger/30 bg-shelby-danger/10 px-3 py-2 text-sm text-shelby-danger">
          {error}
        </div>
      )}
    </main>
  );
}
