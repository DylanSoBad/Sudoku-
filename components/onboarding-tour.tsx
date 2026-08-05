"use client";

import { useEffect, useState } from "react";
import { isOnboarded, setOnboarded } from "@/lib/preferences";
import { useT } from "@/components/app-providers";
import { Button } from "@/components/ui/button";

/** Targets must exist as `data-tour` on the live homepage. */
const STEPS = ["wallet", "levels", "play-l1"] as const;

export function OnboardingTour() {
  const t = useT();
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (isOnboarded()) return;
    // Delay so layout + data-tour targets exist
    const id = window.setTimeout(() => setActive(true), 600);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!active) return;
    const key = STEPS[step];
    const el = document.querySelector(`[data-tour="${key}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
    const onResize = () => {
      const node = document.querySelector(`[data-tour="${key}"]`);
      setRect(node?.getBoundingClientRect() ?? null);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, step]);

  if (!active) return null;

  const titles = [t.onboarding.step1Title, t.onboarding.step2Title, t.onboarding.step3Title];
  const bodies = [t.onboarding.step1Body, t.onboarding.step2Body, t.onboarding.step3Body];
  const isLast = step >= STEPS.length - 1;

  const finish = () => {
    setOnboarded(true);
    setActive(false);
  };

  const pad = 8;
  const spotlight = rect
    ? {
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  const tipTop = spotlight
    ? Math.min(window.innerHeight - 200, spotlight.top + spotlight.height + 12)
    : window.innerHeight / 2 - 80;
  const tipLeft = spotlight
    ? Math.min(window.innerWidth - 320, Math.max(16, spotlight.left))
    : 16;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Onboarding">
      <div className="absolute inset-0 bg-black/65" onClick={finish} />
      {spotlight ? (
        <div
          className="pointer-events-none absolute rounded-md ring-2 ring-accent"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      ) : null}
      <div
        className="absolute z-10 w-[min(320px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-4"
        style={{ top: tipTop, left: tipLeft }}
      >
        <p className="font-mono text-xs text-content-subtle">
          {step + 1} / {STEPS.length}
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold text-content">{titles[step]}</h3>
        <p className="mt-2 text-sm text-content-muted">{bodies[step]}</p>
        <div className="mt-4 flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            {t.onboarding.skip}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (isLast) finish();
              else setStep((s) => s + 1);
            }}
          >
            {isLast ? t.onboarding.finish : t.onboarding.next}
          </Button>
        </div>
      </div>
    </div>
  );
}
