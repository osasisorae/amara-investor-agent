const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrate() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env');
    process.exit(1);
  }

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.log('🔄 Running database migrations...\n');

  const migrationFile = path.join(__dirname, '../migrations/001_initial_schema.sql');
  const sql = fs.readFileSync(migrationFile, 'utf-8');

  try {
    // Use batch execution
    const results = await db.batch(
      [{ sql, args: [] }],
      'write'
    );
    console.log('✅ Migration complete! Tables created successfully.');
  } catch (error) {
    // If batch fails, try execute multiple
    console.log('Trying alternative method...\n');
    try {
      await db.executeMultiple(sql);
      console.log('✅ Migration complete! Tables created successfully.');
    } catch (err) {
      console.error('❌ Migration failed:', err.message);
      process.exit(1);
    }
  }

  process.exit(0);
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
