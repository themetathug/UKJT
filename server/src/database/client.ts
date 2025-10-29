import { Pool } from 'pg';
import { logger } from '../utils/logger';

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: 5432,
  database: 'jobtracker',
  user: 'postgres',
  password: 'postgres',
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

// Initialize database connection
export async function initializeDatabase() {
  try {
    await pool.query('SELECT NOW()');
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

// Graceful shutdown
export async function disconnectDatabase() {
  try {
    await pool.end();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Database disconnect error:', error);
  }
}

// Export pool for queries
export { pool };
