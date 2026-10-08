"use client";

/**
 * Public verification page.
 *
 * Route: /verify/[contractId]/[serial]
 *
 * Matches the URL shape from README.md's "QR code format" section:
 *   https://verify.chainwarranty.example/<CONTRACT_ID>/<RAW_SERIAL_NUMBER>
 *
 * Flow (per README.md "How it works" steps 2–3):
 * 1. Raw serial arrives in the URL parameter.
 * 2. Hash it client-side with SHA-256 — raw serial never sent to contract.
 * 3. Call verify(), get_history(), get_claims() via packages/sdk.
 * 4. Render authenticity status, warranty status, owner (address only, no PII),
 *    transfer history, and claims.
 * 5. Handle TokenNotFound and TokenVoided with clear user-facing messages.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChainWarrantyClient } from "@chainwarranty/sdk";
import type { Claim, ProductToken, TransferEvent } from "@chainwarranty/sdk";
import {
  sha256Hex,
  hexToBytes,
  isWarrantyActive,
  warrantyExpiresAt,
  formatDate,
  truncateAddress,
} from "@/lib/utils";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string; kind: "not_found" | "voided" | "other" }
  | {
      status: "ok";
      token: ProductToken;
      history: TransferEvent[];
      claims: Claim[];
    };

function getClient(contractId: string): ChainWarrantyClient {
  const rpcUrl =
    process.env["NEXT_PUBLIC_RPC_URL"] ??
    "https://soroban-testnet.stellar.org";
  return new ChainWarrantyClient({ rpcUrl, contractId });
}

export default function VerifyPage() {
  const params = useParams<{ contractId: string; serial: string }>();
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    if (!params.contractId || !params.serial) {
      setState({
        status: "error",
        message: "Invalid verification URL — missing contract ID or serial number.",
        kind: "other",
      });
      return;
    }

    async function load() {
      setState({ status: "loading" });
      try {
        // 1. Hash the raw serial client-side (raw serial never sent to contract)
        const rawSerial = decodeURIComponent(params.serial);
        const hashHex = await sha256Hex(rawSerial);
        const serialHash = hexToBytes(hashHex);

        const client = getClient(params.contractId);

        // 2. Fetch all three read-only views in parallel
        const [token, history, claims] = await Promise.all([
          client.verify(serialHash),
          client.getHistory(serialHash),
          client.getClaims(serialHash),
        ]);

        setState({ status: "ok", token, history, claims });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("TokenNotFound")) {
          setState({
            status: "error",
            message:
              "No product found for this serial number. The product may not have been registered, or the serial number may be incorrect.",
            kind: "not_found",
          });
        } else if (msg.includes("TokenVoided")) {
          setState({
            status: "error",
            message:
              "This product has been voided by the manufacturer. It may have been flagged as counterfeit or recalled.",
            kind: "voided",
          });
        } else {
          setState({
            status: "error",
            message: `Verification error: ${msg}`,
            kind: "other",
          });
        }
      }
    }

    load();
  }, [params.contractId, params.serial]);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.25rem" }}>
          ChainWarranty
        </p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          Product Verification
        </h1>
      </header>

      {state.status === "loading" && (
        <div aria-live="polite" style={{ color: "#475569" }}>
          Verifying product on-chain…
        </div>
      )}

      {state.status === "error" && (
        <ErrorCard kind={state.kind} message={state.message} />
      )}

      {state.status === "ok" && (
        <VerificationResult
          token={state.token}
          history={state.history}
          claims={state.claims}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ErrorCard({
  kind,
  message,
}: {
  kind: "not_found" | "voided" | "other";
  message: string;
}) {
  const icon = kind === "not_found" ? "🔍" : kind === "voided" ? "🚫" : "⚠️";
  const heading =
    kind === "not_found"
      ? "Product Not Found"
      : kind === "voided"
      ? "Product Voided"
      : "Verification Failed";
  const bg =
    kind === "voided" ? "#fef2f2" : kind === "not_found" ? "#fff7ed" : "#f1f5f9";
  const border =
    kind === "voided" ? "#fca5a5" : kind === "not_found" ? "#fdba74" : "#cbd5e1";

  return (
    <div
      role="alert"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: "1.5rem",
      }}
    >
      <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{icon}</p>
      <h2 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>{heading}</h2>
      <p style={{ color: "#475569" }}>{message}</p>
    </div>
  );
}

function VerificationResult({
  token,
  history,
  claims,
}: {
  token: ProductToken;
  history: TransferEvent[];
  claims: Claim[];
}) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const warrantyActive = isWarrantyActive(
    token.mint_ts,
    token.warranty_months,
    nowSeconds
  );
  const expiresAt = warrantyExpiresAt(token.mint_ts, token.warranty_months);

  const isAuthentic = token.status === "Active";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Authenticity badge */}
      <section
        style={{
          background: isAuthentic ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${isAuthentic ? "#86efac" : "#fca5a5"}`,
          borderRadius: 8,
          padding: "1.5rem",
        }}
        aria-label="Authenticity status"
      >
        <p style={{ fontSize: "2rem" }}>{isAuthentic ? "✅" : "🚫"}</p>
        <h2 style={{ fontWeight: 700, fontSize: "1.25rem" }}>
          {isAuthentic ? "Authentic Product" : "Product Voided"}
        </h2>
        <p style={{ color: "#475569", marginTop: "0.25rem" }}>
          {token.product_id} · registered by{" "}
          <code style={{ fontSize: "0.85em" }}>
            {truncateAddress(token.manufacturer)}
          </code>
        </p>
      </section>

      {/* Warranty status */}
      <section
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "1.5rem",
        }}
        aria-label="Warranty status"
      >
        <h2 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Warranty</h2>
        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.4rem 1rem" }}>
          <dt style={{ color: "#64748b" }}>Status</dt>
          <dd style={{ fontWeight: 600, color: warrantyActive ? "#16a34a" : "#dc2626" }}>
            {warrantyActive ? "Active" : "Expired"}
          </dd>
          <dt style={{ color: "#64748b" }}>Duration</dt>
          <dd>{token.warranty_months} months</dd>
          <dt style={{ color: "#64748b" }}>Registered</dt>
          <dd>{formatDate(token.mint_ts)}</dd>
          <dt style={{ color: "#64748b" }}>Expires</dt>
          <dd>{formatDate(expiresAt)}</dd>
        </dl>
      </section>

      {/* Ownership */}
      <section
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "1.5rem",
        }}
        aria-label="Ownership"
      >
        <h2 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Ownership</h2>
        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.4rem 1rem" }}>
          <dt style={{ color: "#64748b" }}>Current owner</dt>
          <dd>
            <code style={{ wordBreak: "break-all", fontSize: "0.85em" }}>
              {token.owner}
            </code>
          </dd>
          <dt style={{ color: "#64748b" }}>Transfers</dt>
          <dd>{token.transfer_count}</dd>
        </dl>
      </section>

      {/* Transfer history */}
      <section
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "1.5rem",
        }}
        aria-label="Transfer history"
      >
        <h2 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>
          Transfer History
        </h2>
        {history.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No transfers recorded.</p>
        ) : (
          <ol style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {history.map((ev, i) => (
              <li key={i} style={{ color: "#475569", fontSize: "0.9rem" }}>
                <strong>{formatDate(ev.ts)}</strong>{" "}
                <code>{truncateAddress(ev.from)}</code> →{" "}
                <code>{truncateAddress(ev.to)}</code>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Claims */}
      <section
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "1.5rem",
        }}
        aria-label="Warranty claims"
      >
        <h2 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>
          Warranty Claims
        </h2>
        {claims.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No claims filed.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {claims.map((claim, i) => (
              <ClaimCard key={i} claim={claim} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ClaimCard({ claim }: { claim: Claim }) {
  const statusColor =
    claim.status === "Approved"
      ? "#16a34a"
      : claim.status === "Rejected"
      ? "#dc2626"
      : "#ca8a04";

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        padding: "0.75rem 1rem",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
          {formatDate(claim.ts)}
        </span>
        <span style={{ fontWeight: 600, fontSize: "0.85rem", color: statusColor }}>
          {claim.status}
        </span>
      </div>
      <p style={{ color: "#1e293b", fontSize: "0.9rem" }}>{claim.description}</p>
      <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "0.25rem" }}>
        Filed by <code>{truncateAddress(claim.claimant)}</code>
      </p>
    </div>
  );
}
