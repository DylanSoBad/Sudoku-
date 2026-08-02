/**
 * Lightweight Web Audio feedback — no asset downloads.
 * Safe to call from client; no-ops when muted or SSR.
 */

import { getMute } from "@/lib/preferences";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (getMute()) return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function beep(
  freq: number,
  durationMs: number,
  type: OscillatorType = "sine",
  gain = 0.08,
): void {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + durationMs / 1000);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + durationMs / 1000);
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || getMute()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

/** Soft tick when a cell is filled. */
export function playTick(): void {
  beep(640, 45, "triangle", 0.05);
}

/** Chime on puzzle solve. */
export function playSolveChime(): void {
  const ac = getCtx();
  if (!ac) {
    vibrate([30, 40, 30]);
    return;
  }
  beep(523, 120, "sine", 0.07);
  window.setTimeout(() => beep(659, 140, "sine", 0.07), 100);
  window.setTimeout(() => beep(784, 220, "sine", 0.08), 220);
  vibrate([20, 30, 40]);
}

/** Buzz / error on conflict. */
export function playConflict(): void {
  beep(180, 90, "sawtooth", 0.06);
  vibrate(40);
}
