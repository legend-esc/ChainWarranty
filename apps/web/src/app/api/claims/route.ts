/**
 * GET /api/claims
 *
 * Proxies the indexer's claims table so the dashboard can read filed claims
 * without talking to Postgres directly from the browser.
 *
 * Query params:
 *   status=Filed|Approved|Rejected|all  (default: Filed)
 *   manufacturer=<Stellar address>       (optional: filter to a manufacturer's tokens)
 *
 * The indexer DB connection string comes from INDEXER_DATABASE_URL (server-only).
 * Falls back to a mock response in development when the env var is absent.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? "Filed";
  const manufacturerFilter = searchParams.get("manufacturer") ?? null;

  const dbUrl = process.env["INDEXER_DATABASE_URL"];
  if (!dbUrl) {
    // Return an informative empty response in dev environments without a DB
    return NextResponse.json([], {
      headers: { "X-Warning": "INDEXER_DATABASE_URL not set — returning empty array" },
    });
  }

  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: dbUrl });

    let query: string;
    let params: unknown[];

    if (statusFilter === "all" && !manufacturerFilter) {
      query =
        `SELECT c.id, c.serial_hash, c.claimant, c.ts, c.description, c.status
         FROM claims c
         ORDER BY c.ts DESC LIMIT 200`;
      params = [];
    } else if (statusFilter === "all" && manufacturerFilter) {
      query =
        `SELECT c.id, c.serial_hash, c.claimant, c.ts, c.description, c.status
         FROM claims c
         JOIN tokens t ON t.serial_hash = c.serial_hash
         WHERE t.manufacturer = $1
         ORDER BY c.ts DESC LIMIT 200`;
      params = [manufacturerFilter];
    } else if (statusFilter !== "all" && !manufacturerFilter) {
      query =
        `SELECT c.id, c.serial_hash, c.claimant, c.ts, c.description, c.status
         FROM claims c
         WHERE c.status = $1
         ORDER BY c.ts DESC LIMIT 200`;
      params = [statusFilter];
    } else {
      query =
        `SELECT c.id, c.serial_hash, c.claimant, c.ts, c.description, c.status
         FROM claims c
         JOIN tokens t ON t.serial_hash = c.serial_hash
         WHERE c.status = $1 AND t.manufacturer = $2
         ORDER BY c.ts DESC LIMIT 200`;
      params = [statusFilter, manufacturerFilter];
    }

    const result = await pool.query(query, params);
    await pool.end();
    return NextResponse.json(result.rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
