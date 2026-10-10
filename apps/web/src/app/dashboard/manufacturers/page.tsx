/**
 * Manufacturer Management page — admin-only dashboard section.
 *
 * Allows the contract admin to:
 * - Add a new manufacturer address to the whitelist (add_manufacturer)
 * - Suspend or reinstate a manufacturer (set_manufacturer_active)
 *
 * Gated to the contract admin address by the contract's own require_auth
 * checks — there is no separate login system, per README.md's Architecture.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import {
  freighterInvoke,
  buildContractOp,
  nativeToScVal,
} from "@/lib/freighter-invoke";
import { truncateAddress } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

const CONTRACT_ID =
  process.env["NEXT_PUBLIC_CONTRACT_ID"] ??
  "CDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const RPC_URL =
  process.env["NEXT_PUBLIC_RPC_URL"] ?? "https://soroban-testnet.stellar.org";

interface ManufacturerRow {
  address: string;
  name: string;
  active: boolean;
}

export default function ManufacturersPage() {
  const { address } = useWallet();

  const [manufacturers, setManufacturers] = useState<ManufacturerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingAddr, setActingAddr] = useState<string | null>(null);

  // Add form state
  const [newAddr, setNewAddr] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchManufacturers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/manufacturers");
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = (await res.json()) as ManufacturerRow[];
      setManufacturers(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManufacturers();
  }, [fetchManufacturers]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!address) {
      setActionError("Connect your wallet (must be admin).");
      return;
    }
    setActionError(null);
    setAdding(true);
    try {
      const op = buildContractOp(
        CONTRACT_ID,
        "add_manufacturer",
        nativeToScVal(newAddr.trim(), { type: "address" }),
        nativeToScVal(newName.trim(), { type: "string" })
      );
      await freighterInvoke(
        { rpcUrl: RPC_URL, contractId: CONTRACT_ID, signerAddress: address },
        op
      );
      setNewAddr("");
      setNewName("");
      await fetchManufacturers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(mfr: ManufacturerRow) {
    if (!address) {
      setActionError("Connect your wallet (must be admin).");
      return;
    }
    setActionError(null);
    setActingAddr(mfr.address);
    try {
      const op = buildContractOp(
        CONTRACT_ID,
        "set_manufacturer_active",
        nativeToScVal(mfr.address, { type: "address" }),
        nativeToScVal(!mfr.active, { type: "bool" })
      );
      await freighterInvoke(
        { rpcUrl: RPC_URL, contractId: CONTRACT_ID, signerAddress: address },
        op
      );
      setManufacturers((prev) =>
        prev.map((m) =>
          m.address === mfr.address ? { ...m, active: !m.active } : m
        )
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActingAddr(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Manufacturers</h1>
        <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "0.25rem" }}>
          Admin-only: add and manage manufacturer whitelist entries. The
          contract's own <code>require_auth</code> check enforces that only the
          admin address can call these functions.
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
          ⚠️ Connect your wallet to manage manufacturers (admin only).
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

      {/* Add manufacturer form */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "1.25rem",
        }}
      >
        <h2 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "1rem" }}>
          Add Manufacturer
        </h2>
        <form
          onSubmit={handleAdd}
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
            }}
          >
            <input
              type="text"
              placeholder="Stellar G… address"
              value={newAddr}
              onChange={(e) => setNewAddr(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Display name (e.g. Acme Electronics)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div>
            <Button
              type="submit"
              loading={adding}
              disabled={!address}
            >
              Add Manufacturer
            </Button>
          </div>
        </form>
      </section>

      {/* Manufacturers list */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "1.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ fontWeight: 600, fontSize: "1rem" }}>
            Registered Manufacturers
          </h2>
          <button
            onClick={fetchManufacturers}
            style={{
              background: "none",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "0.25rem 0.75rem",
              cursor: "pointer",
              fontSize: "0.8rem",
              color: "#475569",
            }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading…</p>
        ) : fetchError ? (
          <p style={{ color: "#dc2626", fontSize: "0.9rem" }}>
            Could not load manufacturers: {fetchError}
          </p>
        ) : manufacturers.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No manufacturers registered yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem", fontWeight: 600 }}>
                  Address
                </th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem", fontWeight: 600 }}>
                  Name
                </th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem", fontWeight: 600 }}>
                  Status
                </th>
                <th style={{ padding: "0.4rem 0.5rem" }} />
              </tr>
            </thead>
            <tbody>
              {manufacturers.map((mfr) => (
                <tr
                  key={mfr.address}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <td style={{ padding: "0.5rem 0.5rem" }}>
                    <code style={{ fontSize: "0.8rem" }}>
                      {truncateAddress(mfr.address)}
                    </code>
                  </td>
                  <td style={{ padding: "0.5rem 0.5rem" }}>{mfr.name}</td>
                  <td style={{ padding: "0.5rem 0.5rem" }}>
                    <span
                      style={{
                        color: mfr.active ? "#16a34a" : "#dc2626",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                      }}
                    >
                      {mfr.active ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem 0.5rem", textAlign: "right" }}>
                    <Button
                      variant={mfr.active ? "danger" : "secondary"}
                      loading={actingAddr === mfr.address}
                      disabled={!address}
                      onClick={() => toggleActive(mfr)}
                    >
                      {mfr.active ? "Suspend" : "Reinstate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: "0.9rem",
  boxSizing: "border-box",
};
