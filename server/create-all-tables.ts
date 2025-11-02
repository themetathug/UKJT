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

async function createAllTables() {
  try {
    console.log('🔍 Setting up database schema...');
    
    // Enable UUID extension
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    console.log('✅ UUID extension enabled');
    
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
    console.log('✅ Users table created');
    
    // Create applications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        company VARCHAR(255) NOT NULL,
        position VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        job_board_source VARCHAR(100),
        job_url TEXT,
        salary VARCHAR(100),
        status VARCHAR(50) DEFAULT 'APPLIED',
        notes TEXT,
        time_spent INTEGER,
        applied_at TIMESTAMP DEFAULT NOW(),
        response_date TIMESTAMP,
        interview_date TIMESTAMP,
        capture_method VARCHAR(50) DEFAULT 'MANUAL',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Applications table created');
    
    // Create cold_emails table with all fields
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cold_emails (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        recipient_email VARCHAR(255) NOT NULL,
        recipient_name VARCHAR(255),
        company VARCHAR(255),
        subject VARCHAR(500),
        message TEXT,
        position VARCHAR(255),
        location VARCHAR(255),
        job_url TEXT,
        source VARCHAR(50) DEFAULT 'MANUAL',
        sender_email VARCHAR(255),
        sent_at TIMESTAMP DEFAULT NOW(),
        response_date TIMESTAMP,
        responded BOOLEAN DEFAULT FALSE,
        response_time_hours INTEGER,
        conversion_status VARCHAR(50),
        parsed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Cold emails table created');
    
    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cold_emails_user_id ON cold_emails(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cold_emails_sent_at ON cold_emails(sent_at);`);
    console.log('✅ Indexes created');
    
    console.log('\n✅ All tables created successfully!');
    
  } catch (error: any) {
    console.error('❌ Error creating tables:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

createAllTables().catch(console.error);

