# Plan.md — 7-Day Intensive Build: ChainWarranty to 85% Completion

This plan takes ChainWarranty from its current state (Soroban contract implemented and
unit-tested, nothing else built) to **~85% completion** across the full stack described
in `README.md`, over 7 focused development days. The remaining ~15% — audit, mainnet
deployment, mobile app, full multisig/delegation, load testing — is intentionally left
for after this plan; see [What's still left after Day 7](#whats-still-left-after-day-7).

**`README.md` is the spec.** Every day below builds only what the README already
describes (architecture, repo structure, contract reference, roadmap). No day should
introduce features, services, or architectural changes that aren't already implied by
the README. If a day's work suggests the README itself needs updating (a new field, a
changed policy), update the README explicitly as part of that day's deliverables rather
than silently drifting from it.

## How to use this plan

Each day has a **Daily Prompt** — a self-contained prompt written to be handed directly
to an AI coding assistant (e.g. Claude Code) with this repository checked out. Run them
in order; each assumes the previous days' work is merged. Every prompt opens by pointing
the assistant back at `README.md` and this file so scope stays anchored, and closes by
asking it to update the checkboxes below and the README's "Project status" table.

## Completion tracking

| # | Component | README section | Weight | Cumulative after |
|---|---|---|---|---|
| — | Smart contract core (mint/transfer/claim/void/verify) | Contract reference | 15% (done) | Day 0 baseline |
| 1 | Contract hardening + testnet deployment | Security model & known limitations, Getting started | 10% (done) | 25% |
| 2 | Shared TypeScript SDK (`packages/sdk`) | Repository structure, Tech stack | 10% (done) | 35% |
| 3 | Indexer service + off-chain schema | Architecture, Events | 10% (done) | 45% |
| 4 | Public verification web app | How it works (steps 2–3), QR code format | 10% (done) | 55% |
| 5 | Manufacturer dashboard | How it works (steps 1, 4, 5) | 10% (done) | 65% |
| 6 | QR generation pipeline + full integration wiring | QR code format, Architecture | 10% | 75% |
| 7 | E2E testing, CI/CD, docs polish, security pass | Testing, Contributing | 10% | **85%** |

Check off each row's box in the README's "Project status" table as that day completes —
this table and that one should always agree.

---

## Day 1 — Contract hardening & testnet deployment

**Goal:** Close the gaps listed under "Security model & known limitations" that are
cheap to fix now, add the test cases the README's Testing section calls out as missing,
and get a real `CONTRACT_ID` on testnet that every later day builds against.

**In scope (from README):**
- Additional unit tests: expired-warranty claims, inactive-manufacturer minting
  attempts, unauthorized transfer attempts (explicitly named in Testing section).
- Optional: namespace `serial_hash` as `sha256(manufacturer || serial)` if you decide
  to adopt that mitigation — document the decision either way in the README.
- Deploy to testnet per the exact commands already in "Smart contract: build, test,
  deploy."

**Out of scope:** mainnet deployment, multisig/delegation implementation (roadmap item,
not a Day 1 item), any new contract functions not already in the Contract reference table.

**Deliverables / Definition of done:**
- [x] `cargo test` passes with the three new test cases added
- [x] Contract deployed to testnet; `CONTRACT_ID` recorded in README under Roadmap
- [x] `initialize` called, at least one test manufacturer added, one token minted on
      testnet as a smoke test
- [x] README "Project status" and this file's tracking table updated

**Daily Prompt:**

