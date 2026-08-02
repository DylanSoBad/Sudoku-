"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Check, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLevelMeta, type Difficulty } from "@/lib/sudoku";
import { cn } from "@/lib/utils";
import { useT } from "@/components/app-providers";

const PROGRESS_KEY = "shelby-sudoku-progress";
const TOTAL_LEVELS = 20;

interface ProgressRecord {
  address: string;
  completed: number[];
  unlocked: number[];
  signatures: Record<string, string>;
}

async function hmacSign(message: string, secret: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    // Fallback hash for environments without subtle crypto
    let h = 0;
    const s = `${secret}:${message}`;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function salt(): string {
  return process.env.NEXT_PUBLIC_PROGRESS_SALT || "change-me";
}

function loadRaw(): ProgressRecord | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProgressRecord;
  } catch {
    return null;
  }
}

function saveRaw(rec: ProgressRecord): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(rec));
}

async function defaultProgress(address: string): Promise<ProgressRecord> {
  const sig = await hmacSign(`${address}:1`, salt());
  return {
    address,
    completed: [],
    unlocked: [1],
    signatures: { "1": sig },
  };
}

async function verifyProgress(rec: ProgressRecord): Promise<ProgressRecord> {
  const validUnlocked: number[] = [];
  const signatures: Record<string, string> = {};
  for (const lvl of rec.unlocked) {
    const expected = await hmacSign(`${rec.address}:${lvl}`, salt());
    if (rec.signatures[String(lvl)] === expected) {
      validUnlocked.push(lvl);
      signatures[String(lvl)] = expected;
    }
  }
  if (!validUnlocked.includes(1)) {
    return defaultProgress(rec.address);
  }
  const completed = rec.completed.filter((c) => validUnlocked.includes(c) || c < Math.max(...validUnlocked));
  return { ...rec, unlocked: validUnlocked, completed, signatures };
}

export async function markLevelComplete(address: string, level: number): Promise<void> {
  let rec = loadRaw();
  if (!rec || rec.address !== address) {
    rec = await defaultProgress(address);
  } else {
    rec = await verifyProgress(rec);
  }
  if (!rec.completed.includes(level)) rec.completed.push(level);
  const next = level + 1;
  if (next <= TOTAL_LEVELS + 10 && !rec.unlocked.includes(next)) {
    rec.unlocked.push(next);
    rec.signatures[String(next)] = await hmacSign(`${address}:${next}`, salt());
  }
  // ensure current stays signed
  rec.signatures[String(level)] = await hmacSign(`${address}:${level}`, salt());
  if (!rec.unlocked.includes(level)) rec.unlocked.push(level);
  saveRaw(rec);
  window.dispatchEvent(new CustomEvent("shelby:progress"));
}

const diffColor: Record<Difficulty, "accent" | "gold" | "danger" | "muted" | "default"> = {
  easy: "accent",
  medium: "default",
  hard: "gold",
  expert: "danger",
  master: "danger",
};

const diffShort: Record<Difficulty, string> = {
  easy: "easy",
  medium: "med",
  hard: "hard",
  expert: "exp",
  master: "mas",
};

export function LevelMap() {
  const t = useT();
  const { account, connected } = useWallet();
  const [unlocked, setUnlocked] = useState<number[]>([1]);
  const [completed, setCompleted] = useState<number[]>([]);

  const address = account?.address?.toString() ?? "guest";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      let rec = loadRaw();
      if (!rec || (connected && rec.address !== address)) {
        rec = await defaultProgress(address);
        saveRaw(rec);
      } else {
        rec = await verifyProgress(rec);
        saveRaw(rec);
      }
      if (!cancelled) {
        setUnlocked(rec.unlocked);
        setCompleted(rec.completed);
      }
    })();
    const onProg = () => {
      const rec = loadRaw();
      if (rec) {
        setUnlocked(rec.unlocked);
        setCompleted(rec.completed);
      }
    };
    window.addEventListener("shelby:progress", onProg);
    return () => {
      cancelled = true;
      window.removeEventListener("shelby:progress", onProg);
    };
  }, [address, connected]);

  const levels = useMemo(() => Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1), []);

  const currentLevel = useMemo(() => {
    const playable = unlocked
      .filter((l) => l <= TOTAL_LEVELS && !completed.includes(l))
      .sort((a, b) => a - b);
    return playable[0] ?? null;
  }, [unlocked, completed]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.levelMap.title}</CardTitle>
        <CardDescription>
          {t.levelMap.description} (1–{TOTAL_LEVELS})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-10 md:gap-3">
          {levels.map((lvl) => {
            const meta = getLevelMeta(lvl);
            const isUnlocked = unlocked.includes(lvl);
            const isDone = completed.includes(lvl);
            const isCurrent = currentLevel === lvl;
            const short = diffShort[meta.difficulty];
            const full = meta.difficulty;

            const inner = (
              <div
                className={cn(
                  "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2 transition-colors duration-150",
                  !isUnlocked &&
                    "border-shelby-border bg-shelby-bg/30 text-shelby-muted opacity-70",
                  isUnlocked &&
                    !isDone &&
                    "border-shelby-accent bg-shelby-bg hover:border-shelby-accent",
                  isCurrent && !isDone && "animate-pulse",
                  isDone &&
                    "border-shelby-gold/60 bg-shelby-gold/10 hover:border-shelby-gold",
                )}
              >
                <div className="relative flex items-center justify-center">
                  <span
                    className={cn(
                      "text-lg font-semibold leading-none",
                      isUnlocked ? "text-white" : "text-shelby-muted",
                    )}
                  >
                    {lvl}
                  </span>
                  {isDone ? (
                    <Check
                      className="absolute -right-3.5 -top-1 h-3.5 w-3.5 text-shelby-gold"
                      aria-hidden
                    />
                  ) : null}
                </div>

                <Badge
                  variant={isUnlocked ? diffColor[meta.difficulty] : "muted"}
                  className="mt-0.5 px-1.5 py-0 text-[10px] font-medium leading-tight tracking-wide"
                >
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden capitalize sm:inline">{full}</span>
                </Badge>

                {!isUnlocked ? (
                  <Lock className="mt-0.5 h-3.5 w-3.5 text-shelby-muted" aria-hidden />
                ) : isDone ? (
                  <span className="sr-only">Solved</span>
                ) : null}
              </div>
            );

            if (!isUnlocked) {
              return (
                <div key={lvl} aria-label={`Level ${lvl} locked, ${full}`}>
                  {inner}
                </div>
              );
            }

            return (
              <Link
                key={lvl}
                href={`/play/${lvl}`}
                aria-label={
                  isDone
                    ? `Level ${lvl} solved, ${full}. Replay`
                    : `Play level ${lvl}, ${full}`
                }
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
