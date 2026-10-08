-- ChainWarranty off-chain Postgres schema
-- Migration 001 — initial schema
--
-- Design principle (per README.md): the contract is the source of truth for
-- authenticity and ownership. This DB mirrors on-chain state for fast reads
-- and adds off-chain-only columns (PII, attachments) that must never go on-chain.
--
-- All serial_hash values are stored as 64-char hex strings (lowercase),
-- matching the sha256(serial) encoding used by the contract.

-- ============================================================
-- Manufacturers
-- ============================================================
CREATE TABLE IF NOT EXISTS manufacturers (
    address         TEXT        PRIMARY KEY,          -- Stellar address (G…)
    name            TEXT        NOT NULL,
    active          BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Tokens
-- On-chain fields mirror ProductToken from README.md Data model.
-- ============================================================
CREATE TABLE IF NOT EXISTS tokens (
    serial_hash     TEXT        PRIMARY KEY,          -- hex sha256
    product_id      TEXT        NOT NULL,
    manufacturer    TEXT        NOT NULL REFERENCES manufacturers(address),
    mint_ts         BIGINT      NOT NULL,             -- Unix seconds
    warranty_months INTEGER     NOT NULL,
    owner           TEXT        NOT NULL,             -- current owner Stellar address
    status          TEXT        NOT NULL CHECK (status IN ('Active', 'Voided')),
    transfer_count  INTEGER     NOT NULL DEFAULT 0,
    void_reason     TEXT,                             -- set when voided
    -- off-chain search helpers
    indexed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tokens_manufacturer_idx ON tokens (manufacturer);
CREATE INDEX IF NOT EXISTS tokens_owner_idx         ON tokens (owner);
CREATE INDEX IF NOT EXISTS tokens_status_idx        ON tokens (status);

-- ============================================================
-- Transfer history
-- Mirrors TransferEvent from README.md Data model.
-- ============================================================
CREATE TABLE IF NOT EXISTS transfer_events (
    id              BIGSERIAL   PRIMARY KEY,
    serial_hash     TEXT        NOT NULL REFERENCES tokens(serial_hash),
    from_address    TEXT        NOT NULL,
    to_address      TEXT        NOT NULL,
    ts              BIGINT      NOT NULL,             -- Unix seconds
    ledger_seq      BIGINT,                          -- Soroban ledger sequence
    indexed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transfer_events_serial_hash_idx ON transfer_events (serial_hash);
CREATE INDEX IF NOT EXISTS transfer_events_ts_idx          ON transfer_events (ts);

-- ============================================================
-- Claims
-- Mirrors Claim from README.md Data model.
-- Off-chain-only: attachment_url stores proof-of-purchase / photos.
-- ============================================================
CREATE TABLE IF NOT EXISTS claims (
    id              BIGSERIAL   PRIMARY KEY,
    serial_hash     TEXT        NOT NULL REFERENCES tokens(serial_hash),
    claimant        TEXT        NOT NULL,             -- Stellar address
    ts              BIGINT      NOT NULL,             -- Unix seconds (also used as claim_id on-chain)
    description     TEXT        NOT NULL,
    status          TEXT        NOT NULL CHECK (status IN ('Filed', 'Approved', 'Rejected')),
    -- off-chain-only fields
    attachment_url  TEXT,                            -- link to uploaded proof document
    notes           TEXT,                            -- manufacturer internal notes
    indexed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS claims_serial_hash_idx ON claims (serial_hash);
CREATE INDEX IF NOT EXISTS claims_claimant_idx    ON claims (claimant);
CREATE INDEX IF NOT EXISTS claims_status_idx      ON claims (status);

-- ============================================================
-- Owner PII (off-chain only — never goes on-chain per README.md)
-- Keyed by Stellar address. Optional; populated during warranty registration.
-- ============================================================
CREATE TABLE IF NOT EXISTS owner_pii (
    stellar_address TEXT        PRIMARY KEY,
    full_name       TEXT,
    email           TEXT,
    phone           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexer cursor — tracks last processed ledger per event type
-- ============================================================
CREATE TABLE IF NOT EXISTS indexer_cursor (
    event_type      TEXT        PRIMARY KEY,         -- 'mint' | 'transfer' | 'claim' | 'void'
    last_ledger     BIGINT      NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO indexer_cursor (event_type) VALUES ('mint'), ('transfer'), ('claim'), ('void')
ON CONFLICT DO NOTHING;
