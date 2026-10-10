/**
 * Dashboard navigation bar — shows active wallet address and connect/disconnect
 * button, plus links to each dashboard section.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { truncateAddress } from "@/lib/utils";

export function DashboardNav() {
  const { address, connecting, connect, disconnect } = useWallet();
  const pathname = usePathname();

  const navLinks = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/mint", label: "Mint Token" },
    { href: "/dashboard/claims", label: "Claims Queue" },
    { href: "/dashboard/manufacturers", label: "Manufacturers" },
  ];

  return (
    <nav
      style={{
        background: "#fff",
        borderBottom: "1px solid #e2e8f0",
        padding: "0 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "0.5rem",
      }}
    >
      {/* Brand */}
      <Link
        href="/dashboard"
        style={{
          fontWeight: 700,
          fontSize: "1rem",
          color: "#4f46e5",
          textDecoration: "none",
          padding: "0.75rem 0",
          whiteSpace: "nowrap",
        }}
      >
        ChainWarranty
      </Link>

      {/* Links */}
      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
        {navLinks.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                padding: "0.75rem 0.75rem",
                fontSize: "0.875rem",
                fontWeight: active ? 600 : 400,
                color: active ? "#4f46e5" : "#475569",
                textDecoration: "none",
                borderBottom: active ? "2px solid #4f46e5" : "2px solid transparent",
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Wallet */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0" }}>
        {address ? (
          <>
            <code
              style={{
                fontSize: "0.8rem",
                background: "#f1f5f9",
                padding: "0.2rem 0.5rem",
                borderRadius: 4,
                color: "#334155",
              }}
            >
              {truncateAddress(address)}
            </code>
            <button
              onClick={disconnect}
              style={{
                fontSize: "0.8rem",
                background: "none",
                border: "1px solid #e2e8f0",
                borderRadius: 4,
                padding: "0.2rem 0.5rem",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            style={{
              background: "#4f46e5",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "0.4rem 0.9rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: connecting ? "not-allowed" : "pointer",
              opacity: connecting ? 0.7 : 1,
            }}
          >
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>
    </nav>
  );
}
