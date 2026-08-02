"use client";

import { useEffect, useState } from "react";
import { useWallet as useAdapterWallet } from "@aptos-labs/wallet-adapter-react";

export function useWallet() {
  const adapter = useAdapterWallet();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return { ...adapter, ready };
}
