/**
 * Mint Token page — manufacturer dashboard.
 *
 * Implements "How it works" step 1 from README.md:
 * - Manufacturer enters product ID, serial number, warranty months, initial owner.
 * - Serial number is hashed client-side (sha256) before being sent to the contract.
 * - mint_token is called via Freighter wallet signing.
 * - On success, a QR code is generated encoding the verification URL.
 */
"use client";

import { useState, useRef } from "react";
import { useWallet } from "@/lib/wallet-context";
import { sha256Hex, hexToBytes } from "@/lib/utils";
import {
  freighterInvoke,
  buildContractOp,
  nativeToScVal,
  xdr,
} from "@/lib/freighter-invoke";
import { Button } from "@/components/ui/Button";
import { QrDisplay } from "@/components/dashboard/QrDisplay";

const CONTRACT_ID =
  process.env["NEXT_PUBLIC_CONTRACT_ID"] ??
  "CDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const RPC_URL =
  process.env["NEXT_PUBLIC_RPC_URL"] ?? "https://soroban-testnet.stellar.org";

// Base URL for verification links (adapts to actual deployment origin).
function verifyBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "https://verify.chainwarranty.example";
}

export default function MintPage() {
  const { address } = useWallet();

  const [productId, setProductId] = useState("");
  const [serial, setSerial] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState("12");
  const [initialOwner, setInitialOwner] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintedSerial, setMintedSerial] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) {
      setError("Connect your wallet first.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const hashHex = await sha256Hex(serial.trim());
      const serialHash = hexToBytes(hashHex);

      const op = buildContractOp(
        CONTRACT_ID,
        "mint_token",
        nativeToScVal(address, { type: "address" }),
        xdr.ScVal.scvBytes(Buffer.from(serialHash)),
        nativeToScVal(productId.trim(), { type: "string" }),
        nativeToScVal(parseInt(warrantyMonths, 10), { type: "u32" }),
        nativeToScVal((initialOwner.trim() || address), { type: "address" })
      );

      await freighterInvoke({ rpcUrl: RPC_URL, contractId: CONTRACT_ID, signerAddress: address }, op);

      // Build the verification URL (raw serial in URL, hashed client-side on verify page)
      const url = `${verifyBaseUrl()}/verify/${CONTRACT_ID}/${encodeURIComponent(serial.trim())}`;
      setQrUrl(url);
      setMintedSerial(serial.trim());

      // Reset form
      setProductId("");
      setSerial("");
      setWarrantyMonths("12");
      setInitialOwner("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Mint Token</h1>
        <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "0.25rem" }}>
          Register a new product serial number on-chain. The serial number is
          hashed client-side before being sent to the contract.
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
          ⚠️ Connect your manufacturer wallet to mint tokens.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <Field label="Product ID" required>
          <input
            type="text"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="e.g. ACME-WIDGET-PRO-2024"
            required
            style={inputStyle}
          />
        </Field>

        <Field
          label="Serial Number"
          hint="This will be hashed client-side (SHA-256) before being stored on-chain. The raw serial is never sent to the contract."
          required
        >
          <input
            type="text"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="e.g. SN-1234567890"
            required
            style={inputStyle}
          />
        </Field>

        <Field label="Warranty (months)" required>
          <input
            type="number"
            value={warrantyMonths}
            onChange={(e) => setWarrantyMonths(e.target.value)}
            min={1}
            max={120}
            required
            style={{ ...inputStyle, width: 120 }}
          />
        </Field>

        <Field
          label="Initial Owner Address"
          hint="Stellar G… address. Leave blank to assign to your connected wallet."
        >
          <input
            type="text"
            value={initialOwner}
            onChange={(e) => setInitialOwner(e.target.value)}
            placeholder="G… (defaults to your address)"
            style={inputStyle}
          />
        </Field>

        {error && (
          <div
            role="alert"
            style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: 6,
              padding: "0.75rem 1rem",
              color: "#dc2626",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        <div>
          <Button type="submit" loading={submitting} disabled={!address}>
            Mint Token
          </Button>
        </div>
      </form>

      {/* QR code shown after successful mint */}
      {qrUrl && mintedSerial && (
        <QrDisplay url={qrUrl} serial={mintedSerial} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: "0.9rem",
  boxSizing: "border-box",
};

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <label style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1e293b" }}>
        {label}
        {required && <span style={{ color: "#dc2626" }}> *</span>}
      </label>
      {hint && (
        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{hint}</span>
      )}
      {children}
    </div>
  );
}
