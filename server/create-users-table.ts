import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'jobtracker',
  user: 'postgres',
  password: 'Headboy123#',
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  ssl: false
});

async function createUsersTable() {
  try {
    console.log('🔍 Enabling UUID extension...');
    
    // Enable UUID extension
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    
    console.log('✅ UUID extension enabled!');
    
    console.log('🔍 Creating users table...');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        subscription VARCHAR(20) DEFAULT 'FREE',
        weekly_target INTEGER DEFAULT 10,
        monthly_target INTEGER DEFAULT 40,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('✅ Users table created!');
    
    // Create index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    
    console.log('✅ Index created!');
    
    // Verify table exists
    const checkResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users';
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Verified: users table exists');
    } else {
      console.log('❌ Error: users table not found after creation');
    }
    
  } catch (error: any) {
    console.error('❌ Error creating users table:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

createUsersTable().catch(console.error);

