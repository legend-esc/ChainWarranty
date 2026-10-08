/**
 * Event handlers — write contract events into Postgres.
 *
 * One handler per event type from README.md's Events table:
 *   mint, transfer, claim, void
 */

import type { PoolClient } from "pg";

// ---------------------------------------------------------------------------
// mint event
// ---------------------------------------------------------------------------

export interface MintEventPayload {
  serial_hash: string;   // hex
  product_id: string;
  manufacturer: string;  // Stellar address
  mint_ts: number;
  warranty_months: number;
  initial_owner: string; // Stellar address
  ledger_seq?: number;
}

export async function handleMint(
  client: PoolClient,
  payload: MintEventPayload
): Promise<void> {
  // Upsert manufacturer row (may not exist yet if they registered after last sync)
  await client.query(
    `INSERT INTO manufacturers (address, name)
     VALUES ($1, 'Unknown')
     ON CONFLICT (address) DO NOTHING`,
    [payload.manufacturer]
  );

  await client.query(
    `INSERT INTO tokens
       (serial_hash, product_id, manufacturer, mint_ts, warranty_months, owner, status, transfer_count)
     VALUES ($1, $2, $3, $4, $5, $6, 'Active', 0)
     ON CONFLICT (serial_hash) DO UPDATE SET
       owner           = EXCLUDED.owner,
       status          = EXCLUDED.status,
       transfer_count  = EXCLUDED.transfer_count,
       updated_at      = NOW()`,
    [
      payload.serial_hash,
      payload.product_id,
      payload.manufacturer,
      payload.mint_ts,
      payload.warranty_months,
      payload.initial_owner,
    ]
  );

  await client.query(
    `UPDATE indexer_cursor SET last_ledger = $1, updated_at = NOW()
     WHERE event_type = 'mint' AND last_ledger < $1`,
    [payload.ledger_seq ?? 0]
  );
}

// ---------------------------------------------------------------------------
// transfer event
// ---------------------------------------------------------------------------

export interface TransferEventPayload {
  serial_hash: string;
  from_address: string;
  to_address: string;
  ts: number;
  ledger_seq?: number;
}

export async function handleTransfer(
  client: PoolClient,
  payload: TransferEventPayload
): Promise<void> {
  await client.query(
    `UPDATE tokens
     SET owner = $2, transfer_count = transfer_count + 1, updated_at = NOW()
     WHERE serial_hash = $1`,
    [payload.serial_hash, payload.to_address]
  );

  await client.query(
    `INSERT INTO transfer_events (serial_hash, from_address, to_address, ts, ledger_seq)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      payload.serial_hash,
      payload.from_address,
      payload.to_address,
      payload.ts,
      payload.ledger_seq ?? null,
    ]
  );

  await client.query(
    `UPDATE indexer_cursor SET last_ledger = $1, updated_at = NOW()
     WHERE event_type = 'transfer' AND last_ledger < $1`,
    [payload.ledger_seq ?? 0]
  );
}

// ---------------------------------------------------------------------------
// claim event
// ---------------------------------------------------------------------------

export interface ClaimEventPayload {
  serial_hash: string;
  claimant: string;
  ts: number;
  description: string;
  ledger_seq?: number;
}

export async function handleClaim(
  client: PoolClient,
  payload: ClaimEventPayload
): Promise<void> {
  await client.query(
    `INSERT INTO claims (serial_hash, claimant, ts, description, status)
     VALUES ($1, $2, $3, $4, 'Filed')
     ON CONFLICT DO NOTHING`,
    [payload.serial_hash, payload.claimant, payload.ts, payload.description]
  );

  await client.query(
    `UPDATE indexer_cursor SET last_ledger = $1, updated_at = NOW()
     WHERE event_type = 'claim' AND last_ledger < $1`,
    [payload.ledger_seq ?? 0]
  );
}

// ---------------------------------------------------------------------------
// void event
// ---------------------------------------------------------------------------

export interface VoidEventPayload {
  serial_hash: string;
  reason: string;
  ledger_seq?: number;
}

export async function handleVoid(
  client: PoolClient,
  payload: VoidEventPayload
): Promise<void> {
  await client.query(
    `UPDATE tokens
     SET status = 'Voided', void_reason = $2, updated_at = NOW()
     WHERE serial_hash = $1`,
    [payload.serial_hash, payload.reason]
  );

  await client.query(
    `UPDATE indexer_cursor SET last_ledger = $1, updated_at = NOW()
     WHERE event_type = 'void' AND last_ledger < $1`,
    [payload.ledger_seq ?? 0]
  );
}
