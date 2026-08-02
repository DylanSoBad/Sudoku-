"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { encodePuzzleBlob } from "@/lib/blob-layout";
import { getShelbyClient, getRegisterClient } from "@/lib/shelby";
import { economicsForLevel } from "@/lib/tokenomics";
import { generatePuzzle, fnv1a } from "@/lib/sudoku";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

export function CuratorPanel() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [level, setLevel] = useState(1);
  const [busy, setBusy] = useState<null | "upload" | "register">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
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
    setHash(null);
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
      await client.upload({
        account: account.address,
        blobName: `shelby-sudoku-level-${level}`,
        bytes: preview,
      });
      setStatus("uploaded");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function register() {
    if (!account?.address) {
      setError("Connect wallet");
      return;
    }
    setBusy("register");
    setError(null);
    try {
      const reg = await getRegisterClient();
      if (!reg?.registerPayload) throw new Error("register client unavailable");
      const payload = await reg.registerPayload({
        account: account.address,
        blobName: `shelby-sudoku-level-${level}`,
        blobBytes: preview,
      });
      const tx = await signAndSubmitTransaction({ data: payload as never });
      setHash(tx.hash);
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
          Generate a fresh puzzle blob, upload to Shelby, and register on-chain.
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
          2. Upload
        </h2>
        <Button onClick={uploadBlob} disabled={busy !== null || !account}>
          {busy === "upload" ? "Uploading…" : "Upload to Shelby"}
        </Button>
      </section>

      <section className="rounded-xl border border-shelby-border bg-shelby-surface p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-shelby-muted">
          3. Register
        </h2>
        <p className="mb-2 text-xs text-shelby-muted">
          Calls <code className="font-mono">blob_metadata::register_blob</code> on Aptos testnet.
        </p>
        <Button onClick={register} disabled={busy !== null || !account}>
          {busy === "register" ? "Signing…" : "Register on-chain"}
        </Button>
        {commitment && (
          <p className="mt-2 break-all text-xs text-shelby-muted">commitments: {commitment}</p>
        )}
        {hash && (
          <a
            className="mt-2 block break-all text-xs text-shelby-accent2 underline"
            href={`https://explorer.aptoslabs.com/txn/${hash}?network=testnet`}
            target="_blank"
            rel="noreferrer"
          >
            tx: {hash}
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