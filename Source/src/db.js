import pg from 'pg';
import dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import chalk from 'chalk';
import logSymbols from 'log-symbols';
import ora from 'ora';

dotenv.config();

const { Pool } = pg;
const PgSessionStore = connectPgSimple(session);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const sessionStore = new PgSessionStore({
  pool,
  createTableIfMissing: true,
});

export async function checkConnection() {
  const spinner = ora('Connecting to database').start();

  try {
    await pool.query('SELECT 1');
    spinner.succeed(chalk.green('Database connected'));
    return true;
  } catch (error) {
    spinner.fail(`${chalk.red('Database connection failed')} ${chalk.gray(error.message)}`);
    return false;
  }
}

export async function useMigration(statements = []) {
  if (statements.length === 0) {
    console.log(logSymbols.info, chalk.gray('No schema found, migration skipped'));
    return false;
  }

  const spinner = ora('Running migration').start();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    for (const statement of statements) {
      await client.query(statement);
    }
    await client.query('COMMIT');
    spinner.succeed(chalk.green('Migration completed'));
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    spinner.fail(`${chalk.red('Migration failed')} ${chalk.gray(error.message)}`);
    throw error;
  } finally {
    client.release();
  }
}