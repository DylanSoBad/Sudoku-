"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Dialog } from "@/components/ui/dialog";

interface WalletPickerProps {
  open: boolean;
  onClose: () => void;
}

interface Entry {
  name: string;
  icon?: string;
  url?: string;
}

/**
 * Lists whatever the adapter actually exposes instead of assuming a single wallet.
 * The adapter reports detected and not-detected wallets as two separate arrays,
 * so readyState never has to be inferred.
 */
export function WalletPicker({ open, onClose }: WalletPickerProps) {
  const { wallets, notDetectedWallets, connect } = useWallet();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { installed, available } = useMemo(() => {
    const toEntry = (w: { name: string; icon?: string; url?: string }): Entry => ({
      name: w.name,
      icon: w.icon,
      url: w.url,
    });
    const detected = (wallets ?? []).map(toEntry);
    const detectedNames = new Set(detected.map((w) => w.name));
    return {
      installed: detected,
      // A wallet can appear in both arrays while it is still registering.
      available: (notDetectedWallets ?? [])
        .map(toEntry)
        .filter((w) => !detectedNames.has(w.name)),
    };
  }, [wallets, notDetectedWallets]);

  async function pick(name: string) {
    setError(null);
    setPending(name);
    try {
      // connect() resolves without throwing when the adapter cannot find the
      // wallet, so treat a silent no-op as a failure rather than closing.
      await connect(name);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Could not connect to ${name}. Unlock the wallet and try again.`,
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Connect a wallet">
      <div className="flex flex-col gap-4">
        {installed.length === 0 && available.length === 0 ? (
          <p className="text-sm text-content-muted">
            No Aptos wallets detected. Install Petra or Nightly, then reload.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {installed.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {installed.map((w) => (
              <li key={w.name}>
                <button
                  type="button"
                  onClick={() => pick(w.name)}
                  disabled={pending !== null}
                  className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-left text-sm text-content transition-colors duration-100 hover:border-accent/50 disabled:opacity-60"
                >
                  <WalletIcon icon={w.icon} name={w.name} />
                  <span className="flex-1">{w.name}</span>
                  <span className="text-xs text-content-subtle">
                    {pending === w.name ? "Connecting…" : "Installed"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {available.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wide text-content-subtle">
              Not installed
            </p>
            <ul className="flex flex-col gap-2">
              {available.map((w) => (
                <li key={w.name}>
                  <a
                    href={w.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center gap-3 rounded-lg border border-line/70 px-3 py-2.5 text-left text-sm text-content-muted transition-colors duration-100 hover:border-line-strong hover:text-content"
                  >
                    <WalletIcon icon={w.icon} name={w.name} />
                    <span className="flex-1">{w.name}</span>
                    <span className="text-xs text-content-subtle">Install →</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

function WalletIcon({ icon, name }: { icon?: string; name: string }) {
  if (!icon) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded bg-surface text-[11px] text-content-subtle">
        {name.slice(0, 1)}
      </span>
    );
  }
  // Wallet icons are inline data URLs, which the Next optimizer cannot handle.
  return <Image src={icon} alt="" width={24} height={24} unoptimized className="h-6 w-6 rounded" />;
}
