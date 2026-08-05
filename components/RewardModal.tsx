"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { explorerTxUrl, formatMs } from "@/lib/utils";
import {
  DAILY_BONUS_MULT,
  MAX_LEVEL,
  REWARD_PER_LEVEL_SUSD,
} from "@/lib/tokenomics";
import { markCleared } from "@/lib/progress";
import { useRouter } from "next/navigation";
import type { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { registryAddress, waitForTxSuccess } from "@/lib/aptos";
import { awardMilestonesForLevel } from "@/lib/award-badges";
import { buildClaimWithProofPayload, type ClaimTicket } from "@/lib/contracts";
import { getAptBalance } from "@/lib/aptos";
import { findClaimBlocker } from "@/lib/rewards-status";
import { explainTxError } from "@/lib/tx-errors";
import { toast } from "sonner";

export interface RewardModalProps {
  open: boolean;
  onClose: () => void;
  level: number;
  ms: number;
  hints: number;
  /** Solved grid, submitted to the verifier to obtain a signed claim ticket. */
  board?: number[] | null;
  txHash?: string;
}

function isClaimTicket(v: unknown): v is ClaimTicket {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o["level"] === "number" &&
    typeof o["expiresAt"] === "number" &&
    typeof o["nonce"] === "string" &&
    typeof o["signature"] === "string"
  );
}

/**
 * Ask the verifier to sign a claim ticket for this solve. Returns null when the
 * server has no signer configured, which means the legacy unauthenticated
 * `rewards::claim` is still the intended path.
 */
async function requestTicket(
  address: string,
  level: number,
  board: number[],
  elapsedMs: number,
): Promise<ClaimTicket | null> {
  const res = await fetch("/api/claim-ticket", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, level, board, elapsedMs }),
  });
  if (res.status === 501) return null;
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof payload === "object" && payload !== null
        ? String((payload as Record<string, unknown>)["error"] ?? "")
        : "";
    throw new Error(message || `claim verification failed (${res.status})`);
  }
  if (!isClaimTicket(payload)) throw new Error("malformed claim ticket");
  return payload;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export function RewardModal({
  open,
  onClose,
  level,
  ms,
  hints,
  board,
  txHash,
}: RewardModalProps) {
  const router = useRouter();
  const { account, signAndSubmitTransaction } = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(Boolean(txHash));
  const [claimTxHash, setClaimTxHash] = useState<string | undefined>(txHash);
  const [claimError, setClaimError] = useState<string | undefined>(undefined);

  const registry = registryAddress();
  const isDaily = level === 0;
  const isLastLevel = !isDaily && level >= MAX_LEVEL;
  const rewardSusd = isDaily
    ? REWARD_PER_LEVEL_SUSD * DAILY_BONUS_MULT
    : REWARD_PER_LEVEL_SUSD;

  function goNext() {
    onClose();
    if (isDaily || isLastLevel) {
      router.push("/");
      return;
    }
    router.push(`/play/${level + 1}`);
  }

  async function handleClaimAndNext() {
    if (claimed) {
      goNext();
      return;
    }
    if (!account) {
      setClaimError("Connect a wallet to claim");
      return;
    }
    if (!registry) {
      setClaimError("NEXT_PUBLIC_PUZZLE_REGISTRY_ADDRESS is not set");
      return;
    }
    setClaiming(true);
    setClaimError(undefined);
    try {
      // Check gas and the treasury before the wallet prompt, so a doomed claim
      // fails with an explanation instead of a raw VM abort.
      const apt = await getAptBalance(account.address).catch(() => 1);
      const blocker = await findClaimBlocker(rewardSusd, apt);
      if (blocker) {
        setClaimError(`${blocker.title} — ${blocker.detail}`);
        return;
      }

      const ticket =
        board && board.length === 81
          ? await requestTicket(account.address, level, board, ms)
          : null;

      // Level 0 = daily (2x on-chain). Campaign levels 1–20 = flat 0.01.
      const txInput: InputTransactionData = ticket
        ? buildClaimWithProofPayload(ticket)
        : {
            data: {
              function: `${registry}::rewards::claim`,
              typeArguments: [],
              functionArguments: [level],
            },
          };
      const pending = await signAndSubmitTransaction(txInput);
      await waitForTxSuccess(pending.hash);
      setClaimed(true);
      setClaimTxHash(pending.hash);
      if (!isDaily) {
        await markCleared(account.address, level);
        const badges = await awardMilestonesForLevel(account.address, level, {
          signAndSubmitTransaction: async (payload) =>
            signAndSubmitTransaction(payload as InputTransactionData),
        });
        if (badges.length > 0) {
          toast.success(
            badges.length === 1
              ? `Badge unlocked: ${badges[0].name}`
              : `${badges.length} badges unlocked`,
          );
        }
      }
      window.dispatchEvent(new CustomEvent("shelby:balances"));
      goNext();
    } catch (e) {
      const friendly = explainTxError(e, "claim");
      setClaimError(`${friendly.title} — ${friendly.detail}`);
      console.warn("[claim]", friendly.raw);
    } finally {
      setClaiming(false);
    }
  }

  const title = isDaily ? "Daily challenge solved" : `Level ${pad2(level)} solved`;

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-5">
        <p className="-mt-2 font-mono text-xs text-content-muted">
          {formatMs(ms)} · {hints} hint{hints === 1 ? "" : "s"}
          {isDaily ? " · 2x daily bonus" : ""}
        </p>

        <div className="font-mono text-3xl text-accent-hover">
          +{rewardSusd.toFixed(3)} sUSD
        </div>

        {claimError && (
          <p className="text-xs text-danger">{claimError}</p>
        )}

        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => {
              onClose();
              router.push("/");
            }}
          >
            Back
          </Button>
          <Button className="flex-1" onClick={handleClaimAndNext} disabled={claiming}>
            {claiming ? "Claiming" : claimed ? (isDaily ? "Done" : "Next") : "Claim + Next"}
          </Button>
        </div>

        {claimTxHash && (
          <a
            className="font-mono text-xs text-content-subtle transition-colors duration-100 hover:text-content-muted"
            href={explorerTxUrl(claimTxHash)}
            target="_blank"
            rel="noreferrer"
          >
            tx: {shortHash(claimTxHash)}
          </a>
        )}
      </div>
    </Dialog>
  );
}
