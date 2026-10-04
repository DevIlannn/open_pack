import dotenv from 'dotenv';
import pg from 'pg';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000
});

pool.on('error', (error) => {
  console.error('Database pool error:', error.message);
});

const PgStore = connectPgSimple(session);

export const sessionStore = new PgStore({
  pool,
  tableName: 'sessions',
  createTableIfMissing: true
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);
} catch (error) {
  console.error('Database schema setup failed:', error.message);
}

export default pool;