```
Read README.md and Plan.md in full before doing anything else. Today is Day 1 of the
plan in Plan.md: "Contract hardening & testnet deployment."

Work only within contracts/registry. Do not add contract functions that aren't already
listed in README.md's "Contract reference" table, and do not change the data model
unless I explicitly ask for it in this prompt.

Tasks:
1. Add three unit tests to contracts/registry/src/test.rs, matching the gaps named in
   README.md's Testing section: (a) filing a claim after the warranty term has elapsed
   should fail with WarrantyExpired, (b) minting from an address that was added via
   add_manufacturer but then deactivated via set_manufacturer_active should fail with
   ManufacturerInactive, (c) calling transfer_ownership from an address that is not the
   current owner should fail authorization.
2. Run cargo test and fix anything that doesn't compile or pass.
3. Build the contract with `stellar contract build` and deploy it to Stellar testnet,
   following the exact steps already documented in README.md's "Smart contract: build,
   test, deploy" section — don't invent different CLI flags or flows.
4. Call initialize, add_manufacturer for one test manufacturer, and mint_token for one
   test product as a smoke test. Confirm verify() returns it correctly.
5. Update README.md: record the testnet CONTRACT_ID in the Roadmap section, and tick
   "Testnet deployment" in the Project status table.
6. Update Plan.md: check off Day 1's Definition of done items and update the
   Completion tracking table's cumulative percentage to 25%.

Stop and ask me before making any change that isn't listed above.
```

---

## Day 2 — Shared TypeScript SDK (`packages/sdk`)

**Goal:** Build the thin TypeScript client that every later frontend/service day will
import, so contract calls (`mint_token`, `transfer_ownership`, `verify`, etc.) aren't
duplicated across the web app, dashboard, and indexer.

**In scope (from README):** exactly the 11 functions in the Contract reference table,
typed request/response shapes matching the Data model section, using
`@stellar/stellar-sdk` for RPC as named in the Tech stack table.

**Out of scope:** any UI, any business logic beyond thin wrapping (no caching layer,
no retry policy beyond basic error surfacing) — keep it a faithful client, not a
framework.

**Deliverables / Definition of done:**
- [x] `packages/sdk` exists with a typed client class/module exposing all 11 contract
      functions from the reference table, plus typed `ProductToken`, `TransferEvent`,
      `Claim` matching the Data model section
- [x] Package builds (`tsc --noEmit` clean) and has at least one integration test
      against the Day 1 testnet deployment (mint + verify round-trip)
- [x] README's repo structure table's `packages/sdk` row updated from "planned" to
      a short real description if the shape differs from what's documented

**Daily Prompt:**

```
Read README.md and Plan.md in full before doing anything else. Today is Day 2 of the
plan in Plan.md: "Shared TypeScript SDK (packages/sdk)."

Build packages/sdk as a TypeScript package that wraps the Soroban contract deployed on
Day 1. It must expose exactly the functions listed in README.md's "Contract reference"
table (initialize, add_manufacturer, set_manufacturer_active, mint_token,
transfer_ownership, file_claim, resolve_claim, void_token, verify, get_history,
get_claims) — no more, no fewer — and typed models matching the "Data model" section
(ProductToken, TransferEvent, Claim, and their enums).

Use @stellar/stellar-sdk for RPC calls, per README.md's Tech stack table. Read the
CONTRACT_ID I deployed on Day 1 from an environment variable rather than hardcoding it.

Do not build any UI in this step. Do not add functions or fields beyond what's in
README.md — if something seems missing, tell me instead of inventing it.

Tasks:
1. Scaffold packages/sdk (package.json, tsconfig, src/) per the repo structure in
   README.md.
2. Implement the typed client wrapping all 11 contract functions.
3. Write one integration test that mints a token and verifies it against the real
   testnet deployment from Day 1.
4. Update Plan.md: check off Day 2's items, set cumulative completion to 35%.
5. Update README.md's repo structure table if the actual package layout differs from
   what's currently written there.

Stop and ask me before adding any dependency not already implied by README.md's Tech
stack table.
```

---

## Day 3 — Indexer service + off-chain schema

**Goal:** Build the event-listening service the Architecture diagram shows subscribing
to `mint`, `transfer`, `claim`, `void` and populating an off-chain Postgres DB, so later
UI work doesn't need to hit the chain for every read.

