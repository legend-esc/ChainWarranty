/**
 * Integration test: mint a token and verify it against the Day 1 testnet deployment.
 *
 * Requires environment variables:
 *   CONTRACT_ID      — deployed contract ID (C… strkey)
 *   STELLAR_RPC_URL  — Soroban RPC endpoint (defaults to testnet horizon/soroban)
 *   ADMIN_SECRET     — secret key of the contract admin
 *   MFR_SECRET       — secret key of a whitelisted manufacturer
 *
 * Run with:  pnpm test:ts
 */

import * as crypto from "node:crypto";
import assert from "node:assert/strict";
import { Keypair } from "@stellar/stellar-sdk";
import { ChainWarrantyClient } from "./client.js";

const CONTRACT_ID = process.env["CONTRACT_ID"];
const RPC_URL =
  process.env["STELLAR_RPC_URL"] ??
  "https://soroban-testnet.stellar.org";
const ADMIN_SECRET = process.env["ADMIN_SECRET"];
const MFR_SECRET = process.env["MFR_SECRET"];

if (!CONTRACT_ID) {
  console.error("Missing CONTRACT_ID env var — set it to the Day 1 testnet deployment.");
  process.exit(1);
}
if (!ADMIN_SECRET || !MFR_SECRET) {
  console.error("Missing ADMIN_SECRET or MFR_SECRET env vars.");
  process.exit(1);
}

const adminKP = Keypair.fromSecret(ADMIN_SECRET);
const mfrKP = Keypair.fromSecret(MFR_SECRET);

const client = new ChainWarrantyClient({
  rpcUrl: RPC_URL,
  contractId: CONTRACT_ID,
});

// Use a unique serial for each test run so re-runs don't hit TokenExists.
const rawSerial = `integration-test-${Date.now()}`;
const serialHash = new Uint8Array(
  crypto.createHash("sha256").update(rawSerial).digest()
);

async function run(): Promise<void> {
  console.log("=== ChainWarranty SDK integration test ===");
  console.log(`Contract: ${CONTRACT_ID}`);
  console.log(`Serial:   ${rawSerial}`);

  // 1. Add the manufacturer (idempotent — may already exist; ignore error)
  try {
    console.log("\n1. add_manufacturer ...");
    await client.addManufacturer(adminKP, mfrKP.publicKey(), "Integration Test Mfr");
    console.log("   ✓ manufacturer added");
  } catch (e) {
    console.log(`   ↳ skipped (${(e as Error).message})`);
  }

  // 2. Mint a token
  console.log("\n2. mint_token ...");
  await client.mintToken(
    mfrKP,
    mfrKP.publicKey(),
    serialHash,
    "integration-product-001",
    12,
    adminKP.publicKey()
  );
  console.log("   ✓ token minted");

  // 3. Verify the token
  console.log("\n3. verify ...");
  const token = await client.verify(serialHash);
  console.log("   token:", token);

  assert.equal(token.status, "Active", "token should be Active");
  assert.equal(
    token.owner,
    adminKP.publicKey(),
    "initial owner should be admin"
  );
  assert.equal(token.product_id, "integration-product-001");
  assert.equal(token.warranty_months, 12);

  // 4. Confirm warranty is currently active
  const nowSecs = Math.floor(Date.now() / 1000);
  const active = ChainWarrantyClient.isWarrantyActive(token, nowSecs);
  assert.equal(active, true, "warranty should still be active");
  console.log("   ✓ warranty active");

  console.log("\n=== All assertions passed ✓ ===");
}

run().catch((err) => {
  console.error("\nTest failed:", err);
  process.exit(1);
});
