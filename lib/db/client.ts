import { createClient, type TransactionMode } from '@libsql/client';

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL environment variable is required');
}

if (!TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_AUTH_TOKEN environment variable is required');
}

export const db = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
});

async function runStatement<T = any>(
  sql: string,
  params: any[] = [],
  mode: TransactionMode = 'write'
) {
  const transaction = await db.transaction(mode);

  try {
    const result = await transaction.execute({ sql, args: params });
    await transaction.commit();
    return result as T;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {
      // Ignore rollback errors so the original failure is preserved.
    }

    throw error;
  }
}

// Execute read queries through an interactive transaction to avoid the
// @libsql/client 0.6.x migration polling bug on Turso AWS endpoints.
export async function query<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  try {
    const result = await runStatement<{ rows: T[] }>(sql, params, 'read');
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Helper function for single row queries
export async function queryOne<T = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results[0] || null;
}

// Helper function for inserts/updates that return affected rows
export async function execute(sql: string, params: any[] = []): Promise<number> {
  try {
    const result = await runStatement<{ rowsAffected: number }>(sql, params, 'write');
    return result.rowsAffected;
  } catch (error) {
    console.error('Database execution error:', error);
    throw error;
  }
}
