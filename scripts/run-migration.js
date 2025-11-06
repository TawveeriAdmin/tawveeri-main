#!/usr/bin/env node

/**
 * Run SQL Migration Script
 * This script runs SQL migrations using Node.js without requiring psql
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('═════════════════════════════════════════════════════');
  console.log('  Running Database Migration');
  console.log('═════════════════════════════════════════════════════');
  console.log('');

  // Get migration file from command line argument
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('❌ Error: No migration file specified');
    console.error('');
    console.error('Usage: node scripts/run-migration.js <path-to-sql-file>');
    console.error('Example: node scripts/run-migration.js scripts/database/04-fix-user-insert-policy.sql');
    console.error('');
    process.exit(1);
  }

  const migrationPath = path.resolve(process.cwd(), migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Error: Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  // Verify environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.SUPABASE_DB_URL;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing environment variables');
    console.error('');
    console.error('Required variables in .env.local:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    console.error('');
    process.exit(1);
  }

  // Read SQL file
  console.log(`📄 Reading migration file: ${migrationFile}`);
  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('');

  // Check if we have direct DB URL (for pg library)
  if (dbUrl) {
    try {
      // Try using pg library if available
      const { Client } = require('pg');
      
      console.log('🔌 Connecting to database...');
      const client = new Client({
        connectionString: dbUrl,
      });

      await client.connect();
      console.log('✅ Connected to database');
      console.log('');

      console.log('🚀 Executing migration...');
      await client.query(sql);
      console.log('✅ Migration executed successfully');
      console.log('');

      await client.end();
      
      console.log('═════════════════════════════════════════════════════');
      console.log('✨ Migration Completed Successfully!');
      console.log('═════════════════════════════════════════════════════');
      console.log('');
      
      return;
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.log('⚠️  pg library not found, trying alternative method...');
        console.log('');
      } else {
        throw error;
      }
    }
  }

  // Fallback: Use Supabase REST API (limited - can't run arbitrary SQL)
  console.log('⚠️  Direct SQL execution requires pg library or psql');
  console.log('');
  console.log('Please install pg library:');
  console.log('  npm install --save-dev pg');
  console.log('');
  console.log('Or install psql and use:');
  console.log(`  psql "$SUPABASE_DB_URL" -f ${migrationFile}`);
  console.log('');
  console.log('Alternatively, you can copy the SQL and run it in Supabase SQL Editor:');
  console.log('');
  console.log('SQL to run:');
  console.log('─────────────────────────────────────────────────────');
  console.log(sql);
  console.log('─────────────────────────────────────────────────────');
  console.log('');
  
  process.exit(1);
}

// Run the script
runMigration().catch(error => {
  console.error('❌ Error:', error.message);
  console.error('');
  process.exit(1);
});

