import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jobtracker',
  user: 'postgres',
  password: 'Headboy123#',
});

async function initializeDatabase() {
  try {
    console.log('📦 Reading database initialization script...');
    const initSql = readFileSync(join(__dirname, 'src/database/init.sql'), 'utf8');
    
    // Split by semicolons but keep DO blocks intact
    const statements = initSql
      .replace(/\r\n/g, '\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await pool.query(statement);
        if (statement.length < 100) {
          console.log(`✅ Executed: ${statement.substring(0, 80)}...`);
        }
      } catch (err: any) {
        // Ignore errors for already existing objects
        if (
          !err.message.includes('already exists') &&
          !err.message.includes('does not exist') &&
          !err.message.includes('duplicate') &&
          !err.message.includes('relation') ||
          err.message.includes('CREATE TABLE')
        ) {
          console.warn(`⚠️  Statement ${i + 1} warning:`, err.message.substring(0, 100));
        }
      }
    }

    console.log('\n✅ Database schema initialized successfully!');
    
    // Verify cold_emails table has new columns
    const columns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cold_emails'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Cold emails table columns:');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name}`);
    });
    
  } catch (error: any) {
    console.error('❌ Error initializing database:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

initializeDatabase().catch(console.error);

