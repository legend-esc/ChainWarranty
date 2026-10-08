/**
 * Postgres client wrapper.
 * Reads DATABASE_URL from environment and exposes a query helper.
 */

import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env["DATABASE_URL"];
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
