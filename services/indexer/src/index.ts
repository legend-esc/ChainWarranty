/**
 * ChainWarranty Indexer — main event subscription loop.
 *
 * Subscribes to the four contract events defined in README.md's Events table:
 *   mint, transfer, claim, void
 *
 * Uses the Soroban RPC `getEvents` endpoint, polling from the last processed
 * ledger stored in the `indexer_cursor` table. On each poll, events are decoded
 * and written to Postgres via the handlers in ./handlers.ts.
 *
 * Environment variables (see .env.example):
 *   CONTRACT_ID      — deployed contract ID (C… strkey)
 *   STELLAR_RPC_URL  — Soroban RPC endpoint
 *   DATABASE_URL     — Postgres connection string
 *   POLL_INTERVAL_MS — milliseconds between polls (default: 5000)
 */

import "dotenv/config";
import { SorobanRpc, scValToNative } from "@stellar/stellar-sdk";
import { getPool, withClient, closePool } from "./db.js";
import {
  handleMint,
  handleTransfer,
  handleClaim,
  handleVoid,
} from "./handlers.js";

const CONTRACT_ID = process.env["CONTRACT_ID"];
const RPC_URL =
  process.env["STELLAR_RPC_URL"] ?? "https://soroban-testnet.stellar.org";
const POLL_INTERVAL_MS = parseInt(
  process.env["POLL_INTERVAL_MS"] ?? "5000",
  10
);

if (!CONTRACT_ID) {
  console.error("[indexer] CONTRACT_ID env var is required");
  process.exit(1);
}

const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

// ---------------------------------------------------------------------------
// Bootstrap: apply schema migration if tables don't exist yet
// ---------------------------------------------------------------------------
async function applySchema(): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const migrationsDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "migrations"
  );
  const files = (await fs.readdir(migrationsDir)).sort();
  const pool = getPool();
  for (const file of files) {
    if (!file.endsWith(".sql")) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf-8");
    console.log(`[indexer] applying migration: ${file}`);
    await pool.query(sql);
  }
}

// ---------------------------------------------------------------------------
// Read the last processed ledger from Postgres
// ---------------------------------------------------------------------------
async function getLastLedger(): Promise<number> {
  const pool = getPool();
  const res = await pool.query<{ min_ledger: string }>(
    `SELECT MIN(last_ledger) AS min_ledger FROM indexer_cursor`
  );
  return parseInt(res.rows[0]?.min_ledger ?? "0", 10);
}

