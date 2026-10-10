/**
 * GET /api/claims
 *
 * Proxies the indexer's claims table so the dashboard can read filed claims
 * without talking to Postgres directly from the browser.
 *
 * Queries: ?status=Filed (default) | all
 *
 * The indexer DB connection string comes from INDEXER_DATABASE_URL (server-only).
 * Falls back to a mock response in development when the env var is absent.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? "Filed";

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
    const query =
      statusFilter === "all"
        ? "SELECT id, serial_hash, claimant, ts, description, status FROM claims ORDER BY ts DESC LIMIT 200"
        : "SELECT id, serial_hash, claimant, ts, description, status FROM claims WHERE status = $1 ORDER BY ts DESC LIMIT 200";
    const params = statusFilter === "all" ? [] : [statusFilter];
    const result = await pool.query(query, params);
    await pool.end();
    return NextResponse.json(result.rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
