import { createClient } from '@libsql/client';

if (!process.env.TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL environment variable is required');
}

if (!process.env.TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_AUTH_TOKEN environment variable is required');
}

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Helper function to execute queries safely
export async function query<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  try {
    const result = await db.execute({ sql, args: params });
    return result.rows as T[];
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
    const result = await db.execute({ sql, args: params });
    return result.rowsAffected;
  } catch (error) {
    console.error('Database execution error:', error);
    throw error;
  }
}
