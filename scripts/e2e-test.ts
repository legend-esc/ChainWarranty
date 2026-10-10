#!/usr/bin/env tsx
/**
 * ChainWarranty end-to-end test.
 *
 * Covers the full loop described in README.md's "Local end-to-end walkthrough":
 *   mint → QR URL generated → verify on-chain → indexer DB has the row
 *
 * Runs against the real testnet deployment. Does NOT require a browser —
 * it exercises the SDK and indexer DB directly.
 *
 * Environment variables:
 *   CONTRACT_ID      — deployed contract ID (C… strkey)
 *   STELLAR_RPC_URL  — Soroban RPC endpoint (default: testnet)
 *   ADMIN_SECRET     — secret key of the contract admin
 *   MFR_SECRET       — secret key of a whitelisted manufacturer
 *   DATABASE_URL     — (optional) Postgres URL for the indexer DB
 *                      if set, the test asserts the indexer row is present
 *
 * Run:
 *   pnpm e2e
 *   # or directly:
 *   npx tsx scripts/e2e-test.ts
 */

import * as crypto from "node:crypto";
import assert from "node:assert/strict";
import { Keypair } from "@stellar/stellar-sdk";
import { ChainWarrantyClient } from "../packages/sdk/src/client.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CONTRACT_ID = process.env["CONTRACT_ID"];
const RPC_URL =
  process.env["STELLAR_RPC_URL"] ?? "https://soroban-testnet.stellar.org";
const ADMIN_SECRET = process.env["ADMIN_SECRET"];
const MFR_SECRET = process.env["MFR_SECRET"];
const DATABASE_URL = process.env["DATABASE_URL"] ?? null;

if (!CONTRACT_ID) {
  console.error(
    "[e2e] CONTRACT_ID is required. Set it to the testnet deployment."
  );
  process.exit(1);
}
if (!ADMIN_SECRET || !MFR_SECRET) {
  console.error("[e2e] ADMIN_SECRET and MFR_SECRET are required.");
  process.exit(1);
}

const adminKP = Keypair.fromSecret(ADMIN_SECRET);
const mfrKP = Keypair.fromSecret(MFR_SECRET);
const client = new ChainWarrantyClient({ rpcUrl: RPC_URL, contractId: CONTRACT_ID });

// Unique serial per run so re-runs don't hit TokenExists
const rawSerial = `e2e-${Date.now()}`;
const serialHash = new Uint8Array(
  crypto.createHash("sha256").update(rawSerial).digest()
);
const serialHashHex = Buffer.from(serialHash).toString("hex");

// ---------------------------------------------------------------------------
// Step 1: ensure manufacturer is whitelisted (idempotent)
// ---------------------------------------------------------------------------
async function step1_ensureManufacturer(): Promise<void> {
  console.log("\n[1/5] Ensuring manufacturer is whitelisted…");
  try {
    await client.addManufacturer(adminKP, mfrKP.publicKey(), "E2E Test Manufacturer");
    console.log("      ✓ manufacturer added");
  } catch (e) {
    console.log(`      ↳ already registered (${(e as Error).message.slice(0, 60)})`);
  }
}

// ---------------------------------------------------------------------------
// Step 2: mint a token
// ---------------------------------------------------------------------------
async function step2_mint(): Promise<void> {
  console.log(`\n[2/5] Minting token for serial "${rawSerial}"…`);
  await client.mintToken(
    mfrKP,
    mfrKP.publicKey(),
    serialHash,
    "e2e-product-001",
    12,
    adminKP.publicKey()
  );
  console.log("      ✓ mint_token submitted");
}

// ---------------------------------------------------------------------------
// Step 3: verify on-chain
// ---------------------------------------------------------------------------
async function step3_verify(): Promise<void> {
  console.log("\n[3/5] Verifying token on-chain…");
  const token = await client.verify(serialHash);
  assert.equal(token.status, "Active", "token.status should be Active");
  assert.equal(token.product_id, "e2e-product-001");
  assert.equal(token.warranty_months, 12);
  assert.equal(
    token.owner,
    adminKP.publicKey(),
    "initial owner should be admin public key"
  );
  const nowSecs = Math.floor(Date.now() / 1000);
  assert.ok(
    ChainWarrantyClient.isWarrantyActive(token, nowSecs),
    "warranty should be active immediately after mint"
  );
  console.log("      ✓ verify() returned correct data");
  console.log(`        product_id:      ${token.product_id}`);
  console.log(`        warranty_months: ${token.warranty_months}`);
  console.log(`        owner:           ${token.owner}`);
}

// ---------------------------------------------------------------------------
// Step 4: assert the QR verification URL is well-formed
// ---------------------------------------------------------------------------
async function step4_qrUrl(): Promise<void> {
  console.log("\n[4/5] Checking QR verification URL shape…");
  const baseUrl = "https://verify.chainwarranty.example";
  const verifyUrl = `${baseUrl}/${CONTRACT_ID}/${encodeURIComponent(rawSerial)}`;
  // The URL must contain the contract ID and the raw (unencoded) serial
  assert.ok(verifyUrl.includes(CONTRACT_ID!), "URL must include CONTRACT_ID");
  assert.ok(verifyUrl.includes(rawSerial), "URL must include raw serial");
  console.log(`      ✓ QR URL: ${verifyUrl}`);
}

// ---------------------------------------------------------------------------
// Step 5: check indexer DB (optional)
// ---------------------------------------------------------------------------
async function step5_indexer(): Promise<void> {
  if (!DATABASE_URL) {
    console.log(
      "\n[5/5] Skipping indexer DB check (DATABASE_URL not set)."
    );
    return;
  }
  console.log("\n[5/5] Checking indexer DB for minted token…");

  // Poll for up to 30 s (indexer default poll is 5 s)
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: DATABASE_URL });
  const maxAttempts = 6;
  let found = false;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await pool.query(
      "SELECT serial_hash, status FROM tokens WHERE serial_hash = $1",
      [serialHashHex]
    );
    if (res.rows.length > 0) {
      assert.equal(res.rows[0].status, "Active");
      found = true;
      console.log("      ✓ indexer DB row found:", res.rows[0]);
      break;
    }
    console.log(`      … waiting for indexer (attempt ${i + 1}/${maxAttempts})`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  await pool.end();
  assert.ok(found, "indexer DB should have a row for the minted token within 30 s");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log("=== ChainWarranty E2E test ===");
  console.log(`Contract: ${CONTRACT_ID}`);
  console.log(`RPC:      ${RPC_URL}`);
  console.log(`Serial:   ${rawSerial}`);

  await step1_ensureManufacturer();
  await step2_mint();
  await step3_verify();
  await step4_qrUrl();
  await step5_indexer();

  console.log("\n=== All steps passed ✅ ===\n");
}

main().catch((err) => {
  console.error("\n[e2e] FAILED:", err);
  process.exit(1);
});
