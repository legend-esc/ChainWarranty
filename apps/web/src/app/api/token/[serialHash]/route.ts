/**
 * GET /api/token/[serialHash]
 *
 * Returns cached token data from the indexer DB for a given serial hash (hex).
 * Used by the verification page as a fast read path; the contract remains the
 * source of truth — this is supplemental context only.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { serialHash: string } }
): Promise<Response> {
  const { serialHash } = params;
  if (!/^[0-9a-f]{64}$/i.test(serialHash)) {
    return NextResponse.json({ error: "Invalid serial hash" }, { status: 400 });
  }

  const dbUrl = process.env["INDEXER_DATABASE_URL"];
  if (!dbUrl) {
    return NextResponse.json(null, {
      headers: { "X-Warning": "INDEXER_DATABASE_URL not set" },
    });
  }

  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: dbUrl });
    const result = await pool.query(
      `SELECT t.serial_hash, t.product_id, t.manufacturer, t.mint_ts,
              t.warranty_months, t.owner, t.status, t.transfer_count,
              t.void_reason,
              m.name AS manufacturer_name
       FROM tokens t
       LEFT JOIN manufacturers m ON m.address = t.manufacturer
       WHERE t.serial_hash = $1`,
      [serialHash.toLowerCase()]
    );
    await pool.end();
    return NextResponse.json(result.rows[0] ?? null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