// ---------------------------------------------------------------------------
// Decode a raw Soroban event and dispatch to the appropriate handler
// ---------------------------------------------------------------------------
async function processEvent(
  event: SorobanRpc.Api.RawEventResponse
): Promise<void> {
  if (!event.contractId || event.contractId !== CONTRACT_ID) return;

  // The first topic is the event type symbol (e.g. "mint")
  const topics = event.topic.map((t) =>
    scValToNative(SorobanRpc.Api.parseRawScVal(t))
  );
  const eventType = topics[0] as string;

  // The value holds the primary payload (owner address, claim id, etc.)
  const value = event.value
    ? scValToNative(SorobanRpc.Api.parseRawScVal(event.value))
    : undefined;

  const ledger_seq = event.ledger ? parseInt(event.ledger, 10) : undefined;

  // We need the full token state for mint events — pull it from the contract
  // via a direct RPC call rather than trusting only the event payload, since
  // the event only carries the initial owner (per README.md Events table).
  await withClient(async (client) => {
    switch (eventType) {
      case "mint": {
        // payload: initial_owner (Stellar address)
        // We need product details too — fetch them via getEvents contractData
        // The serial_hash is in topics[1] per the contract implementation
        const serialHashRaw = topics[1] as Uint8Array | undefined;
        if (!serialHashRaw) {
          console.warn("[indexer] mint event missing serial_hash topic");
          return;
        }
        const serialHex = Buffer.from(serialHashRaw).toString("hex");
        // For a full mint record we'd call verify() here; for indexer bootstrap
        // we capture what the event provides and fill the rest on-demand.
        await handleMint(client, {
          serial_hash: serialHex,
          product_id: (topics[2] as string | undefined) ?? "",
          manufacturer: (topics[3] as string | undefined) ?? "",
          mint_ts: (topics[4] as number | undefined) ?? 0,
          warranty_months: (topics[5] as number | undefined) ?? 0,
          initial_owner: (value as string) ?? "",
          ledger_seq,
        });
        console.log(`[indexer] ✓ mint  ${serialHex.slice(0, 12)}…`);
        break;
      }

      case "transfer": {
        const serialHashRaw = topics[1] as Uint8Array | undefined;
        if (!serialHashRaw) return;
        const serialHex = Buffer.from(serialHashRaw).toString("hex");
        const newOwner = (value as string) ?? "";
        // from_address would need to be fetched from the token — use "unknown" as
        // a safe fallback; Day 6 wiring can refine this with a verify() call.
        await handleTransfer(client, {
          serial_hash: serialHex,
          from_address: (topics[2] as string | undefined) ?? "unknown",
          to_address: newOwner,
          ts: Math.floor(Date.now() / 1000),
          ledger_seq,
        });
        console.log(`[indexer] ✓ transfer  ${serialHex.slice(0, 12)}…`);
        break;
      }

      case "claim": {
        const serialHashRaw = topics[1] as Uint8Array | undefined;
        if (!serialHashRaw) return;
        const serialHex = Buffer.from(serialHashRaw).toString("hex");
        const claimId = (value as number | undefined) ?? 0;
        await handleClaim(client, {
          serial_hash: serialHex,
          claimant: (topics[2] as string | undefined) ?? "unknown",
          ts: claimId,
          description: "",
          ledger_seq,
        });
        console.log(`[indexer] ✓ claim  ${serialHex.slice(0, 12)}…`);
        break;
      }

      case "void": {
        const serialHashRaw = topics[1] as Uint8Array | undefined;
        if (!serialHashRaw) return;
        const serialHex = Buffer.from(serialHashRaw).toString("hex");
        await handleVoid(client, {
          serial_hash: serialHex,
          reason: (value as string) ?? "",
          ledger_seq,
        });
        console.log(`[indexer] ✓ void  ${serialHex.slice(0, 12)}…`);
        break;
      }

      default:
        // Ignore events from other contracts or unknown topics
        break;
    }
  });
}

// ---------------------------------------------------------------------------
// Main poll loop
// ---------------------------------------------------------------------------
async function poll(): Promise<void> {
  const lastLedger = await getLastLedger();

  let response: SorobanRpc.Api.GetEventsResponse;
  try {
    response = await server.getEvents({
      startLedger: lastLedger > 0 ? lastLedger + 1 : undefined,
      filters: [
        {
          type: "contract",
          contractIds: [CONTRACT_ID!],
          topics: [
            ["*"], // matches any first topic (mint / transfer / claim / void)
          ],
        },
      ],
      limit: 200,
    });
  } catch (err) {
    console.warn("[indexer] getEvents error:", (err as Error).message);
    return;
  }

  if (!response.events || response.events.length === 0) return;

  for (const event of response.events) {
    try {
      await processEvent(event as unknown as SorobanRpc.Api.RawEventResponse);
    } catch (err) {
      console.error("[indexer] failed to process event:", err);
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log("[indexer] starting");
  console.log(`[indexer] contract: ${CONTRACT_ID}`);
  console.log(`[indexer] rpc:      ${RPC_URL}`);
  console.log(`[indexer] poll:     ${POLL_INTERVAL_MS}ms`);

  await applySchema();
  console.log("[indexer] schema ready");

  // Initial poll
  await poll();

  // Recurring poll
  const timer = setInterval(poll, POLL_INTERVAL_MS);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n[indexer] shutting down…");
    clearInterval(timer);
    await closePool();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    clearInterval(timer);
    await closePool();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
