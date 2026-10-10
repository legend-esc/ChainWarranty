/**
 * Dashboard overview page — shows quick links and wallet status.
 */
"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet-context";

export default function DashboardPage() {
  const { address, connect } = useWallet();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>
          Manufacturer Dashboard
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
          Mint tokens, manage warranty claims, and administer manufacturer
          accounts using your connected Stellar wallet.
        </p>
      </header>

      {!address && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            padding: "1rem 1.25rem",
          }}
        >
          <strong>Wallet not connected.</strong>{" "}
          <button
            onClick={connect}
            style={{
              background: "none",
              border: "none",
              color: "#4f46e5",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Connect Freighter
          </button>{" "}
          to sign transactions.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        {[
          {
            href: "/dashboard/mint",
            icon: "🏭",
            title: "Mint Token",
            desc: "Register a new product serial number on-chain.",
          },
          {
            href: "/dashboard/claims",
            icon: "📋",
            title: "Claims Queue",
            desc: "Review and resolve pending warranty claims.",
          },
          {
            href: "/dashboard/manufacturers",
            icon: "🏢",
            title: "Manufacturers",
            desc: "Add or suspend manufacturer addresses (admin only).",
          },
        ].map(({ href, icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "1.25rem",
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
              transition: "box-shadow 0.15s",
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>{icon}</span>
            <strong style={{ fontWeight: 600 }}>{title}</strong>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>{desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