**In scope (from README):** exactly the four events in the Events table; the DB holds
what the README says belongs off-chain (PII, claim attachments, search index) — not a
duplicate of on-chain state as source of truth.

**Out of scope:** any customer-facing API beyond what's needed to prove the indexer
works (a `SELECT` script or a minimal internal read endpoint is enough — the real
public API comes in Day 4/5).

**Deliverables / Definition of done:**
- [x] `services/indexer` exists, subscribes to the four contract events, writes rows
      to Postgres
- [x] A documented Postgres schema (migration files or `schema.sql`) covering tokens,
      transfer history, claims, and manufacturer records — mirroring the contract's
      Data model, plus off-chain-only columns (owner PII fields, claim attachments)
      the contract intentionally excludes
- [x] Verified against Day 1's testnet deployment: minting/transferring/filing a claim
      on-chain shows up in the DB within a reasonable poll/subscribe interval
- [x] README repo structure and Project status updated

**Daily Prompt:**

```
Read README.md and Plan.md in full before doing anything else. Today is Day 3 of the
plan in Plan.md: "Indexer service + off-chain schema."

Build services/indexer per README.md's Architecture diagram: it must subscribe to
exactly the four contract events in README.md's "Events" table (mint, transfer, claim,
void) and write corresponding rows to a Postgres database.

The off-chain DB schema should mirror the on-chain Data model (ProductToken,
TransferEvent, Claim) plus the off-chain-only data README.md explicitly says belongs
off-chain: owner PII and claim attachments/documentation. Do not duplicate on-chain
state as if the DB were authoritative — the contract remains the source of truth for
authenticity/ownership, per README.md's Architecture section design principles.

Use packages/sdk from Day 2 to talk to the contract rather than writing new RPC code.

Do not build a public-facing API in this step — a simple internal script or minimal
read endpoint to prove data landed correctly is enough.

Tasks:
1. Scaffold services/indexer.
2. Write the Postgres schema (migrations or schema.sql) for tokens, transfer history,
   claims, and manufacturers, with the off-chain-only fields noted above.
3. Implement the event subscription loop using packages/sdk against the Day 1 testnet
   deployment.
4. Prove it works: mint/transfer/file a claim on-chain, confirm the rows appear in
   Postgres.
5. Update Plan.md: check off Day 3's items, set cumulative completion to 45%.
6. Update README.md's repo structure and Project status table.

Stop and ask me before adding any off-chain field that isn't already implied by
README.md.
```

---

## Day 4 — Public verification web app

**Goal:** Build the customer-facing side of `apps/web`: scan/enter a serial, see
authenticity, warranty status, and transfer history — the flow described in "How it
works" steps 2–3 and the "QR code format" section.

**In scope (from README):** a page at the URL shape given in "QR code format"
(`/<CONTRACT_ID>/<RAW_SERIAL_NUMBER>`), client-side SHA-256 hashing of the serial before
calling `verify`, display of `ProductToken`, `get_history`, and `get_claims` data.

**Out of scope:** minting, manufacturer management, claim filing (those are Day 5) —
this day is read-only and public, no auth required.

**Deliverables / Definition of done:**
- [x] `apps/web` scaffolded (Next.js + TypeScript per Tech stack table)
- [x] Verification route implemented exactly at the URL shape in README's QR code
      format section, hashing client-side as described
- [x] Page renders authenticity status, warranty status (active/expired), owner
      (address only, no PII), transfer history, and any claims for a real Day 1 testnet
      token
- [x] Handles `TokenNotFound` and `TokenVoided` gracefully (these are real contract
      errors per the Errors table, not edge cases to ignore)

**Daily Prompt:**

