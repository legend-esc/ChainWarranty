# Contributing to ChainWarranty

See the [Contributing section in README.md](README.md#contributing) for the general
contribution policy (issues, pull requests, and the requirement to include tests for
contract changes).

This file adds the local setup detail you need to get a working development environment
before your first commit.

---

## Prerequisites

Install all of the prerequisites listed in
[README.md → Getting started → Prerequisites](README.md#prerequisites):

- Rust stable + `wasm32v1-none` target (`rustup target add wasm32v1-none`)
- [`stellar-cli`](https://developers.stellar.org/docs/tools/cli) v27+
- Node.js 20+ and [pnpm](https://pnpm.io/) v9+ (`npm install -g pnpm`)
- A funded Stellar testnet account (use `stellar keys generate alice --network testnet --fund`)
- [Freighter](https://freighter.app) browser extension connected to Stellar Testnet (for manual dashboard testing)
- PostgreSQL 14+ (for the indexer service and the web app's API routes)

---

## First-time setup

```bash
git clone https://github.com/<your-org>/chainwarranty.git
cd chainwarranty

# Install all Node.js workspace packages
pnpm install

# Verify the Rust contract builds and tests pass
cargo test

# Copy and fill in environment files
cp apps/web/.env.example apps/web/.env.local
cp services/indexer/.env.example services/indexer/.env

# Create the Postgres database and apply the schema
createdb chainwarranty
psql chainwarranty < services/indexer/migrations/001_initial_schema.sql
```

Update the env files with:
- `NEXT_PUBLIC_CONTRACT_ID` — the testnet contract ID from README.md's Roadmap section
- `NEXT_PUBLIC_RPC_URL` — `https://soroban-testnet.stellar.org` (default)
- `INDEXER_DATABASE_URL` / `DATABASE_URL` — your local Postgres connection string

---

## Running the stack locally

```bash
# Terminal 1 — web app
cd apps/web && pnpm dev     # http://localhost:3000

# Terminal 2 — indexer
cd services/indexer && pnpm dev
```

Follow the [Local end-to-end walkthrough](README.md#local-end-to-end-walkthrough) in
the README to verify everything is wired correctly.

---

## Running the automated E2E test

The end-to-end test in `scripts/e2e-test.ts` covers the full mint → verify →
QR URL → indexer DB loop against the real testnet deployment:

```bash
export CONTRACT_ID=<testnet contract ID>
export ADMIN_SECRET=<admin keypair secret>
export MFR_SECRET=<manufacturer keypair secret>
export DATABASE_URL=postgresql://localhost/chainwarranty  # optional

pnpm --filter chainwarranty-scripts e2e
# or: npx tsx scripts/e2e-test.ts
```

---

## CI

Every pull request runs the CI workflow defined in
`.github/workflows/ci.yml`, which checks:

- `cargo test` for the Soroban contract
- TypeScript typecheck for `packages/sdk`, `services/indexer`, and `apps/web`
- ESLint and Next.js build for `apps/web`

Make sure all checks pass before requesting review.

---

## Contract changes

If you change the Soroban contract (`contracts/registry/src/lib.rs`):

1. Add or update unit tests in `contracts/registry/src/test.rs`.
2. Run `cargo test` and confirm all tests pass.
3. If you add a new function, add it to the Contract reference table in README.md and
   expose it in `packages/sdk/src/client.ts`.
4. Note any changes to the data model in the PR description.

Do not deploy to testnet from a PR branch — deployments are done from `main` by
maintainers.
