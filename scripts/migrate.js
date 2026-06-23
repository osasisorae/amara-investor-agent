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

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      await db.execute(statement);
      console.log('✅', statement.substring(0, 60) + '...');
    } catch (error) {
      // Ignore "already exists" errors
      if (error.message && error.message.includes('already exists')) {
        console.log('⏭️ ', statement.substring(0, 60) + '... (already exists)');
      } else {
        console.error('❌ Failed:', error.message);
        console.error('Statement:', statement);
      }
    }
  }

  console.log('\n✨ Migration complete!');
  process.exit(0);
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
