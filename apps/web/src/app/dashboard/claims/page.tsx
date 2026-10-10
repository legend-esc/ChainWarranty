/**
 * Claims Queue page — manufacturer dashboard.
 *
 * Displays filed warranty claims from the indexer DB (fast reads), and
 * provides approve/reject actions that call resolve_claim on-chain via
 * Freighter signing. Also allows voiding a token directly from this page.
 *
 * The indexer API is queried via the /api/claims internal route.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import {
  freighterInvoke,
  buildContractOp,
  nativeToScVal,
  xdr,
} from "@/lib/freighter-invoke";
import { hexToBytes, formatDate, truncateAddress } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

const CONTRACT_ID =
  process.env["NEXT_PUBLIC_CONTRACT_ID"] ??
  "CDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const RPC_URL =
  process.env["NEXT_PUBLIC_RPC_URL"] ?? "https://soroban-testnet.stellar.org";

interface ClaimRow {
  id: number;
  serial_hash: string;
  claimant: string;
  ts: number;
  description: string;
  status: "Filed" | "Approved" | "Rejected";
}

export default function ClaimsPage() {
  const { address } = useWallet();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "Filed">("Filed");

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/claims");
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = (await res.json()) as ClaimRow[];
      setClaims(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  async function resolveClaim(
    claim: ClaimRow,
    approved: boolean
  ): Promise<void> {
    if (!address) {
      setActionError("Connect your wallet to resolve claims.");
      return;
    }
    setActionError(null);
    setActingId(claim.id);
    try {
      const serialHash = hexToBytes(claim.serial_hash);
      const op = buildContractOp(
        CONTRACT_ID,
        "resolve_claim",
        xdr.ScVal.scvBytes(Buffer.from(serialHash)),
        nativeToScVal(claim.ts, { type: "u64" }),
        nativeToScVal(approved, { type: "bool" })
      );
      await freighterInvoke(
        { rpcUrl: RPC_URL, contractId: CONTRACT_ID, signerAddress: address },
        op
      );
      // Optimistically update the local list
      setClaims((prev) =>
        prev.map((c) =>
          c.id === claim.id
            ? { ...c, status: approved ? "Approved" : "Rejected" }
            : c
        )
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActingId(null);
    }
  }

  async function voidToken(serialHash: string): Promise<void> {
    if (!address) {
      setActionError("Connect your wallet to void tokens.");
      return;
    }
    const reason = window.prompt("Enter void reason (counterfeit / recall / other):");
    if (!reason) return;

    setActionError(null);
    try {
      const op = buildContractOp(
        CONTRACT_ID,
        "void_token",
        xdr.ScVal.scvBytes(Buffer.from(hexToBytes(serialHash))),
        nativeToScVal(reason, { type: "string" })
      );
      await freighterInvoke(
        { rpcUrl: RPC_URL, contractId: CONTRACT_ID, signerAddress: address },
        op
      );
      alert("Token voided successfully.");
      await fetchClaims();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  const displayed =
    filterStatus === "all"
      ? claims
      : claims.filter((c) => c.status === filterStatus);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Claims Queue</h1>
        <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "0.25rem" }}>
          Filed warranty claims for products registered by your manufacturer
          address. Claim data is read from the indexer DB; approve/reject
          actions write on-chain.
        </p>
      </header>

      {!address && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            fontSize: "0.9rem",
          }}
        >
          ⚠️ Connect your wallet to resolve claims.
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            color: "#dc2626",
            fontSize: "0.9rem",
          }}
        >
          {actionError}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <span style={{ fontSize: "0.875rem", color: "#64748b" }}>Show:</span>
        {(["Filed", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: "0.3rem 0.75rem",
              borderRadius: 20,
              border: "1px solid #e2e8f0",
              background: filterStatus === s ? "#4f46e5" : "#fff",
              color: filterStatus === s ? "#fff" : "#475569",
              fontSize: "0.8rem",
              fontWeight: filterStatus === s ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {s === "all" ? "All" : "Pending"}
          </button>
        ))}
        <button
          onClick={fetchClaims}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            padding: "0.3rem 0.75rem",
            cursor: "pointer",
            fontSize: "0.8rem",
            color: "#475569",
          }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Loading claims…</p>
      ) : fetchError ? (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fdba74",
            borderRadius: 8,
            padding: "1rem",
            color: "#92400e",
            fontSize: "0.9rem",
          }}
        >
          <strong>Could not load claims from indexer:</strong> {fetchError}
          <br />
          <span style={{ fontSize: "0.8rem" }}>
            Make sure the indexer service is running and{" "}
            <code>NEXT_PUBLIC_INDEXER_URL</code> is set.
          </span>
        </div>
      ) : displayed.length === 0 ? (
        <p style={{ color: "#94a3b8" }}>
          {filterStatus === "Filed"
            ? "No pending claims."
            : "No claims found."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {displayed.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              acting={actingId === claim.id}
              onResolve={resolveClaim}
              onVoid={voidToken}
              walletConnected={!!address}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClaimCard
// ---------------------------------------------------------------------------

function ClaimCard({
  claim,
  acting,
  onResolve,
  onVoid,
  walletConnected,
}: {
  claim: ClaimRow;
  acting: boolean;
  onResolve: (claim: ClaimRow, approved: boolean) => Promise<void>;
  onVoid: (serialHash: string) => Promise<void>;
  walletConnected: boolean;
}) {
  const statusColor =
    claim.status === "Approved"
      ? "#16a34a"
      : claim.status === "Rejected"
      ? "#dc2626"
      : "#ca8a04";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div>
          <code
            style={{
              fontSize: "0.8rem",
              color: "#475569",
              display: "block",
              marginBottom: "0.2rem",
            }}
          >
            {claim.serial_hash.slice(0, 16)}…
          </code>
          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            Filed by <code>{truncateAddress(claim.claimant)}</code> ·{" "}
            {formatDate(claim.ts)}
          </span>
        </div>
        <span
          style={{
            fontWeight: 600,
            fontSize: "0.8rem",
            color: statusColor,
            background:
              claim.status === "Approved"
                ? "#f0fdf4"
                : claim.status === "Rejected"
                ? "#fef2f2"
                : "#fefce8",
            padding: "0.2rem 0.6rem",
            borderRadius: 20,
          }}
        >
          {claim.status}
        </span>
      </div>

      <p style={{ color: "#1e293b", fontSize: "0.9rem", margin: 0 }}>
        {claim.description || <em style={{ color: "#94a3b8" }}>No description provided.</em>}
      </p>

      {claim.status === "Filed" && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button
            variant="primary"
            loading={acting}
            disabled={!walletConnected}
            onClick={() => onResolve(claim, true)}
            style={{ background: "#16a34a" }}
          >
            Approve
          </Button>
          <Button
            variant="danger"
            loading={acting}
            disabled={!walletConnected}
            onClick={() => onResolve(claim, false)}
          >
            Reject
          </Button>
          <Button
            variant="secondary"
            loading={acting}
            disabled={!walletConnected}
            onClick={() => onVoid(claim.serial_hash)}
          >
            Void Token
          </Button>
        </div>
      )}
    </div>
  );
}