```
Read README.md and Plan.md in full before doing anything else. Today is Day 4 of the
plan in Plan.md: "Public verification web app."

Scaffold apps/web (Next.js + TypeScript, per README.md's Tech stack table) and build
only the public verification flow described in README.md's "How it works" (steps 2–3)
and "QR code format" sections:

- Route shape must match README.md's QR code format section exactly:
  /<CONTRACT_ID>/<RAW_SERIAL_NUMBER>
- Hash the raw serial number client-side with SHA-256 before calling verify() — the raw
  serial must never be sent to the contract, per README.md.
- Use packages/sdk (Day 2) to call verify, get_history, and get_claims.
- Display: authenticity status, warranty status computed from mint_ts and
  warranty_months (active vs. expired — use the same 30-day-month math the contract
  uses), current owner as a Stellar address only (no PII, per README.md's security
  model), transfer history, and claims.
- Handle the TokenNotFound and TokenVoided errors from README.md's Errors table with
  clear user-facing messages — don't let them surface as raw exceptions.

Do not build minting, manufacturer management, or claim-filing UI today — those are
Day 5. Do not add authentication to this page; it's explicitly public/read-only per the
Architecture section.

Tasks:
1. Scaffold apps/web.
2. Implement the verification route and page as specified above.
3. Test it end-to-end against a real token minted on the Day 1 testnet deployment,
   including a voided-token case (void a test token and confirm the page handles it).
4. Update Plan.md: check off Day 4's items, set cumulative completion to 55%.
5. Update README.md's Project status table.

Stop and ask me before adding any feature (search, favorites, notifications, etc.) not
already described in README.md.
```

---

## Day 5 — Manufacturer dashboard

**Goal:** Build the authenticated side of `apps/web`: minting, manufacturer management,
and claim resolution — the flow described in "How it works" steps 1, 4, and 5.

**In scope (from README):** wallet-signed calls to `mint_token`, `add_manufacturer`,
`set_manufacturer_active` (admin-only), `resolve_claim`, `void_token` — using
`packages/sdk`, with the manufacturer's own Stellar wallet doing the `require_auth`
signing (Freighter or equivalent).

**Out of scope:** any custom auth system beyond wallet-signature auth — the contract
itself is the authorization boundary (`require_auth` on manufacturer/admin addresses),
so the dashboard shouldn't invent a separate login system.

**Deliverables / Definition of done:**
- [x] Manufacturer-authenticated pages: mint a token, view/manage manufacturers
      (admin only), view and resolve pending claims, void a token
- [x] All state-changing calls go through wallet signing, not a backend-held key
- [x] Claims list pulls from the indexer's DB (Day 3) for speed, but resolution/void
      actions write on-chain via `packages/sdk`, consistent with the Architecture
      section's "contract is the source of truth" principle
- [x] README Project status updated

**Daily Prompt:**

```
Read README.md and Plan.md in full before doing anything else. Today is Day 5 of the
plan in Plan.md: "Manufacturer dashboard."

Add the manufacturer-facing side of apps/web, covering exactly the actions described in
README.md's "How it works" steps 1, 4, and 5: minting tokens, resolving warranty claims,
and voiding tokens for counterfeits/recalls — plus admin-only manufacturer whitelist
management (add_manufacturer, set_manufacturer_active), since those are in the Contract
reference table and gate who can mint.

Authorization must come from wallet signatures (e.g. Freighter) triggering the
contract's own require_auth checks on manufacturer/admin addresses — per README.md's
Architecture principle that the contract is the source of truth. Do not build a
separate username/password or session-based auth system; that's not in README.md's
design.

Use packages/sdk (Day 2) for all contract calls. For displaying the claims queue, you
may read from the indexer's Postgres DB (Day 3) for speed, but the actual
resolve_claim/void_token actions must be real signed on-chain transactions, not just DB
writes.

Tasks:
1. Add a mint-token form (product ID, serial number input which you hash client-side,
   warranty months, initial owner address) that calls mint_token via a connected
   manufacturer wallet.
2. Add an admin-only manufacturer management page (add_manufacturer,
   set_manufacturer_active) gated to the contract's admin address.
3. Add a claims queue for the connected manufacturer showing filed claims (from the
   indexer DB), with approve/reject buttons calling resolve_claim on-chain.
4. Add a void-token action calling void_token on-chain with a reason.
5. Test the full loop against the Day 1 testnet deployment: mint a token as a test
   manufacturer, confirm it appears on the Day 4 public verification page.
6. Update Plan.md: check off Day 5's items, set cumulative completion to 65%.
7. Update README.md's Project status table.

Stop and ask me before adding any feature not named above or in README.md.
```

