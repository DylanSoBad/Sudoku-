"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import type { WalletName } from "@aptos-labs/wallet-adapter-react";
import { Dialog } from "@/components/ui/dialog";

interface WalletPickerProps {
  open: boolean;
  onClose: () => void;
}

interface Entry {
  name: string;
  icon?: string;
  url?: string;
  installed: boolean;
}

/**
 * Lists whatever the adapter actually exposes instead of assuming Petra.
 * Installed wallets connect in place; the rest link to their install page.
 */
export function WalletPicker({ open, onClose }: WalletPickerProps) {
  const { wallets, connect } = useWallet();

  const { installed, available } = useMemo(() => {
    const all: Entry[] = (wallets ?? []).map((w) => {
      const rec = w as unknown as Record<string, unknown>;
      return {
        name: String(rec["name"] ?? ""),
        icon: typeof rec["icon"] === "string" ? rec["icon"] : undefined,
        url: typeof rec["url"] === "string" ? rec["url"] : undefined,
        installed: rec["readyState"] === "Installed",
      };
    });
    // Deduplicate: the adapter can list a wallet as both detected and registry.
    const seen = new Map<string, Entry>();
    for (const entry of all) {
      const prev = seen.get(entry.name);
      if (!prev || (!prev.installed && entry.installed)) seen.set(entry.name, entry);
    }
    const unique = [...seen.values()];
    return {
      installed: unique.filter((w) => w.installed),
      available: unique.filter((w) => !w.installed),
    };
  }, [wallets]);

  function pick(name: string) {
    try {
      connect(name as WalletName);
      onClose();
    } catch {
      /* the provider's onError already toasts */
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Connect a wallet">
      <div className="flex flex-col gap-4">
        {installed.length === 0 && available.length === 0 ? (
          <p className="text-sm text-content-muted">
            No Aptos wallets detected. Install Petra, Pontem, or Nightly, then reload.
          </p>
        ) : null}

        {installed.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {installed.map((w) => (
              <li key={w.name}>
                <button
                  type="button"
                  onClick={() => pick(w.name)}
                  className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-left text-sm text-content transition-colors duration-100 hover:border-accent/50"
                >
                  <WalletIcon icon={w.icon} name={w.name} />
                  <span className="flex-1">{w.name}</span>
                  <span className="text-xs text-content-subtle">Installed</span>
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
