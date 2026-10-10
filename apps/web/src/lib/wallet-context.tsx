/**
 * WalletContext — provides the connected Stellar address and a helper to
 * trigger a Freighter connection prompt.
 *
 * Wrap the dashboard layout with <WalletProvider> so any dashboard component
 * can call useWallet() without prop-drilling.
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface WalletState {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  address: null,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Re-hydrate from sessionStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem("cw_wallet_address");
    if (stored) setAddress(stored);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      // @ts-expect-error — freighter-api injected by extension
      const freighter = window.freighterApi;
      if (!freighter) {
        alert(
          "Freighter wallet extension not found.\n\n" +
            "Install it from https://freighter.app, then refresh this page."
        );
        return;
      }
      const { address: addr } = await freighter.getAddress();
      if (addr) {
        setAddress(addr);
        sessionStorage.setItem("cw_wallet_address", addr);
      }
    } catch (err) {
      console.error("[wallet] connect error:", err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    sessionStorage.removeItem("cw_wallet_address");
  }, []);

  return (
    <WalletContext.Provider value={{ address, connecting, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  return useContext(WalletContext);
}