---

## Day 6 — QR generation pipeline + full integration wiring

**Goal:** Close the loop the README's Architecture diagram describes end-to-end: mint →
QR code generated → printed/exported → scanned → verified, with the indexer keeping
everything else in sync in the background.

**In scope (from README):** QR generation at mint time per the Tech stack table
(`qrcode` or equivalent), encoding the URL shape from the QR code format section;
wiring the dashboard, verification page, and indexer together so a mint on Day 5's
dashboard produces a working QR that resolves on Day 4's verification page and shows up
in Day 3's indexer DB — all without manual steps.

**Out of scope:** physical printing/label integration (this repo produces the QR image
and URL, not a print job).

**Deliverables / Definition of done:**
- [ ] QR code generated automatically after a successful `mint_token`, downloadable
      from the dashboard, encoding the exact URL shape from README's QR code format
      section
- [ ] Full loop manually tested at least once: mint on dashboard → QR appears → scan
      (or paste URL) → verification page shows correct data → indexer DB has the
      matching row
- [ ] Any rough edges found during wiring are fixed, not worked around

**Daily Prompt:**

```
Read README.md and Plan.md in full before doing anything else. Today is Day 6 of the
plan in Plan.md: "QR generation pipeline + full integration wiring."

Add QR code generation to the manufacturer dashboard (Day 5): after a successful
mint_token call, generate and offer a downloadable QR code encoding the exact URL shape
given in README.md's "QR code format" section
(https://verify.chainwarranty.example/<CONTRACT_ID>/<RAW_SERIAL_NUMBER>, adapted to
whatever domain apps/web actually runs on in this environment). Use a QR library
consistent with README.md's Tech stack table.

Then wire the full stack together and manually verify the complete loop described in
README.md's "How it works": mint a token on the Day 5 dashboard, confirm a QR code is
generated, open the QR's URL and confirm the Day 4 verification page shows correct
data, and confirm the Day 3 indexer has recorded the mint event in Postgres.

Fix any integration gaps you find (env vars not wired between apps/web and
services/indexer, CORS issues, mismatched types between packages/sdk consumers, etc.)
rather than papering over them — this day exists specifically to catch what the
previous five days missed when built in isolation.

Do not add features beyond QR generation and fixing integration issues; no new pages or
contract calls today.

Tasks:
1. Implement QR generation on successful mint in the dashboard.
2. Run the full mint → QR → scan → verify → indexer loop manually and document the
   steps in a short "Local end-to-end walkthrough" section you add to README.md's
   Getting started section.
3. Fix whatever breaks along the way.
4. Update Plan.md: check off Day 6's items, set cumulative completion to 75%.
5. Update README.md's Project status table.

Stop and ask me before changing anything about the URL shape or data model that
README.md currently documents — if the wiring reveals the README needs to change,
propose the change to me first.
```

---

## Day 7 — E2E testing, CI/CD, docs polish, security pass

**Goal:** Turn the working-but-manual system from Day 6 into something a new
contributor could clone and trust, per the README's Contributing section, and do a
focused pass over the Security model & known limitations section to make sure nothing
regressed.

