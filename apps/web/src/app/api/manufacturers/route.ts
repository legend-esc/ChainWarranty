/**
 * GET /api/manufacturers
 *
 * Returns the manufacturer whitelist from the indexer DB for display in the
 * admin manufacturer management page.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const dbUrl = process.env["INDEXER_DATABASE_URL"];
  if (!dbUrl) {
    return NextResponse.json([], {
      headers: { "X-Warning": "INDEXER_DATABASE_URL not set — returning empty array" },
    });
  }

  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: dbUrl });
    const result = await pool.query(
      "SELECT address, name, active FROM manufacturers ORDER BY created_at ASC"
    );
    await pool.end();
    return NextResponse.json(result.rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