**In scope (from README):** automated tests across contract + indexer + web (at least
one real E2E test automating Day 6's manual walkthrough), a CI workflow running
`cargo test` and the frontend's test/lint/build on every PR, and a documentation pass
so `README.md` accurately reflects the shipped system rather than the pre-build plan.

**Out of scope:** the items explicitly deferred to [after Day 7](#whats-still-left-after-day-7)
— don't attempt an audit or mainnet deploy today; a security *pass* here means
re-reading the Security model section and confirming each listed limitation is still
accurately described, not resolving all of them.

**Deliverables / Definition of done:**
- [ ] At least one automated E2E test (can be a script, doesn't need a full browser
      test framework) covering mint → QR → verify → indexer, replacing Day 6's manual
      walkthrough
- [ ] CI workflow (e.g. GitHub Actions) running `cargo test`, and lint/build/test for
      `apps/web`, `packages/sdk`, and `services/indexer`, on every PR
- [ ] `CONTRIBUTING.md` added, consistent with the README's existing Contributing
      section (don't duplicate it — link to it and add setup detail)
- [ ] README's Security model & known limitations section reviewed against the actual
      shipped code; anything that changed (e.g. if Day 1 added serial-hash
      namespacing) is corrected
- [ ] README's Project status, Roadmap, and repo structure sections all reflect the
      real, current state of the repo — no more "planned"/"not started" markers for
      anything built this week
- [ ] Plan.md's tracking table shows 85% and every day's checkboxes are ticked

**Daily Prompt:**

```
Read README.md and Plan.md in full before doing anything else. Today is Day 7, the
final day of the plan in Plan.md: "E2E testing, CI/CD, docs polish, security pass."

This day does not add new product features. It hardens and documents what Days 1–6
built, per README.md's existing Testing and Contributing sections.

Tasks:
1. Write at least one automated end-to-end test that reproduces the manual walkthrough
   from Day 6 (mint → QR generated → verification page resolves it correctly →
   indexer DB has the matching row). A script under a scripts/ or e2e/ directory that
   asserts each step is sufficient; it doesn't need a full browser-automation
   framework unless one is already in use.
2. Add a CI workflow (e.g. .github/workflows/ci.yml) that runs: cargo test for the
   contract, and lint/build/test for apps/web, packages/sdk, and services/indexer, on
   every pull request.
3. Add CONTRIBUTING.md. It should link to README.md's existing Contributing section
   rather than duplicate it, and add any local-setup detail a new contributor would
   need that isn't already in Getting started.
4. Re-read README.md's "Security model & known limitations" section against the
   actual code as it exists today. Correct any item that's now stale (for example, if
   Day 1 implemented serial-hash namespacing, that item should say so rather than
   still listing it as a limitation). Do not remove a real limitation just because
   it's inconvenient — only correct items that are factually outdated.
5. Sweep README.md's Project status, Roadmap, and repository structure sections and
   update every marker to reflect reality — nothing built this week should still say
   "planned" or "not started."
6. Update Plan.md: check off every remaining item across all 7 days, and set the
   Completion tracking table's final cumulative percentage to 85%.

Stop and ask me before starting anything from Plan.md's "What's still left after Day 7"
list (audit, mainnet deployment, mobile app, multisig, load testing) — those are
explicitly out of scope for this plan.
```

---

## What's still left after Day 7

By design, this plan stops at 85%. The remaining ~15% is work that either needs
resources outside a solo development sprint (a paid audit) or is explicitly marked as
future work in `README.md`'s own Roadmap:

- **Third-party smart contract audit** — required before any real funds/products rely
  on this in production; not something to simulate or skip.
- **Mainnet deployment** — should only happen after the audit above.
- **Manufacturer key delegation / multisig support** — flagged in README's Security
  model section as a known gap; needs its own design pass, not a rushed Day 8.
- **Mobile companion app (`apps/mobile`)** — listed as optional in the repo structure;
  the web verification page already covers the core "scan and verify" need.
- **Warranty-policy-on-resale configuration** — a real product decision (does
  warranty shorten/void/transfer intact on resale?) that needs manufacturer input,
  not an engineering guess.
- **Load testing / production hardening** of the indexer and web app.
- **License finalization** — README currently flags this as undecided.

Treat reaching 85% as "a robust foundation for contributors," exactly as intended — not
as a system ready for real warranties on real products.